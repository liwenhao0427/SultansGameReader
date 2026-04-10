import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dagre from 'dagre'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { nodeTypes } from './nodes/index.js'
import { useResolvedImage } from '../services/imageResolver'
import { extractEdges } from '../services/edgeExtractor.js'
import { parseConditionObject } from '../services/conditionParser.js'
import { mountNodeOnCanvas, linkNodesOnCanvas } from '../services/graphNavigation.js'
import useCanvasStore from '../stores/useCanvasStore.js'
import useConfigStore from '../stores/useConfigStore.js'
import usePlayerStore from '../stores/usePlayerStore.js'
import { evaluateCondition } from '../services/conditionEvaluator.js'
import { buildFocusViewport } from '../services/canvasViewport.js'

const EDGE_COLORS = {
  success: '#a6e3a1',
  failed: '#f38ba8',
  default: '#6c7086',
}

const AUTO_LAYOUT_NODE_SIZE = {
  rite: { width: 170, height: 116 },
  event: { width: 150, height: 88 },
  loot: { width: 156, height: 96 },
  default: { width: 150, height: 90 },
}

function layoutNodesWithDagre(nodes, edges) {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({
    rankdir: 'LR',
    nodesep: 72,
    ranksep: 120,
    marginx: 40,
    marginy: 40,
  })

  nodes.forEach((node) => {
    const size = AUTO_LAYOUT_NODE_SIZE[node.type] || AUTO_LAYOUT_NODE_SIZE.default
    graph.setNode(node.id, {
      width: node.measured?.width || size.width,
      height: node.measured?.height || size.height,
    })
  })

  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target)
  })

  dagre.layout(graph)

  return nodes.map((node) => {
    const positioned = graph.node(node.id)
    if (!positioned) return node
    return {
      ...node,
      position: {
        x: Math.round(positioned.x - positioned.width / 2),
        y: Math.round(positioned.y - positioned.height / 2),
      },
    }
  })
}

function summarize(item, data) {
  return item.name || item.text || data?.name || data?.dialog_tree_id || data?.description || data?.text || item.id
}

function buildCanvasEdge(relation) {
  return {
    id: `${relation.source}->${relation.target}:${relation.path}`,
    source: relation.source,
    target: relation.target,
    style: { stroke: EDGE_COLORS[relation.branchType] ?? EDGE_COLORS.default },
    data: {
      conditionText: relation.conditionText,
      branchType: relation.branchType,
      conditionObj: relation.conditionObj,
      resultTitle: relation.resultTitle,
      resultText: relation.resultText,
    },
  }
}

function extractRelationCards(conditionObj, cardsMap, cardsById) {
  if (!conditionObj || typeof conditionObj !== 'object') return []

  const directIds = []
  const appendCard = (value) => {
    if (value == null) return
    const list = Array.isArray(value) ? value : [value]
    for (const id of list) {
      const key = String(id)
      const card = cardsById?.[key] || null
      directIds.push({
        id: key,
        name: card?.name || cardsMap?.get(key) || key,
        rare: card?.rare || null,
        image: Array.isArray(card?.resource) ? (card.resource[0] || null) : (card?.resource || null),
      })
    }
  }

  appendCard(conditionObj.is)
  appendCard(conditionObj['!is'])

  if (conditionObj.any && typeof conditionObj.any === 'object') {
    appendCard(conditionObj.any.is)
    appendCard(conditionObj.any['!is'])
  }

  const uniq = new Map()
  for (const card of directIds) {
    if (!uniq.has(card.id)) uniq.set(card.id, card)
  }
  return Array.from(uniq.values())
}

function RelationCardChip({ card }) {
  const { url } = useResolvedImage(card?.image)

  return (
    <div style={relationCardChipStyle}>
      <div style={relationCardThumbStyle}>
        {url ? <img src={url} alt="" style={relationCardThumbImageStyle} /> : <span style={relationCardThumbTextStyle}>卡牌</span>}
      </div>
      <div style={relationCardNameStyle}>{card.name}</div>
    </div>
  )
}

function RelationPickerModal({ picker, onToggle, onConfirm, onClose }) {
  if (!picker) return null

  const keyword = picker.filterText.trim().toLowerCase()
  const filteredOptions = keyword
    ? picker.options.filter((option) => {
      const haystack = [
        option.targetType,
        option.targetId,
        option.targetLabel,
        option.conditionText,
        option.resultTitle,
        option.resultText,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(keyword)
    })
    : picker.options

  const cardOptions = filteredOptions.filter((option) => option.targetType === 'card')
  const otherOptions = filteredOptions.filter((option) => option.targetType !== 'card')

  return (
    <div style={pickerMaskStyle} onClick={onClose}>
      <div style={pickerPanelStyle} onClick={(event) => event.stopPropagation()}>
        <div style={pickerHeaderStyle}>
          <div>
            <div style={pickerTitleStyle}>选择要带出的关联节点</div>
            <div style={pickerSubTitleStyle}>
              从 `{picker.sourceNodeId}` 主动选择需要展开的后续关系，不再自动带出。
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" style={pickerActionStyle} onClick={onClose}>取消</button>
            <button
              type="button"
              style={pickerPrimaryStyle}
              onClick={onConfirm}
              disabled={picker.selectedOptionIds.length === 0}
            >
              确定带出 {picker.selectedOptionIds.length || ''}
            </button>
          </div>
        </div>

        {!picker.loading && !picker.error && picker.options.length > 0 && (
          <div style={pickerFilterWrapStyle}>
            <input
              type="text"
              value={picker.filterText}
              onChange={(event) => picker.onFilterChange(event.target.value)}
              placeholder="按条件 / 名称 / ID 筛选…"
              style={pickerFilterInputStyle}
            />
          </div>
        )}

        {picker.loading && <div style={pickerHintStyle}>正在读取关联信息…</div>}
        {!picker.loading && picker.error && <div style={pickerHintStyle}>读取失败：{picker.error}</div>}
        {!picker.loading && !picker.error && filteredOptions.length === 0 && (
          <div style={pickerHintStyle}>当前节点没有可新增到画布的关联项。</div>
        )}

        {!picker.loading && !picker.error && filteredOptions.length > 0 && (
          <div style={pickerListStyle}>
            {cardOptions.length > 0 && (
              <div style={pickerSectionStyle}>
                <div style={pickerSectionTitleStyle}>卡牌关联</div>
                <div style={pickerCardGridStyle}>
                  {cardOptions.map((option) => (
                    <RelationOptionCard key={option.optionId} option={option} selected={picker.selectedOptionIds.includes(option.optionId)} onToggle={onToggle} />
                  ))}
                </div>
              </div>
            )}

            {otherOptions.length > 0 && (
              <div style={pickerSectionStyle}>
                <div style={pickerSectionTitleStyle}>其他关联</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  {otherOptions.map((option) => (
                    <RelationOptionRow key={option.optionId} option={option} selected={picker.selectedOptionIds.includes(option.optionId)} onToggle={onToggle} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function RelationOptionRow({ option, selected, onToggle }) {
  return (
    <label
      style={{
        ...pickerItemStyle,
        ...(selected ? pickerItemActiveStyle : null),
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(option.optionId)}
        style={{ marginTop: 4 }}
      />
      <div style={{ minWidth: 0 }}>
        <div style={pickerItemTopStyle}>
          <span style={pickerTargetTypeStyle}>{option.targetType}</span>
          <span style={pickerTargetTitleStyle}>{option.targetLabel}</span>
          <span style={pickerTargetIdStyle}>{option.targetId}</span>
        </div>

        {option.conditionText && (
          <div title={option.conditionText} style={pickerLineClampStyle}>
            条件：{option.conditionText}
          </div>
        )}

        {(option.resultTitle || option.resultText) && (
          <div
            title={[option.resultTitle, option.resultText].filter(Boolean).join('\n')}
            style={{ ...pickerLineClampStyle, color: '#f0dfbd' }}
          >
            结果：{option.resultTitle || option.resultText}
          </div>
        )}

        {option.relatedCards.length > 0 && (
          <div style={pickerCardRowStyle}>
            {option.relatedCards.slice(0, 4).map((card) => (
              <RelationCardChip key={`${option.optionId}:${card.id}`} card={card} />
            ))}
          </div>
        )}
      </div>
    </label>
  )
}

function RelationOptionCard({ option, selected, onToggle }) {
  const { url } = useResolvedImage(option.targetImage)

  return (
    <label
      style={{
        ...pickerCardOptionStyle,
        ...(selected ? pickerCardOptionActiveStyle : null),
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(option.optionId)}
        style={pickerCardCheckboxStyle}
      />
      <div style={pickerCardPosterStyle}>
        {url ? (
          <img src={url} alt="" style={pickerCardPosterImageStyle} />
        ) : (
          <div style={pickerCardPosterPlaceholderStyle}>卡牌</div>
        )}
      </div>
      <div style={pickerCardNameStyle}>{option.targetLabel}</div>
      <div style={pickerCardIdCaptionStyle}>{option.targetId}</div>
      {option.conditionText && (
        <div title={option.conditionText} style={pickerCardCaptionStyle}>
          条件：{option.conditionText}
        </div>
      )}
    </label>
  )
}

function CanvasInner() {
  const { nodes, edges, selectedNodeId, selectedOpenMode, setSelectedNode, setNodes: setCanvasNodes } = useCanvasStore()
  const cardsLite = useConfigStore((s) => s.cardsLite)
  const cardsById = useConfigStore((s) => s.cardsById)
  const { setNodes, screenToFlowPosition, setViewport, getZoom } = useReactFlow()
  const { triggeredEvents, counterValues } = usePlayerStore()

  const hasPlayerData = triggeredEvents.size > 0 || counterValues.size > 0
  const [tooltip, setTooltip] = useState(null)
  const [pendingSourceId, setPendingSourceId] = useState(null)
  const [relationPicker, setRelationPicker] = useState(null)
  const lastAutoLayoutSignatureRef = useRef('')
  const canvasShellRef = useRef(null)

  const nodeMap = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes]
  )

  const nodeIdSet = useMemo(
    () => new Set(nodes.map((node) => node.id)),
    [nodes]
  )

  const getEdgeOpacity = useCallback(
    (edge) => {
      if (!hasPlayerData || !edge.data?.conditionObj) return 1
      return evaluateCondition(edge.data.conditionObj, { triggeredEvents, counterValues }) ? 1 : 0.3
    },
    [hasPlayerData, triggeredEvents, counterValues]
  )

  const openRelationPicker = useCallback(async (sourceNodeId) => {
    const sourceNode = nodeMap.get(sourceNodeId)
    if (!sourceNode?.data?.rawData) return

    setRelationPicker({
      sourceNodeId,
      loading: true,
      error: null,
      options: [],
      selectedOptionIds: [],
      filterText: '',
      onFilterChange: () => {},
    })

    const colonIndex = sourceNodeId.indexOf(':')
    const sourceType = sourceNodeId.slice(0, colonIndex)
    const sourceRawId = sourceNodeId.slice(colonIndex + 1)

    try {
      const relations = extractEdges(sourceType, sourceRawId, sourceNode.data.rawData)
        .filter((relation) => !nodeIdSet.has(relation.target))

      const optionMap = new Map()
      for (let index = 0; index < relations.length; index += 1) {
        const relation = relations[index]
        const [targetType, targetId] = relation.target.split(':')
        const targetData = await window.electronAPI.configReadCache(targetType, targetId)
        const conditionLines = parseConditionObject(relation.conditionObj, cardsLite)
        const option = {
          optionId: `${relation.path}:${targetType}:${targetId}:${index}`,
          relation,
          targetType,
          targetId,
          targetLabel: summarize({ id: targetId, type: targetType }, targetData || {}),
          targetImage: targetType === 'card'
            ? (Array.isArray(targetData?.resource) ? (targetData.resource[0] || null) : (targetData?.resource || null))
            : null,
          conditionText: conditionLines.join(' / ') || relation.conditionText || '',
          relatedCards: extractRelationCards(relation.conditionObj, cardsLite, cardsById),
          resultTitle: relation.resultTitle || '',
          resultText: relation.resultText || '',
        }
        const dedupeKey = [
          targetType,
          targetId,
          option.conditionText,
          option.resultTitle,
          option.resultText,
        ].join('|')
        if (!optionMap.has(dedupeKey)) {
          optionMap.set(dedupeKey, option)
        }
      }

      const options = Array.from(optionMap.values())

      setRelationPicker({
        sourceNodeId,
        loading: false,
        error: null,
        options,
        selectedOptionIds: [],
        filterText: '',
        onFilterChange: (value) => {
          setRelationPicker((current) => current ? { ...current, filterText: value } : current)
        },
      })
    } catch (error) {
      setRelationPicker({
        sourceNodeId,
        loading: false,
        error: error?.message || '未知错误',
        options: [],
        selectedOptionIds: [],
        filterText: '',
        onFilterChange: () => {},
      })
    }
  }, [cardsById, cardsLite, nodeIdSet, nodeMap])

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(async (event) => {
    event.preventDefault()
    const raw = event.dataTransfer.getData('application/json')
    if (!raw) return

    let payload
    try {
      payload = JSON.parse(raw)
    } catch {
      return
    }

    const { id, type } = payload
    if (!id || !type) return

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    await mountNodeOnCanvas({ id, type }, position, { autoSelect: true, expandRelations: false })
  }, [screenToFlowPosition])

  const onNodeClick = useCallback((_event, node) => {
    setSelectedNode(node.id, node.type === 'rite' ? 'fullscreen' : 'panel')
    setTooltip(null)
  }, [setSelectedNode])

  const onEdgeClick = useCallback((event, edge) => {
    const parts = [
      edge.data?.conditionText ? `条件：${edge.data.conditionText}` : null,
      edge.data?.resultTitle ? `结果：${edge.data.resultTitle}` : null,
      edge.data?.resultText || null,
    ].filter(Boolean)

    if (parts.length === 0) return
    setTooltip({ x: event.clientX, y: event.clientY, text: parts.join('\n') })
  }, [])

  const onPaneClick = useCallback(() => {
    setTooltip(null)
  }, [])

  const onNodesChange = useCallback((changes) => {
    setCanvasNodes(applyNodeChanges(changes, useCanvasStore.getState().nodes))
  }, [setCanvasNodes])

  const runAutoLayout = useCallback(() => {
    const currentNodes = useCanvasStore.getState().nodes
    const currentEdges = useCanvasStore.getState().edges
    if (currentNodes.length === 0) return
    const laidOutNodes = layoutNodesWithDagre(currentNodes, currentEdges)
    setCanvasNodes(laidOutNodes)
  }, [setCanvasNodes])

  const onConnectStart = useCallback((_event, params) => {
    setPendingSourceId(params?.nodeId || null)
  }, [])

  const onConnectEnd = useCallback(() => {
    if (pendingSourceId) {
      openRelationPicker(pendingSourceId)
    }
    setPendingSourceId(null)
  }, [openRelationPicker, pendingSourceId])

  const toggleRelationOption = useCallback((optionId) => {
    setRelationPicker((current) => {
      if (!current) return current
      const selectedOptionIds = current.selectedOptionIds.includes(optionId)
        ? current.selectedOptionIds.filter((id) => id !== optionId)
        : [...current.selectedOptionIds, optionId]
      return { ...current, selectedOptionIds }
    })
  }, [])

  const confirmRelationPicker = useCallback(async () => {
    if (!relationPicker) return

    const sourceNode = nodeMap.get(relationPicker.sourceNodeId)
    if (!sourceNode) {
      setRelationPicker(null)
      return
    }

    const selected = relationPicker.options.filter((option) => relationPicker.selectedOptionIds.includes(option.optionId))
    for (let index = 0; index < selected.length; index += 1) {
      const option = selected[index]
      const position = {
        x: sourceNode.position.x + 240 + (index % 2) * 190,
        y: sourceNode.position.y + 60 + Math.floor(index / 2) * 150,
      }

      await mountNodeOnCanvas(
        { id: option.targetId, type: option.targetType },
        position,
        { autoSelect: false, expandRelations: false }
      )

      linkNodesOnCanvas(
        relationPicker.sourceNodeId,
        option.targetType,
        option.targetId,
        option.relation.branchType,
        option.conditionText || option.resultTitle || option.resultText || ''
      )
    }

    setNodes(useCanvasStore.getState().nodes)
    setRelationPicker(null)
    runAutoLayout()
  }, [nodeMap, relationPicker, runAutoLayout, setNodes])

  const onNodeDragStop = useCallback(() => {
    runAutoLayout()
  }, [runAutoLayout])

  useEffect(() => {
    const signature = JSON.stringify({
      nodeIds: nodes.map((node) => node.id),
      edgeIds: edges.map((edge) => edge.id),
    })

    if (signature === lastAutoLayoutSignatureRef.current) return
    lastAutoLayoutSignatureRef.current = signature

    if (nodes.length <= 1) return
    runAutoLayout()
  }, [edges, nodes, runAutoLayout])

  useEffect(() => {
    if (!selectedNodeId) return
    const activeNode = nodes.find((node) => node.id === selectedNodeId)
    if (!activeNode) return

    const width = activeNode.measured?.width || AUTO_LAYOUT_NODE_SIZE[activeNode.type]?.width || AUTO_LAYOUT_NODE_SIZE.default.width
    const height = activeNode.measured?.height || AUTO_LAYOUT_NODE_SIZE[activeNode.type]?.height || AUTO_LAYOUT_NODE_SIZE.default.height

    const canvasRect = canvasShellRef.current?.getBoundingClientRect?.()
    if (!canvasRect) return

    const overlayRect = selectedOpenMode === 'panel'
      ? document.querySelector('[data-detail-panel="true"]')?.getBoundingClientRect?.() ?? null
      : null

    const viewport = buildFocusViewport({
      canvasRect,
      overlayRect,
      nodePosition: activeNode.position,
      nodeSize: { width, height },
      zoom: getZoom(),
    })

    if (!viewport) return

    setViewport(viewport, { duration: 420 })
  }, [getZoom, nodes, selectedNodeId, selectedOpenMode, setViewport])

  return (
    <div ref={canvasShellRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges.map((edge) => ({
          ...edge,
          style: {
            ...edge.style,
            opacity: getEdgeOpacity(edge),
          },
        }))}
        nodeTypes={nodeTypes}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDragStop={onNodeDragStop}
        nodesDraggable
        fitView
      >
        <Background color="rgba(172, 141, 88, 0.18)" gap={24} />
        <Controls />
        <MiniMap
          nodeColor="#7f6241"
          maskColor="rgba(15,12,8,0.76)"
          style={{ background: '#1a140f', border: '1px solid rgba(212, 184, 126, 0.16)' }}
        />
      </ReactFlow>

      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 8,
            top: tooltip.y + 8,
            background: '#2a2118',
            color: '#f1e8d5',
            padding: '8px 10px',
            borderRadius: 10,
            border: '1px solid rgba(212, 184, 126, 0.18)',
            fontSize: 12,
            maxWidth: 320,
            boxShadow: '0 8px 24px rgba(0,0,0,0.32)',
            pointerEvents: 'none',
            zIndex: 9999,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6,
          }}
        >
          {tooltip.text}
        </div>
      )}

      <RelationPickerModal
        picker={relationPicker}
        onToggle={toggleRelationOption}
        onConfirm={confirmRelationPicker}
        onClose={() => setRelationPicker(null)}
      />
    </div>
  )
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}

const pickerMaskStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 95,
  background: 'rgba(6, 5, 4, 0.72)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
}

const pickerPanelStyle = {
  width: 'min(980px, 92vw)',
  maxHeight: '82vh',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  borderRadius: 28,
  border: '1px solid rgba(212, 184, 126, 0.16)',
  background: 'linear-gradient(180deg, rgba(28, 22, 16, 0.98), rgba(18, 15, 11, 0.98))',
  boxShadow: '0 30px 70px rgba(0, 0, 0, 0.35)',
  overflow: 'hidden',
}

const pickerHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  padding: '20px 22px 16px',
  borderBottom: '1px solid rgba(212, 184, 126, 0.1)',
}

const pickerTitleStyle = {
  fontSize: 24,
  fontWeight: 800,
  color: '#f8edd7',
}

const pickerSubTitleStyle = {
  marginTop: 8,
  fontSize: 13,
  lineHeight: 1.6,
  color: 'rgba(241, 232, 213, 0.68)',
}

const pickerActionStyle = {
  padding: '10px 14px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.18)',
  background: 'rgba(212, 184, 126, 0.08)',
  color: '#f1e8d5',
  cursor: 'pointer',
}

const pickerPrimaryStyle = {
  ...pickerActionStyle,
  background: 'rgba(212, 184, 126, 0.18)',
}

const pickerHintStyle = {
  padding: 24,
  color: 'rgba(241, 232, 213, 0.72)',
  fontSize: 14,
}

const pickerFilterWrapStyle = {
  padding: '0 18px 14px',
  borderBottom: '1px solid rgba(212, 184, 126, 0.08)',
}

const pickerFilterInputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 14,
  border: '1px solid rgba(212, 184, 126, 0.14)',
  background: 'rgba(212, 184, 126, 0.05)',
  color: '#f1e8d5',
  outline: 'none',
  fontSize: 13,
}

const pickerListStyle = {
  minHeight: 0,
  overflowY: 'auto',
  padding: 18,
  display: 'grid',
  gap: 18,
}

const pickerSectionStyle = {
  display: 'grid',
  gap: 12,
}

const pickerSectionTitleStyle = {
  fontSize: 13,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: '#d8bc84',
}

const pickerItemStyle = {
  display: 'grid',
  gridTemplateColumns: '20px minmax(0, 1fr)',
  gap: 14,
  padding: 16,
  borderRadius: 20,
  border: '1px solid rgba(212, 184, 126, 0.12)',
  background: 'rgba(212, 184, 126, 0.035)',
  cursor: 'pointer',
}

const pickerItemActiveStyle = {
  border: '1px solid rgba(212, 184, 126, 0.3)',
  background: 'rgba(212, 184, 126, 0.12)',
}

const pickerItemTopStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
}

const pickerTargetTypeStyle = {
  padding: '2px 8px',
  borderRadius: 999,
  background: 'rgba(212, 184, 126, 0.12)',
  color: '#e3c893',
  fontSize: 11,
}

const pickerTargetTitleStyle = {
  fontSize: 16,
  fontWeight: 700,
  color: '#fff0d3',
}

const pickerTargetIdStyle = {
  fontSize: 12,
  color: 'rgba(241, 232, 213, 0.5)',
  fontFamily: 'Consolas, monospace',
}

const pickerLineClampStyle = {
  marginTop: 8,
  fontSize: 13,
  lineHeight: 1.65,
  color: '#d7c3a0',
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  overflow: 'hidden',
}

const pickerCardRowStyle = {
  marginTop: 12,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

const pickerCardGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
}

const pickerCardOptionStyle = {
  position: 'relative',
  display: 'grid',
  gap: 8,
  padding: 12,
  borderRadius: 20,
  border: '1px solid rgba(212, 184, 126, 0.12)',
  background: 'rgba(212, 184, 126, 0.035)',
  cursor: 'pointer',
  minWidth: 0,
}

const pickerCardOptionActiveStyle = {
  border: '1px solid rgba(212, 184, 126, 0.3)',
  background: 'rgba(212, 184, 126, 0.12)',
}

const pickerCardCheckboxStyle = {
  position: 'absolute',
  top: 12,
  right: 12,
}

const pickerCardPosterStyle = {
  width: 76,
  height: 165,
  borderRadius: 16,
  overflow: 'hidden',
  border: '1px solid rgba(212, 184, 126, 0.12)',
  background: 'rgba(18, 15, 11, 0.92)',
}

const pickerCardPosterImageStyle = {
  width: '100%',
  height: '100%',
  display: 'block',
  objectFit: 'contain',
  objectPosition: 'top center',
}

const pickerCardPosterPlaceholderStyle = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'rgba(241, 232, 213, 0.42)',
  fontSize: 12,
}

const pickerCardNameStyle = {
  fontSize: 18,
  fontWeight: 700,
  color: '#fff0d3',
  lineHeight: 1.3,
}

const pickerCardIdCaptionStyle = {
  fontSize: 11,
  color: 'rgba(241, 232, 213, 0.5)',
  fontFamily: 'Consolas, monospace',
}

const pickerCardCaptionStyle = {
  fontSize: 12,
  lineHeight: 1.6,
  color: '#d7c3a0',
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 3,
  overflow: 'hidden',
}

const relationCardChipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.14)',
  background: 'rgba(212, 184, 126, 0.06)',
}

const relationCardThumbStyle = {
  width: 24,
  height: 52,
  borderRadius: 8,
  overflow: 'hidden',
  background: 'rgba(18, 15, 11, 0.94)',
  flexShrink: 0,
}

const relationCardThumbImageStyle = {
  width: '100%',
  height: '100%',
  display: 'block',
  objectFit: 'contain',
  objectPosition: 'top center',
}

const relationCardThumbTextStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  fontSize: 9,
  color: 'rgba(241, 232, 213, 0.42)',
}

const relationCardNameStyle = {
  fontSize: 12,
  color: '#f1e8d5',
}

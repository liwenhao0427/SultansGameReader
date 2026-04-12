import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dagre from 'dagre'
import {
  Background,
  Controls,
  MiniMap,
  MarkerType,
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
import { READER_RESOURCE_ASSETS } from '../resourceConfig.js'
import useCanvasStore from '../stores/useCanvasStore.js'
import useConfigStore from '../stores/useConfigStore.js'
import usePlayerStore from '../stores/usePlayerStore.js'
import { evaluateCondition } from '../services/conditionEvaluator.js'
import { buildFocusViewport } from '../services/canvasViewport.js'

const EDGE_COLORS = {
  success: '#d3d8a2',
  failed: '#d9a09a',
  default: '#d9c7a0',
}

const EXPANDABLE_TARGET_TYPES = new Set(['event', 'loot', 'rite', 'over'])

const AUTO_LAYOUT_NODE_SIZE = {
  rite: { width: 260, height: 86 },
  event: { width: 220, height: 72 },
  loot: { width: 250, height: 86 },
  over: { width: 240, height: 132 },
  default: { width: 220, height: 72 },
}

const ISOLATED_NODE_X = 68
const TREE_ROOT_X = 348
const TREE_START_Y = 56
const ISOLATED_NODE_GAP_Y = 52
const TREE_COMPONENT_GAP_Y = 112
const FIT_VIEW_OPTIONS = { padding: 0.34, minZoom: 0.22, maxZoom: 1 }
const VIEWPORT_EPSILON = 0.5

function getNodeLayoutSize(node) {
  return AUTO_LAYOUT_NODE_SIZE[node.type] || AUTO_LAYOUT_NODE_SIZE.default
}

function buildConnectedComponents(nodes, edges) {
  const adjacency = new Map(nodes.map((node) => [node.id, new Set()]))

  edges.forEach((edge) => {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) return
    adjacency.get(edge.source).add(edge.target)
    adjacency.get(edge.target).add(edge.source)
  })

  const visited = new Set()
  const components = []

  nodes.forEach((node) => {
    if (visited.has(node.id)) return

    const queue = [node.id]
    const componentIds = []
    visited.add(node.id)

    while (queue.length > 0) {
      const currentId = queue.shift()
      componentIds.push(currentId)
      adjacency.get(currentId)?.forEach((nextId) => {
        if (visited.has(nextId)) return
        visited.add(nextId)
        queue.push(nextId)
      })
    }

    components.push(componentIds)
  })

  return components
}

function normalizePositionedNodes(positionedNodes, offsetX, offsetY) {
  if (positionedNodes.length === 0) {
    return { nodes: [], width: 0, height: 0 }
  }

  let minLeft = Number.POSITIVE_INFINITY
  let minTop = Number.POSITIVE_INFINITY
  let maxRight = Number.NEGATIVE_INFINITY
  let maxBottom = Number.NEGATIVE_INFINITY

  positionedNodes.forEach((node) => {
    const size = getNodeLayoutSize(node)
    const width = node.measured?.width || size.width
    const height = node.measured?.height || size.height
    minLeft = Math.min(minLeft, node.position.x)
    minTop = Math.min(minTop, node.position.y)
    maxRight = Math.max(maxRight, node.position.x + width)
    maxBottom = Math.max(maxBottom, node.position.y + height)
  })

  const translateX = offsetX - minLeft
  const translateY = offsetY - minTop

  return {
    nodes: positionedNodes.map((node) => ({
      ...node,
      position: {
        x: Math.round(node.position.x + translateX),
        y: Math.round(node.position.y + translateY),
      },
    })),
    width: Math.max(0, maxRight - minLeft),
    height: Math.max(0, maxBottom - minTop),
  }
}

function layoutTreeComponent(nodes, edges, componentNodeIds, offsetX, offsetY) {
  const componentNodes = componentNodeIds
    .map((nodeId) => nodes.find((node) => node.id === nodeId))
    .filter(Boolean)
  const componentNodeIdSet = new Set(componentNodeIds)
  const componentEdges = edges.filter((edge) => (
    componentNodeIdSet.has(edge.source) && componentNodeIdSet.has(edge.target)
  ))

  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({
    rankdir: 'LR',
    ranker: 'tight-tree',
    nodesep: 44,
    ranksep: 92,
    marginx: 24,
    marginy: 40,
  })

  componentNodes.forEach((node) => {
    const size = getNodeLayoutSize(node)
    graph.setNode(node.id, {
      width: node.measured?.width || size.width,
      height: node.measured?.height || size.height,
    })
  })

  componentEdges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target)
  })

  dagre.layout(graph)

  const positionedNodes = componentNodes.map((node) => {
    const positioned = graph.node(node.id)
    if (!positioned) return node
    return {
      ...node,
      position: {
        x: Math.round(offsetX + positioned.x - positioned.width / 2),
        y: Math.round(offsetY + positioned.y - positioned.height / 2),
      },
    }
  })

  return normalizePositionedNodes(positionedNodes, offsetX, offsetY)
}

function layoutNodesWithDagre(nodes, edges) {
  const components = buildConnectedComponents(nodes, edges)
  const positionedNodeMap = new Map()
  let isolatedOffsetY = TREE_START_Y
  let treeOffsetY = TREE_START_Y

  components.forEach((componentNodeIds) => {
    const componentNodeIdSet = new Set(componentNodeIds)
    const componentEdges = edges.filter((edge) => (
      componentNodeIdSet.has(edge.source) && componentNodeIdSet.has(edge.target)
    ))
    const isIsolated = componentEdges.length === 0

    if (isIsolated) {
      const node = nodes.find((entry) => entry.id === componentNodeIds[0])
      if (!node) return
      positionedNodeMap.set(node.id, {
        ...node,
        position: {
          x: ISOLATED_NODE_X,
          y: isolatedOffsetY,
        },
      })
      isolatedOffsetY += getNodeLayoutSize(node).height + ISOLATED_NODE_GAP_Y
      return
    }

    const result = layoutTreeComponent(
      nodes,
      edges,
      componentNodeIds,
      TREE_ROOT_X,
      treeOffsetY
    )

    result.nodes.forEach((node) => {
      positionedNodeMap.set(node.id, node)
    })
    treeOffsetY += result.height + TREE_COMPONENT_GAP_Y
  })

  return nodes.map((node) => positionedNodeMap.get(node.id) || node)
}

function summarize(item, data) {
  return item.name || item.text || data?.name || data?.dialog_tree_id || data?.description || data?.text || item.id
}

function dedupeRelationOptions(relations, nodeIdSet) {
  const optionMap = new Map()

  relations.forEach((relation, index) => {
    const [targetType, targetId] = relation.target.split(':')
    if (!targetType || !targetId) return
    if (!EXPANDABLE_TARGET_TYPES.has(targetType)) return
    if (nodeIdSet.has(relation.target)) return

    const dedupeKey = [
      targetType,
      targetId,
      relation.conditionText || '',
      relation.resultTitle || '',
      relation.resultText || '',
    ].join('|')

    if (!optionMap.has(dedupeKey)) {
      optionMap.set(dedupeKey, {
        optionId: `${relation.path}:${targetType}:${targetId}:${index}`,
        relation,
        targetType,
        targetId,
      })
    }
  })

  return Array.from(optionMap.values())
}

function buildCanvasEdge(relation) {
  const stroke = EDGE_COLORS[relation.branchType] ?? EDGE_COLORS.default
  return {
    id: `${relation.source}->${relation.target}:${relation.path}`,
    type: 'smoothstep',
    source: relation.source,
    target: relation.target,
    sourcePosition: 'right',
    targetPosition: 'left',
    style: {
      stroke,
      strokeWidth: 2.4,
      filter: `drop-shadow(0 0 2px ${stroke})`,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: stroke,
    },
    pathOptions: {
      borderRadius: 18,
      offset: 18,
    },
    data: {
      conditionText: relation.conditionText,
      branchType: relation.branchType,
      conditionObj: relation.conditionObj,
      resultTitle: relation.resultTitle,
      resultText: relation.resultText,
    },
  }
}

function buildGraphStructureSignature(nodes, edges) {
  return JSON.stringify({
    nodeIds: nodes.map((node) => node.id),
    edgeIds: edges.map((edge) => edge.id),
  })
}

function buildFocusSignature(focusState) {
  if (!focusState) return ''

  return JSON.stringify({
    id: focusState.id,
    openMode: focusState.openMode,
    position: {
      x: Math.round(focusState.position.x),
      y: Math.round(focusState.position.y),
    },
    size: {
      width: Math.round(focusState.size.width),
      height: Math.round(focusState.size.height),
    },
  })
}

function isViewportClose(currentViewport, nextViewport) {
  if (!currentViewport || !nextViewport) return false

  return (
    Math.abs((currentViewport.x || 0) - nextViewport.x) < VIEWPORT_EPSILON &&
    Math.abs((currentViewport.y || 0) - nextViewport.y) < VIEWPORT_EPSILON &&
    Math.abs((currentViewport.zoom || 0) - nextViewport.zoom) < 0.01
  )
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
            {filteredOptions.length > 0 && (
              <div style={pickerSectionStyle}>
                <div style={pickerSectionTitleStyle}>其他关联</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  {filteredOptions.map((option) => (
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
  const { nodes, edges, selectedNodeId, selectedOpenMode, setSelectedNode, setNodes: setCanvasNodes, removeNodeTree } = useCanvasStore()
  const cardsLite = useConfigStore((s) => s.cardsLite)
  const cardsById = useConfigStore((s) => s.cardsById)
  const { setNodes, screenToFlowPosition, setViewport, getZoom, getViewport, fitView } = useReactFlow()
  const { triggeredEvents, counterValues } = usePlayerStore()
  const { url: mapBackgroundUrl } = useResolvedImage(READER_RESOURCE_ASSETS.nodeMapBackground)

  const hasPlayerData = triggeredEvents.size > 0 || counterValues.size > 0
  const [tooltip, setTooltip] = useState(null)
  const [pendingSourceId, setPendingSourceId] = useState(null)
  const [relationPicker, setRelationPicker] = useState(null)
  const lastAutoLayoutSignatureRef = useRef('')
  const lastFitViewSignatureRef = useRef('')
  const lastFocusSignatureRef = useRef('')
  const canvasShellRef = useRef(null)

  const nodeMap = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes]
  )

  const nodeIdSet = useMemo(
    () => new Set(nodes.map((node) => node.id)),
    [nodes]
  )

  const selectedNodeFocusState = useMemo(() => {
    if (!selectedNodeId) return null

    const activeNode = nodes.find((node) => node.id === selectedNodeId)
    if (!activeNode) return null

    const fallbackSize = AUTO_LAYOUT_NODE_SIZE[activeNode.type] || AUTO_LAYOUT_NODE_SIZE.default
    const width = activeNode.measured?.width || fallbackSize.width
    const height = activeNode.measured?.height || fallbackSize.height

    return {
      id: activeNode.id,
      type: activeNode.type,
      openMode: selectedOpenMode,
      position: activeNode.position,
      size: { width, height },
    }
  }, [nodes, selectedNodeId, selectedOpenMode])

  const graphStructureSignature = useMemo(
    () => buildGraphStructureSignature(nodes, edges),
    [edges, nodes]
  )

  const focusSignature = useMemo(
    () => buildFocusSignature(selectedNodeFocusState),
    [selectedNodeFocusState]
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
      const pendingOptions = dedupeRelationOptions(relations, nodeIdSet)

      const optionMap = new Map()
      for (let index = 0; index < pendingOptions.length; index += 1) {
        const seed = pendingOptions[index]
        const relation = seed.relation
        const targetType = seed.targetType
        const targetId = seed.targetId
        const targetData = await window.electronAPI.configReadCache(targetType, targetId)
        const conditionLines = parseConditionObject(relation.conditionObj, cardsLite)
        const option = {
          optionId: seed.optionId,
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

  const flowNodes = useMemo(
    () => nodes.map((node) => ({
      ...node,
      draggable: false,
      sourcePosition: 'right',
      targetPosition: 'left',
      data: {
        ...node.data,
        onExpand: (nodeId) => openRelationPicker(nodeId),
        onRemove: (nodeId) => removeNodeTree(nodeId),
        expandCount: dedupeRelationOptions(
          extractEdges(node.type, node.id.split(':').slice(1).join(':'), node.data?.rawData || {}),
          nodeIdSet
        ).length,
      },
    })),
    [nodeIdSet, nodes, openRelationPicker, removeNodeTree]
  )

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
    if (!_event.target?.closest?.('[data-node-body="true"]')) return
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

    runAutoLayout()
    setNodes(useCanvasStore.getState().nodes)

    setRelationPicker(null)
  }, [nodeMap, relationPicker, runAutoLayout, setNodes])

  const onNodeDragStop = useCallback(() => {
    runAutoLayout()
  }, [runAutoLayout])

  useEffect(() => {
    if (graphStructureSignature === lastAutoLayoutSignatureRef.current) return
    lastAutoLayoutSignatureRef.current = graphStructureSignature

    if (nodes.length <= 1) return
    runAutoLayout()
  }, [graphStructureSignature, nodes.length, runAutoLayout])

  useEffect(() => {
    if (nodes.length === 0) {
      lastFitViewSignatureRef.current = ''
      return undefined
    }

    if (selectedNodeFocusState) return undefined
    if (graphStructureSignature === lastFitViewSignatureRef.current) return undefined

    let cancelled = false
    let frameId = 0

    lastFitViewSignatureRef.current = graphStructureSignature

    frameId = window.requestAnimationFrame(() => {
      if (cancelled) return
      fitView({
        ...FIT_VIEW_OPTIONS,
        duration: 280,
      })
    })

    return () => {
      cancelled = true
      if (frameId) window.cancelAnimationFrame(frameId)
    }
  }, [fitView, graphStructureSignature, nodes.length, selectedNodeFocusState])

  useEffect(() => {
    if (!selectedNodeFocusState) {
      lastFocusSignatureRef.current = ''
      return undefined
    }

    if (focusSignature === lastFocusSignatureRef.current) return undefined

    let cancelled = false
    let frameId = 0

    lastFocusSignatureRef.current = focusSignature

    frameId = window.requestAnimationFrame(() => {
      if (cancelled) return

      const canvasRect = canvasShellRef.current?.getBoundingClientRect?.()
      if (!canvasRect) return

      const overlayRect = selectedNodeFocusState.openMode === 'panel'
        ? document.querySelector('[data-detail-panel="true"]')?.getBoundingClientRect?.() ?? null
        : null

      const viewport = buildFocusViewport({
        canvasRect,
        overlayRect,
        nodePosition: selectedNodeFocusState.position,
        nodeSize: selectedNodeFocusState.size,
        zoom: getZoom(),
      })

      if (!viewport) return
      if (isViewportClose(getViewport(), viewport)) return

      setViewport(viewport, { duration: 320 })
    })

    return () => {
      cancelled = true
      if (frameId) window.cancelAnimationFrame(frameId)
    }
  }, [focusSignature, getViewport, getZoom, selectedNodeFocusState, setViewport])

  return (
    <div ref={canvasShellRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={canvasBackdropStyle}>
        {mapBackgroundUrl ? <img src={mapBackgroundUrl} alt="" style={canvasBackdropImageStyle} /> : null}
        <div style={canvasBackdropShadeStyle} />
      </div>
      <ReactFlow
        nodes={flowNodes}
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
        nodesDraggable={false}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
          pathOptions: { borderRadius: 18, offset: 18 },
        }}
      >
        <Background color="rgba(233, 199, 139, 0.08)" gap={28} />
        <Controls
          position="bottom-left"
          showInteractive={false}
          style={flowControlsStyle}
        />
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

const canvasBackdropStyle = {
  position: 'absolute',
  inset: 0,
  borderRadius: 32,
  overflow: 'hidden',
  pointerEvents: 'none',
}

const canvasBackdropImageStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center',
  display: 'block',
  filter: 'none',
  transform: 'scale(1.01)',
}

const canvasBackdropShadeStyle = {
  position: 'absolute',
  inset: 0,
  background: 'transparent',
}

const pickerPanelStyle = {
  width: 'min(980px, 92vw)',
  maxHeight: '82vh',
  display: 'grid',
  gridTemplateRows: 'auto auto minmax(0, 1fr)',
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

const flowControlsStyle = {
  background: 'rgba(28, 22, 16, 0.94)',
  border: '1px solid rgba(212, 184, 126, 0.18)',
  borderRadius: 18,
  boxShadow: '0 14px 28px rgba(0, 0, 0, 0.24)',
  overflow: 'hidden',
}

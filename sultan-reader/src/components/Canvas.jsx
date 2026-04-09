import { useCallback, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'

import { nodeTypes } from './nodes/index.js'
import { extractEdges } from '../services/edgeExtractor.js'
import useCanvasStore from '../stores/useCanvasStore.js'
import usePlayerStore from '../stores/usePlayerStore.js'
import { evaluateCondition } from '../services/conditionEvaluator.js'

// ── 边颜色映射 ──────────────────────────────────────────────────────────────
const EDGE_COLORS = {
  success: '#a6e3a1', // 绿
  failed: '#f38ba8',  // 红
  default: '#6c7086', // 灰
}

// ── dagre 布局 ──────────────────────────────────────────────────────────────
/**
 * 对新增节点应用 dagre 自动布局
 * 已有位置的节点保持不动，只对 position 为 {x:0,y:0} 的新节点重新排布
 * @param {Array} nodes - 全部节点
 * @param {Array} edges - 全部边
 * @returns {Array} 更新了 position 的节点数组
 */
function applyDagreLayout(nodes, edges) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    acyclicer: 'greedy',
    rankdir: 'TB',
    nodesep: 60,
    ranksep: 80,
  })

  // 节点尺寸（与各 NodeComponent 保持一致）
  const NODE_W = 200
  const NODE_H = 80

  nodes.forEach((n) => {
    g.setNode(n.id, { width: NODE_W, height: NODE_H })
  })
  edges.forEach((e) => {
    g.setEdge(e.source, e.target)
  })

  dagre.layout(g)

  return nodes.map((n) => {
    // 已有手动调整位置的节点（非原点）保持不动
    if (n.position.x !== 0 || n.position.y !== 0) return n
    const pos = g.node(n.id)
    if (!pos) return n
    return {
      ...n,
      position: {
        x: pos.x - NODE_W / 2,
        y: pos.y - NODE_H / 2,
      },
    }
  })
}

// ── 内部画布组件（需要在 ReactFlowProvider 内部使用 useReactFlow） ──────────
function CanvasInner() {
  const { nodes, edges, nodeIdSet, addNode, addEdges, setSelectedNode } =
    useCanvasStore()
  const { setNodes } = useReactFlow()

  // 玩家模拟状态（用于条件高亮）
  const { triggeredEvents, counterValues } = usePlayerStore()

  // 判断玩家状态是否有数据（有数据时才做条件高亮）
  const hasPlayerData = triggeredEvents.size > 0 || counterValues.size > 0

  /**
   * 根据玩家状态计算边的透明度
   * - 无条件：正常显示
   * - 有条件且满足：正常显示
   * - 有条件但不满足：降低透明度
   */
  const getEdgeOpacity = useCallback(
    (edge) => {
      if (!hasPlayerData || !edge.data?.conditionText) return 1
      // conditionText 是字符串，无法直接求值；简化实现：有玩家数据时降低未知条件边的透明度
      // 实际条件对象存储在 edge.data.conditionObj（如有），否则保持正常
      if (edge.data?.conditionObj) {
        return evaluateCondition(edge.data.conditionObj, { triggeredEvents, counterValues }) ? 1 : 0.3
      }
      // 无原始条件对象时，有 conditionText 且有玩家数据则半透明
      return 0.3
    },
    [hasPlayerData, triggeredEvents, counterValues]
  )

  // 浮动 tooltip 状态（边点击时显示 conditionText）
  const [tooltip, setTooltip] = useState(null) // { x, y, text }
  const reactFlowWrapper = useRef(null)

  /**
   * 添加节点并自动展开一层关联（含循环防护）
   * @param {string} id - 原始 ID
   * @param {string} type - 节点类型
   * @param {object} data - 缓存数据
   * @param {{ x: number, y: number }} position - 初始位置
   */
  const addNodeWithExpand = useCallback(
    async (id, type, data, position) => {
      const nodeKey = `${type}:${id}`

      // 已存在则跳过（循环防护）
      if (nodeIdSet.has(nodeKey)) return

      // 添加主节点
      addNode(id, type, data, position)

      // 提取关联边
      const relations = extractEdges(type, id, data)

      // 过滤掉 target 已在画布中的关联（防循环）
      const currentSet = useCanvasStore.getState().nodeIdSet
      const newRelations = relations.filter((r) => !currentSet.has(r.target))

      // 构建 XYFlow 边（所有关联，包括已存在 target 的边也要加）
      const buildEdges = (rels) =>
        rels.map((r) => ({
          id: `${r.source}->${r.target}:${r.path}`,
          source: r.source,
          target: r.target,
          label: r.conditionText || undefined,
          style: { stroke: EDGE_COLORS[r.branchType] ?? EDGE_COLORS.default },
          data: { conditionText: r.conditionText, branchType: r.branchType },
        }))

      if (newRelations.length <= 10) {
        // 自动展开一层：加载所有新关联节点
        const loadedNodes = []
        for (const rel of newRelations) {
          const [relType, relId] = rel.target.split(':')
          try {
            const relData = await window.electronAPI.configReadCache(relType, relId)
            if (relData) {
              // 新节点先放在原点，后续 dagre 统一排布
              addNode(relId, relType, { label: relId, nodeType: relType, rawData: relData }, { x: 0, y: 0 })
              loadedNodes.push(rel.target)
            }
          } catch {
            // 缓存不存在时静默跳过
          }
        }

        // 添加所有边（含已存在 target 的边）
        addEdges(buildEdges(relations))

        // 对全部节点应用 dagre 布局（只移动位置为原点的新节点）
        const latestNodes = useCanvasStore.getState().nodes
        const latestEdges = useCanvasStore.getState().edges
        const laid = applyDagreLayout(latestNodes, latestEdges)
        setNodes(laid)
      } else {
        // 关联数 > 10：折叠状态，不自动展开，只添加边到已存在节点
        const existingRelations = relations.filter((r) =>
          useCanvasStore.getState().nodeIdSet.has(r.target)
        )
        addEdges(buildEdges(existingRelations))
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodeIdSet]
  )

  // ── 拖放处理 ──────────────────────────────────────────────────────────────
  const onDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    async (e) => {
      e.preventDefault()
      const raw = e.dataTransfer.getData('application/json')
      if (!raw) return

      let payload
      try {
        payload = JSON.parse(raw)
      } catch {
        return
      }

      const { id, type } = payload
      if (!id || !type) return

      // 计算落点位置（相对于画布）
      const bounds = reactFlowWrapper.current?.getBoundingClientRect()
      const position = bounds
        ? { x: e.clientX - bounds.left, y: e.clientY - bounds.top }
        : { x: 100, y: 100 }

      // 通过 IPC 加载缓存数据
      try {
        const data = await window.electronAPI.configReadCache(type, id)
        if (data) {
          await addNodeWithExpand(id, type, { label: id, nodeType: type, rawData: data }, position)
        }
      } catch {
        // 静默处理
      }
    },
    [addNodeWithExpand]
  )

  // ── 节点点击 ──────────────────────────────────────────────────────────────
  const onNodeClick = useCallback(
    (_e, node) => {
      setSelectedNode(node.id)
      setTooltip(null) // 关闭边 tooltip
    },
    [setSelectedNode]
  )

  // ── 边点击：显示 conditionText tooltip ───────────────────────────────────
  const onEdgeClick = useCallback((e, edge) => {
    const text = edge.data?.conditionText
    if (!text) return
    setTooltip({ x: e.clientX, y: e.clientY, text })
  }, [])

  // ── 点击画布空白处关闭 tooltip ────────────────────────────────────────────
  const onPaneClick = useCallback(() => {
    setTooltip(null)
  }, [])

  return (
    <div
      ref={reactFlowWrapper}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges.map((e) => ({
          ...e,
          style: {
            ...e.style,
            opacity: getEdgeOpacity(e),
          },
        }))}
        nodeTypes={nodeTypes}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        fitView
      >
        <Background color="#313244" gap={20} />
        <Controls />
        <MiniMap
          nodeColor="#45475a"
          maskColor="rgba(17,17,27,0.7)"
          style={{ background: '#1e1e2e' }}
        />
      </ReactFlow>

      {/* 边 conditionText 浮动 tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 8,
            top: tooltip.y + 8,
            background: '#313244',
            color: '#cdd6f4',
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 12,
            maxWidth: 300,
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
            zIndex: 9999,
            whiteSpace: 'pre-wrap',
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}

// ── 导出：用 ReactFlowProvider 包裹 ─────────────────────────────────────────
export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}

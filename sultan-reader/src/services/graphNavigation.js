import useCanvasStore from '../stores/useCanvasStore'
import { extractEdges } from './edgeExtractor'

const EDGE_COLORS = { success: '#d3d8a2', failed: '#d9a09a', default: '#d9c7a0' }
const CANVAS_NODE_TYPES = new Set(['rite', 'event', 'loot', 'over'])
const AUTO_EXPAND_TARGET_TYPES = new Set(['event', 'loot', 'rite', 'over'])
const AUTO_EXPAND_LIMIT = 3

function summarize(item, data) {
  return item.name || item.text || data?.name || data?.text || item.id
}

export async function mountNodeOnCanvas(item, position, options = {}) {
  const {
    autoSelect = true,
    expandRelations = false,
    autoExpandLimit = AUTO_EXPAND_LIMIT,
  } = options

  const store = useCanvasStore.getState()
  const nodeKey = `${item.type}:${item.id}`

  if (!CANVAS_NODE_TYPES.has(item.type)) {
    if (autoSelect) {
      store.setSelectedNode(nodeKey, 'panel')
    }
    return nodeKey
  }

  if (store.nodeIdSet.has(nodeKey)) {
    if (autoSelect) {
      store.setSelectedNode(nodeKey)
    }
    return nodeKey
  }

  const data = await window.electronAPI.configReadCache(item.type, item.id)
  if (!data) return null

  const rawData = data?.id != null ? data : { id: String(item.id), ...data }

  store.addNode(item.id, item.type, {
    label: summarize(item, rawData),
    nodeType: item.type,
    rawData,
  }, position)

  if (autoSelect) {
    store.setSelectedNode(nodeKey)
  }

  if (expandRelations) {
    const relations = extractEdges(item.type, item.id, rawData)
      .filter((relation) => {
        const [targetType] = relation.target.split(':')
        return AUTO_EXPAND_TARGET_TYPES.has(targetType)
      })

    if (relations.length > autoExpandLimit) {
      return nodeKey
    }

    const randomizedRelations = [...relations]
      .sort(() => Math.random() - 0.5)
      .slice(0, autoExpandLimit)

    for (let index = 0; index < randomizedRelations.length; index += 1) {
      const relation = randomizedRelations[index]
      const [targetType, targetId] = relation.target.split(':')
      if (!targetType || !targetId) continue

      await mountNodeOnCanvas(
        { id: targetId, type: targetType },
        {
          x: position.x + 220 + (index % 2) * 180,
          y: position.y + 40 + Math.floor(index / 2) * 140,
        },
        { autoSelect: false, expandRelations: false }
      )

      linkNodesOnCanvas(
        nodeKey,
        targetType,
        targetId,
        relation.branchType || 'default',
        relation.conditionText || relation.resultTitle || relation.resultText || ''
      )
    }
  }

  return nodeKey
}

export function linkNodesOnCanvas(sourceNodeKey, targetType, targetId, branchType = 'default', conditionText = '') {
  if (!sourceNodeKey || !targetType || !targetId) return

  const targetNodeKey = `${targetType}:${targetId}`
  const store = useCanvasStore.getState()
  if (!store.nodeIdSet.has(sourceNodeKey) || !store.nodeIdSet.has(targetNodeKey)) return

  const stroke = EDGE_COLORS[branchType] ?? EDGE_COLORS.default
  store.addEdges([{
    id: `${sourceNodeKey}->${targetNodeKey}:manual:${branchType}:${conditionText}`,
    type: 'smoothstep',
    source: sourceNodeKey,
    target: targetNodeKey,
    sourcePosition: 'right',
    targetPosition: 'left',
    style: {
      stroke,
      strokeWidth: 2.4,
      filter: `drop-shadow(0 0 2px ${stroke})`,
    },
    markerEnd: {
      type: 'arrowclosed',
      width: 16,
      height: 16,
      color: stroke,
    },
    pathOptions: {
      borderRadius: 18,
      offset: 18,
    },
    data: {
      conditionText,
      branchType,
      conditionObj: null,
    },
  }])
}

function buildCanvasEdge(sourceNodeKey, targetNodeKey, branchType = 'default', conditionText = '') {
  const stroke = EDGE_COLORS[branchType] ?? EDGE_COLORS.default

  return {
    id: `${sourceNodeKey}->${targetNodeKey}:full:${branchType}:${conditionText}`,
    type: 'smoothstep',
    source: sourceNodeKey,
    target: targetNodeKey,
    sourcePosition: 'right',
    targetPosition: 'left',
    style: {
      stroke,
      strokeWidth: 2.4,
      filter: `drop-shadow(0 0 2px ${stroke})`,
    },
    markerEnd: {
      type: 'arrowclosed',
      width: 16,
      height: 16,
      color: stroke,
    },
    pathOptions: {
      borderRadius: 18,
      offset: 18,
    },
    data: {
      conditionText,
      branchType,
      conditionObj: null,
    },
  }
}

/**
 * 以当前节点为根，整图替换为其完整后续关系图。
 * 只保留画布支持的类型，递归展开所有可继续阅读的后续节点。
 * @param {{ id: string|number, type: string, name?: string }} item
 * @returns {Promise<string|null>}
 */
export async function replaceCanvasWithFullGraph(item) {
  if (!item?.id || !item?.type) return null
  if (!CANVAS_NODE_TYPES.has(item.type)) return null

  const store = useCanvasStore.getState()
  const rootId = String(item.id)
  const rootNodeKey = `${item.type}:${rootId}`
  const openMode = item.type === 'rite' ? 'fullscreen' : 'panel'

  const queue = [{ id: rootId, type: item.type, depth: 0, order: 0 }]
  const visited = new Set()
  const nodes = []
  const edges = []
  const edgeIdSet = new Set()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue

    const nodeKey = `${current.type}:${current.id}`
    if (visited.has(nodeKey)) continue
    visited.add(nodeKey)

    const data = await window.electronAPI.configReadCache(current.type, current.id)
    if (!data) continue

    const rawData = data?.id != null ? data : { id: current.id, ...data }
    nodes.push({
      id: nodeKey,
      type: current.type,
      data: {
        label: summarize(current, rawData),
        nodeType: current.type,
        rawData,
      },
      position: {
        x: 120 + current.depth * 260,
        y: 120 + current.order * 140,
      },
    })

    const relations = extractEdges(current.type, current.id, rawData)
      .filter((relation) => {
        const [targetType] = relation.target.split(':')
        return CANVAS_NODE_TYPES.has(targetType)
      })

    relations.forEach((relation, index) => {
      const [targetType, targetId] = relation.target.split(':')
      if (!targetType || !targetId) return

      const targetNodeKey = `${targetType}:${targetId}`
      const edge = buildCanvasEdge(
        nodeKey,
        targetNodeKey,
        relation.branchType || 'default',
        relation.conditionText || relation.resultTitle || relation.resultText || ''
      )

      if (!edgeIdSet.has(edge.id)) {
        edgeIdSet.add(edge.id)
        edges.push(edge)
      }

      if (!visited.has(targetNodeKey)) {
        queue.push({
          id: targetId,
          type: targetType,
          depth: current.depth + 1,
          order: current.order * 4 + index,
        })
      }
    })
  }

  if (nodes.length === 0) return null

  store.replaceCanvas(nodes, edges, {
    selectedNodeId: rootNodeKey,
    selectedOpenMode: openMode,
  })

  return rootNodeKey
}

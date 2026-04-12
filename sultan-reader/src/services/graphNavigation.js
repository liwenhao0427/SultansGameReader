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

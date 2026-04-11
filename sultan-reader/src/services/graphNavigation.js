import useCanvasStore from '../stores/useCanvasStore'
import { extractEdges } from './edgeExtractor'

const EDGE_COLORS = { success: '#8fbf77', failed: '#c35b5b', default: '#927453' }
const CANVAS_NODE_TYPES = new Set(['rite', 'event', 'loot'])
const AUTO_EXPAND_SOURCE_TYPES = new Set(['event'])
const AUTO_EXPAND_TARGET_TYPES = new Set(['event', 'loot', 'rite'])

function summarize(item, data) {
  return item.name || item.text || data?.name || data?.text || item.id
}

function hasRelatedCanvasTarget(data) {
  return Array.isArray(data?.item) && data.item.some((entry) => (
    CANVAS_NODE_TYPES.has(entry?.type)
  ))
}

export async function mountNodeOnCanvas(item, position, options = {}) {
  const {
    autoSelect = true,
    expandRelations = AUTO_EXPAND_SOURCE_TYPES.has(item.type),
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

  if (item.type === 'loot' && !hasRelatedCanvasTarget(data)) {
    if (autoSelect) {
      store.setSelectedNode(nodeKey, 'panel')
    }
    return nodeKey
  }

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

    for (let index = 0; index < relations.length; index += 1) {
      const relation = relations[index]
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

  store.addEdges([{
    id: `${sourceNodeKey}->${targetNodeKey}:manual:${branchType}:${conditionText}`,
    source: sourceNodeKey,
    target: targetNodeKey,
    style: { stroke: EDGE_COLORS[branchType] ?? EDGE_COLORS.default },
    data: {
      conditionText,
      branchType,
      conditionObj: null,
    },
  }])
}

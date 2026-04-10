import useCanvasStore from '../stores/useCanvasStore'

const EDGE_COLORS = { success: '#8fbf77', failed: '#c35b5b', default: '#927453' }
const CANVAS_NODE_TYPES = new Set(['rite', 'event', 'loot', 'over'])

function summarize(item, data) {
  return item.name || item.text || data?.name || data?.text || item.id
}

function hasRelatedRite(data) {
  return Array.isArray(data?.item) && data.item.some((entry) => entry?.type === 'rite')
}

export async function mountNodeOnCanvas(item, position, options = {}) {
  const {
    autoSelect = true,
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

  if (item.type === 'loot' && !hasRelatedRite(data)) {
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

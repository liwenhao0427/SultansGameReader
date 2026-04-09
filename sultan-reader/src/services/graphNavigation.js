import useCanvasStore from '../stores/useCanvasStore'
import { extractEdges } from './edgeExtractor'

const EDGE_COLORS = { success: '#8fbf77', failed: '#c35b5b', default: '#927453' }

function summarize(item, data) {
  return item.name || item.text || data?.name || data?.text || item.id
}

async function addRelations(relations, sourcePosition, limit = 8) {
  const store = useCanvasStore.getState()
  const candidates = relations
    .filter((relation) => !store.nodeIdSet.has(relation.target))
    .slice(0, limit)

  for (let index = 0; index < candidates.length; index += 1) {
    const relation = candidates[index]
    const [targetType, targetId] = relation.target.split(':')
    try {
      const targetData = await window.electronAPI.configReadCache(targetType, targetId)
      if (!targetData) continue

      store.addNode(targetId, targetType, {
        label: summarize({ id: targetId, type: targetType }, targetData),
        nodeType: targetType,
        rawData: targetData,
      }, {
        x: sourcePosition.x + 210 + (index % 2) * 180,
        y: sourcePosition.y + 90 + Math.floor(index / 2) * 120,
      })
    } catch {
      // 静默跳过无法读取的关联目标
    }
  }
}

export async function mountNodeOnCanvas(item, position, options = {}) {
  const {
    autoSelect = true,
    expandRelations = true,
    relationLimit = 8,
  } = options

  const store = useCanvasStore.getState()
  const nodeKey = `${item.type}:${item.id}`

  if (store.nodeIdSet.has(nodeKey)) {
    if (autoSelect) store.setSelectedNode(nodeKey)
    return nodeKey
  }

  const data = await window.electronAPI.configReadCache(item.type, item.id)
  if (!data) return null

  store.addNode(item.id, item.type, {
    label: summarize(item, data),
    nodeType: item.type,
    rawData: data,
  }, position)

  const relations = extractEdges(item.type, item.id, data)
  store.addEdges(relations.map((relation) => ({
    id: `${relation.source}->${relation.target}:${relation.path}`,
    source: relation.source,
    target: relation.target,
    style: { stroke: EDGE_COLORS[relation.branchType] ?? EDGE_COLORS.default },
    data: {
      conditionText: relation.conditionText,
      branchType: relation.branchType,
      conditionObj: relation.conditionObj,
    },
  })))

  if (expandRelations) {
    await addRelations(relations, position, relationLimit)
  }

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

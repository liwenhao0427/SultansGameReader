import { create } from 'zustand';

/**
 * useCanvasStore
 * 管理画布节点/边状态，节点去重，当前选中节点
 */
const useCanvasStore = create((set, get) => ({
  // XYFlow 节点数组
  nodes: [],

  // XYFlow 边数组
  edges: [],

  // 节点 ID 集合，格式 "{type}:{id}"，用于去重和防循环
  nodeIdSet: new Set(),

  // 当前选中节点 ID
  selectedNodeId: null,

  // 打开模式：'panel'（右侧面板）或 'fullscreen'（全屏阅读器）
  selectedOpenMode: 'panel',

  /**
   * 添加节点（去重）
   * @param {string} id - 原始 ID（如 "5300000"）
   * @param {string} type - 节点类型（如 "event"）
   * @param {object} data - 节点数据 { label, nodeType, rawData }
   * @param {{ x: number, y: number }} position - 节点位置
   */
  addNode: (id, type, data, position) => {
    const nodeId = `${type}:${id}`;
    const { nodeIdSet, nodes } = get();

    // 已存在则跳过
    if (nodeIdSet.has(nodeId)) return;

    const newSet = new Set(nodeIdSet);
    newSet.add(nodeId);

    set({
      nodeIdSet: newSet,
      nodes: [
        ...nodes,
        {
          id: nodeId,
          type,
          data,
          position,
        },
      ],
    });
  },

  /**
   * 批量添加边（去重：已存在的 edge.id 跳过）
   * @param {Array} newEdges - XYFlow Edge 数组
   */
  addEdges: (newEdges) => {
    const { edges } = get();
    const existingIds = new Set(edges.map((e) => e.id));
    const toAdd = newEdges.filter((e) => !existingIds.has(e.id));
    if (toAdd.length === 0) return;
    set({ edges: [...edges, ...toAdd] });
  },

  /**
   * 覆盖设置节点数组
   * 用于 React Flow 拖拽、自动布局后的受控更新
   * @param {Array} nodes
   */
  setNodes: (nodes) => {
    set({ nodes });
  },

  /**
   * 整体替换画布内容
   * @param {Array} nodes
   * @param {Array} edges
   * @param {{ selectedNodeId?: string|null, selectedOpenMode?: 'panel'|'fullscreen' }} options
   */
  replaceCanvas: (nodes, edges, options = {}) => {
    const {
      selectedNodeId = null,
      selectedOpenMode = 'panel',
    } = options;

    set({
      nodes,
      edges,
      nodeIdSet: new Set(nodes.map((node) => node.id)),
      selectedNodeId,
      selectedOpenMode,
    });
  },

  /**
   * 设置当前选中节点
   * @param {string | null} id - 节点 ID（"{type}:{id}" 格式）
   * @param {'panel'|'fullscreen'} openMode - 打开模式，默认 'panel'
   */
  setSelectedNode: (id, openMode = 'panel') => {
    set({ selectedNodeId: id, selectedOpenMode: openMode });
  },

  /**
   * 移除节点及其所有关联边，同时从 nodeIdSet 中删除
   * @param {string} id - 节点 ID（"{type}:{id}" 格式）
   */
  removeNode: (id) => {
    const { nodes, edges, nodeIdSet } = get();
    const newSet = new Set(nodeIdSet);
    newSet.delete(id);

    set({
      nodeIdSet: newSet,
      nodes: nodes.filter((n) => n.id !== id),
      edges: edges.filter((e) => e.source !== id && e.target !== id),
    });
  },

  /**
   * 按当前有向边移除节点及其签出的所有后续子树
   * @param {string} rootId - 根节点 ID（"{type}:{id}" 格式）
   */
  removeNodeTree: (rootId) => {
    const { nodes, edges, nodeIdSet, selectedNodeId } = get();
    if (!rootId || !nodeIdSet.has(rootId)) return;

    const adjacency = new Map();
    edges.forEach((edge) => {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
      adjacency.get(edge.source).push(edge.target);
    });

    const removedIds = new Set([rootId]);
    const queue = [rootId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId) continue;
      (adjacency.get(currentId) || []).forEach((nextId) => {
        if (!removedIds.has(nextId)) {
          removedIds.add(nextId);
          queue.push(nextId);
        }
      });
    }

    const nextNodeIdSet = new Set(nodeIdSet);
    removedIds.forEach((id) => nextNodeIdSet.delete(id));

    set({
      nodeIdSet: nextNodeIdSet,
      nodes: nodes.filter((node) => !removedIds.has(node.id)),
      edges: edges.filter((edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target)),
      selectedNodeId: removedIds.has(selectedNodeId) ? null : selectedNodeId,
    });
  },

  /**
   * 清空所有节点和边
   */
  clearCanvas: () => {
    set({
      nodes: [],
      edges: [],
      nodeIdSet: new Set(),
      selectedNodeId: null,
    });
  },
}));

export default useCanvasStore;

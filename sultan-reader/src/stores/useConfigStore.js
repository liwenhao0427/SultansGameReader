import { create } from 'zustand';

/**
 * useConfigStore
 * 管理全局配置数据：卡牌映射、计数器注册表、索引统计
 */
const useConfigStore = create((set) => ({
  // 卡牌 id → name 精简映射（供 conditionParser 解析 have.卡牌ID）
  cardsLite: new Map(),

  // 卡牌完整数据，供阅读器展示手牌图片与标题
  cardsById: {},

  // 计数器注册表：id → { id, comment, defaultValue }
  counterRegistry: new Map(),

  // 各类型缓存文件数量统计
  indexStats: {},

  // 是否已完成初始化
  isLoaded: false,

  /**
   * 初始化：加载索引统计和卡牌映射
   */
  initialize: async () => {
    // 构建搜索索引，获取各类型文件数量统计
    const stats = await window.electronAPI.configBuildIndex();
    // 获取 id→name 精简卡牌映射
    const cardsObj = await window.electronAPI.configGetCardsLite();
    const cardsFull = await window.electronAPI.configReadCache('single', 'cards');

    set({
      indexStats: stats,
      cardsLite: new Map(Object.entries(cardsObj)),
      cardsById: cardsFull || {},
      isLoaded: true,
    });
  },

  /**
   * 扫描多种类型的缓存文件，提取所有 counter.\d+ 格式的 key，构建计数器注册表
   * 扫描类型：event、rite、after_story、loot
   */
  buildCounterRegistry: async () => {
    const registry = new Map();
    // 需要扫描的缓存类型
    const types = ['event', 'rite', 'after_story', 'loot'];

    for (const type of types) {
      let entries;
      try {
        entries = await window.electronAPI.configListCache(type);
      } catch {
        continue;
      }

      // 逐个读取缓存文件，提取计数器 key
      for (const entry of entries) {
        let data;
        try {
          data = await window.electronAPI.configReadCache(type, entry.id);
        } catch {
          continue;
        }
        // 递归提取对象中所有 counter.\d+ 格式的 key
        extractCounterKeys(data, registry);
      }
    }

    set({ counterRegistry: registry });
  },
}));

/**
 * 递归遍历对象，提取 counter.\d+ 格式的 key
 * @param {any} obj - 待遍历的对象
 * @param {Map} registry - 计数器注册表（累积写入）
 */
function extractCounterKeys(obj, registry) {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    obj.forEach((item) => extractCounterKeys(item, registry));
    return;
  }

  for (const key of Object.keys(obj)) {
    // 匹配 counter.\d+ 开头的 key（含 >=、<、= 等后缀）
    const match = key.match(/^counter[.+-](\d+)/);
    if (match) {
      const id = match[1];
      if (!registry.has(id)) {
        // 尝试从同名 __c 注释字段获取注释
        const comment = obj[`${key}__c`] ?? null;
        registry.set(id, { id, comment, defaultValue: 0 });
      }
    }
    // 递归处理子对象
    extractCounterKeys(obj[key], registry);
  }
}

export default useConfigStore;

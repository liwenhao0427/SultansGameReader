import { create } from 'zustand';
import { BUILTIN_COUNTER_LABELS, resolveCounterLabel } from '../constants/counterMetadata'

/**
 * useConfigStore
 * 管理全局配置数据：卡牌映射、计数器注册表、索引统计
 */
const useConfigStore = create((set) => ({
  // 卡牌 id → name 精简映射（供 conditionParser 解析 have.卡牌ID）
  cardsLite: new Map(),

  // 卡牌完整数据，供阅读器展示手牌图片与标题
  cardsById: {},

  // 计数器注册表：id → { id, comment, displayName, defaultValue, scope, sources }
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
    const fallbackCardsLite = Object.fromEntries(
      Object.values(cardsFull || {})
        .filter((card) => card && card.id != null && card.name != null)
        .map((card) => [String(card.id), card.name])
    );

    set({
      indexStats: stats,
      cardsLite: new Map(Object.entries(
        cardsObj && Object.keys(cardsObj).length > 0 ? cardsObj : fallbackCardsLite
      )),
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
        extractCounterKeys(data, registry, type);
      }
    }

    for (const [id, label] of Object.entries(BUILTIN_COUNTER_LABELS)) {
      mergeCounterMeta(registry, id, {
        comment: label,
        displayName: label,
        scope: 'builtin',
        source: 'builtin',
      })
    }

    set({ counterRegistry: registry });
  },
}));

/**
 * 递归遍历对象，提取 counter.\d+ 格式的 key
 * @param {any} obj - 待遍历的对象
 * @param {Map} registry - 计数器注册表（累积写入）
 */
function extractCounterKeys(obj, registry, sourceType = 'unknown') {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    obj.forEach((item) => extractCounterKeys(item, registry, sourceType));
    return;
  }

  for (const key of Object.keys(obj)) {
    // 匹配条件和动作中的局内/全局计数器写法
    const match = key.match(/^(counter|global_counter)(?:[.+=-])(\d+)/);
    if (match) {
      const scope = match[1] === 'global_counter' ? 'global' : 'local'
      const id = match[2];
      const comment = obj[`${key}__c`] ?? obj[`${key}__ca`] ?? obj[`${key}__ci`] ?? null;
      mergeCounterMeta(registry, id, {
        comment,
        displayName: resolveCounterLabel(id, comment || ''),
        defaultValue: 0,
        scope,
        source: sourceType,
      })
    }
    // 递归处理子对象
    extractCounterKeys(obj[key], registry, sourceType);
  }
}

function mergeCounterMeta(registry, id, payload) {
  const prev = registry.get(id) || {
    id,
    comment: null,
    displayName: resolveCounterLabel(id),
    defaultValue: 0,
    scope: payload.scope || 'local',
    sources: [],
  }

  const nextSources = new Set([...(prev.sources || []), payload.source].filter(Boolean))
  registry.set(id, {
    ...prev,
    ...payload,
    comment: payload.comment || prev.comment || null,
    displayName: payload.displayName || prev.displayName || resolveCounterLabel(id, payload.comment || prev.comment || ''),
    scope: payload.scope || prev.scope || 'local',
    sources: [...nextSources].sort(),
  })
}

export default useConfigStore;

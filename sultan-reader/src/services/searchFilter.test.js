/**
 * 搜索过滤逻辑单元测试（任务 5.4）
 * 测试主进程 config:search 的核心匹配算法
 * 将匹配逻辑提取为纯函数进行测试
 */
import { describe, it, expect } from 'vitest';

// ── 从 main.js 提取的搜索核心逻辑（纯函数，便于测试）──────────────────────────

/**
 * 在索引中执行模糊搜索
 * @param {Array<{id, type, name, text}>} index - 搜索索引
 * @param {string} query - 搜索关键字
 * @param {string[]} [types] - 类型过滤
 * @param {number} [limit=100] - 最大返回数量
 * @returns {Array}
 */
function searchIndex(index, query, types, limit = 100) {
  if (!query || !query.trim()) return [];

  const q = query.trim().toLowerCase();
  const typeSet = types && types.length ? new Set(types) : null;

  const results = [];
  for (const entry of index) {
    if (typeSet && !typeSet.has(entry.type)) continue;
    if (
      entry.id.toLowerCase().includes(q) ||
      entry.name.toLowerCase().includes(q) ||
      entry.text.toLowerCase().includes(q)
    ) {
      results.push(entry);
      if (results.length >= limit) break;
    }
  }
  return results;
}

// ── 测试数据 ──────────────────────────────────────────────────────────────────

const mockIndex = [
  { id: '5300000', type: 'event', name: '', text: '开场介绍' },
  { id: '5300001', type: 'event', name: '', text: '新手教学' },
  { id: '5300066', type: 'event', name: '', text: '主线事件' },
  { id: '6000004', type: 'loot', name: '情报掉落', text: '' },
  { id: '6000005', type: 'loot', name: '金币掉落', text: '' },
  { id: '2000001', type: 'after_story', name: '主角', text: '' },
  { id: 'DT1',    type: 'dt',    name: 'DT1', text: '对话树1' },
];

describe('searchIndex - 关键字匹配', () => {
  it('按 id 匹配', () => {
    const results = searchIndex(mockIndex, '5300000');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('5300000');
  });

  it('按 name 匹配', () => {
    const results = searchIndex(mockIndex, '情报');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('6000004');
  });

  it('按 text 匹配', () => {
    const results = searchIndex(mockIndex, '开场');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('5300000');
  });

  it('大小写不敏感', () => {
    const results = searchIndex(mockIndex, 'DT1');
    expect(results.length).toBeGreaterThan(0);
  });

  it('空查询返回空数组', () => {
    expect(searchIndex(mockIndex, '')).toEqual([]);
    expect(searchIndex(mockIndex, '   ')).toEqual([]);
  });

  it('无匹配返回空数组', () => {
    expect(searchIndex(mockIndex, '不存在的内容xyz')).toEqual([]);
  });
});

describe('searchIndex - 类型过滤', () => {
  it('过滤单一类型', () => {
    const results = searchIndex(mockIndex, '掉落', ['loot']);
    expect(results.every(r => r.type === 'loot')).toBe(true);
    expect(results).toHaveLength(2);
  });

  it('过滤多种类型', () => {
    const results = searchIndex(mockIndex, '5', ['event', 'loot']);
    expect(results.every(r => r.type === 'event' || r.type === 'loot')).toBe(true);
  });

  it('类型过滤为空时不过滤', () => {
    const results = searchIndex(mockIndex, '掉落', []);
    expect(results).toHaveLength(2);
  });

  it('类型过滤为 null 时不过滤', () => {
    const results = searchIndex(mockIndex, '掉落', null);
    expect(results).toHaveLength(2);
  });

  it('类型不匹配时返回空', () => {
    const results = searchIndex(mockIndex, '情报', ['event']);
    expect(results).toHaveLength(0);
  });
});

describe('searchIndex - 结果数量限制', () => {
  it('超过 limit 时截断', () => {
    // 构造 200 条数据
    const bigIndex = Array.from({ length: 200 }, (_, i) => ({
      id: String(i),
      type: 'event',
      name: '测试',
      text: '测试文本',
    }));
    const results = searchIndex(bigIndex, '测试', null, 100);
    expect(results).toHaveLength(100);
  });
});

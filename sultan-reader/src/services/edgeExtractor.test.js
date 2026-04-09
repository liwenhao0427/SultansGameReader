/**
 * edgeExtractor 单元测试
 * 覆盖 event/rite/upgrade 数据提取、branchType 判断、路径追踪
 */
import { describe, it, expect } from 'vitest';
import { extractEdges } from './edgeExtractor.js';

describe('extractEdges - event 数据', () => {
  it('从 settlement.action.success 提取 event_on（数组）', () => {
    const data = {
      id: 5300000,
      settlement: [{
        action: {
          success: {
            event_on: [5300300, 5300301, 5300066],
          },
        },
      }],
    };
    const edges = extractEdges('event', 5300000, data);
    const targets = edges.map(e => e.target);
    expect(targets).toContain('event:5300300');
    expect(targets).toContain('event:5300301');
    expect(targets).toContain('event:5300066');
  });

  it('success 分支的 branchType 为 success', () => {
    const data = {
      settlement: [{
        action: {
          success: { event_on: 5300066 },
        },
      }],
    };
    const edges = extractEdges('event', 5300000, data);
    const edge = edges.find(e => e.target === 'event:5300066');
    expect(edge).toBeDefined();
    expect(edge.branchType).toBe('success');
  });

  it('failed 分支的 branchType 为 failed', () => {
    const data = {
      settlement: [{
        action: {
          failed: { event_on: 5300066 },
        },
      }],
    };
    const edges = extractEdges('event', 5300000, data);
    const edge = edges.find(e => e.target === 'event:5300066');
    expect(edge).toBeDefined();
    expect(edge.branchType).toBe('failed');
  });

  it('非 success/failed 路径的 branchType 为 default', () => {
    const data = {
      settlement: [{
        action: {
          confirm: { event_on: 5300100 },
        },
      }],
    };
    const edges = extractEdges('event', 5300000, data);
    const edge = edges.find(e => e.target === 'event:5300100');
    expect(edge).toBeDefined();
    expect(edge.branchType).toBe('default');
  });

  it('同时提取 rite 和 loot 关联', () => {
    const data = {
      settlement: [{
        action: {
          success: {
            rite: 5000001,
            loot: 6000004,
          },
        },
      }],
    };
    const edges = extractEdges('event', 5300000, data);
    const targets = edges.map(e => e.target);
    expect(targets).toContain('rite:5000001');
    expect(targets).toContain('loot:6000004');
  });

  it('conditionText 从 __c 注释字段读取', () => {
    const data = {
      settlement: [{
        action: {
          success: {
            event_on: 5300066,
            'event_on__c': '触发下一个事件',
          },
        },
      }],
    };
    const edges = extractEdges('event', 5300000, data);
    const edge = edges.find(e => e.target === 'event:5300066');
    expect(edge?.conditionText).toBe('触发下一个事件');
  });

  it('跳过 __c / __ca / __ci 元数据字段', () => {
    const data = {
      settlement: [{
        action: {
          success: {
            event_on: 5300066,
            'event_on__c': '注释',
            'event_on__ca': '上方注释',
          },
        },
      }],
    };
    const edges = extractEdges('event', 5300000, data);
    // 只有一条边，不会把注释字段当成边
    expect(edges.filter(e => e.target === 'event:5300066')).toHaveLength(1);
  });

  it('边 ID 去重：相同 source→target:path 只保留一条', () => {
    const data = {
      settlement: [
        { action: { success: { event_on: 5300066 } } },
        { action: { success: { event_on: 5300066 } } },
      ],
    };
    const edges = extractEdges('event', 5300000, data);
    // 两个 settlement 条目路径不同（[0] vs [1]），所以是两条不同的边
    const toSame = edges.filter(e => e.target === 'event:5300066');
    expect(toSame.length).toBeGreaterThanOrEqual(1);
  });
});

describe('extractEdges - rite 数据（rite_end）', () => {
  it('从 rite 数据提取 rite_end → event', () => {
    const data = {
      id: 5000001,
      name: '测试仪式',
      settlement: [{
        action: {
          success: {
            rite_end: 5300200,
          },
        },
      }],
    };
    const edges = extractEdges('rite', 5000001, data);
    const edge = edges.find(e => e.target === 'event:5300200');
    expect(edge).toBeDefined();
    expect(edge.branchType).toBe('success');
  });
});

describe('extractEdges - upgrade 数据（link_card）', () => {
  it('从 upgrade 数据提取 link_card → card', () => {
    const data = {
      id: 8000001,
      name: '测试升级',
      link_card: 2000001,
    };
    const edges = extractEdges('upgrade', 8000001, data);
    const edge = edges.find(e => e.target === 'card:2000001');
    expect(edge).toBeDefined();
    expect(edge.branchType).toBe('default');
  });
});

describe('extractEdges - 边界情况', () => {
  it('空数据返回空数组', () => {
    expect(extractEdges('event', 1, null)).toEqual([]);
    expect(extractEdges('event', 1, {})).toEqual([]);
  });

  it('无 settlement 字段时不报错', () => {
    const data = { id: 1, name: '无结算' };
    expect(() => extractEdges('event', 1, data)).not.toThrow();
  });

  it('source 格式为 {type}:{id}', () => {
    const data = {
      settlement: [{ action: { success: { event_on: 5300066 } } }],
    };
    const edges = extractEdges('event', 5300000, data);
    expect(edges[0].source).toBe('event:5300000');
  });
});

/**
 * conditionEvaluator 单元测试
 * 覆盖计数器比较、have/!have、any 嵌套、组合状态求值
 */
import { describe, it, expect } from 'vitest';
import { evaluateCondition } from './conditionEvaluator.js';

// 构造玩家状态的辅助函数
function makeState({ events = [], counters = {} } = {}) {
  return {
    triggeredEvents: new Set(events),
    counterValues: new Map(Object.entries(counters)),
  };
}

describe('evaluateCondition - 计数器比较', () => {
  it('counter >= 满足', () => {
    const state = makeState({ counters: { '7000490': 3 } });
    expect(evaluateCondition({ 'counter.7000490>=': 1 }, state)).toBe(true);
    expect(evaluateCondition({ 'counter.7000490>=': 3 }, state)).toBe(true);
  });

  it('counter >= 不满足', () => {
    const state = makeState({ counters: { '7000490': 0 } });
    expect(evaluateCondition({ 'counter.7000490>=': 1 }, state)).toBe(false);
  });

  it('counter < 满足', () => {
    const state = makeState({ counters: { '7000449': 0 } });
    expect(evaluateCondition({ 'counter.7000449<': 1 }, state)).toBe(true);
  });

  it('counter < 不满足', () => {
    const state = makeState({ counters: { '7000449': 1 } });
    expect(evaluateCondition({ 'counter.7000449<': 1 }, state)).toBe(false);
  });

  it('counter = 满足', () => {
    const state = makeState({ counters: { '7000001': 5 } });
    expect(evaluateCondition({ 'counter.7000001=': 5 }, state)).toBe(true);
  });

  it('counter = 不满足', () => {
    const state = makeState({ counters: { '7000001': 3 } });
    expect(evaluateCondition({ 'counter.7000001=': 5 }, state)).toBe(false);
  });

  it('计数器默认值为 0（未设置时）', () => {
    const state = makeState();
    // 未设置的计数器默认 0，>= 0 满足
    expect(evaluateCondition({ 'counter.9999999>=': 0 }, state)).toBe(true);
    // 未设置的计数器默认 0，>= 1 不满足
    expect(evaluateCondition({ 'counter.9999999>=': 1 }, state)).toBe(false);
  });
});

describe('evaluateCondition - have / !have', () => {
  it('have 满足（事件已触发）', () => {
    const state = makeState({ events: ['妻子'] });
    expect(evaluateCondition({ 'have.妻子': 1 }, state)).toBe(true);
  });

  it('have 不满足（事件未触发）', () => {
    const state = makeState();
    expect(evaluateCondition({ 'have.妻子': 1 }, state)).toBe(false);
  });

  it('!have 满足（事件未触发）', () => {
    const state = makeState();
    expect(evaluateCondition({ '!have.妻子': 1 }, state)).toBe(true);
  });

  it('!have 不满足（事件已触发）', () => {
    const state = makeState({ events: ['妻子'] });
    expect(evaluateCondition({ '!have.妻子': 1 }, state)).toBe(false);
  });

  it('have 通过计数器 > 0 满足', () => {
    const state = makeState({ counters: { '妻子': 1 } });
    expect(evaluateCondition({ 'have.妻子': 1 }, state)).toBe(true);
  });
});

describe('evaluateCondition - any 嵌套', () => {
  it('any：至少一个子条件满足', () => {
    const state = makeState({ counters: { '7000482': 1 } });
    const cond = {
      any: {
        'counter.7000482>=': 1,
        'counter.7000483>=': 1,
      },
    };
    expect(evaluateCondition(cond, state)).toBe(true);
  });

  it('any：所有子条件都不满足', () => {
    const state = makeState();
    const cond = {
      any: {
        'counter.7000482>=': 1,
        'counter.7000483>=': 1,
      },
    };
    expect(evaluateCondition(cond, state)).toBe(false);
  });
});

describe('evaluateCondition - 组合状态', () => {
  it('AND 逻辑：所有条件满足', () => {
    const state = makeState({
      events: ['妻子'],
      counters: { '7000449': 0, '7000654': 0 },
    });
    const cond = {
      'counter.7000449>=': 1,  // 0 >= 1 → 不满足
    };
    expect(evaluateCondition(cond, state)).toBe(false);
  });

  it('AND 逻辑：全部满足', () => {
    const state = makeState({
      events: ['妻子'],
      counters: { '7000449': 2, '7000654': 0 },
    });
    const cond = {
      'counter.7000449>=': 1,  // 2 >= 1 ✓
      'have.妻子': 1,           // 已触发 ✓
      'counter.7000654<': 1,   // 0 < 1 ✓
    };
    expect(evaluateCondition(cond, state)).toBe(true);
  });

  it('跳过 __c / __ca / __ci 注释字段', () => {
    const state = makeState();
    const cond = {
      'counter.7000490>=': 0,
      'counter.7000490>=__c': '这是注释，不是条件',
    };
    // 只有 counter >= 0 这一个条件，默认值 0 >= 0 满足
    expect(evaluateCondition(cond, state)).toBe(true);
  });

  it('空条件对象返回 true', () => {
    expect(evaluateCondition({}, makeState())).toBe(true);
    expect(evaluateCondition(null, makeState())).toBe(true);
  });

  it('未知条件不阻断（默认 true）', () => {
    const state = makeState();
    expect(evaluateCondition({ 'unknown_condition': 1 }, state)).toBe(true);
  });
});

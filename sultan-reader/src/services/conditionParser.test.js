/**
 * conditionParser 单元测试
 * 覆盖所有条件模式、注释优先级、any 递归、未知 key 回退
 */
import { describe, it, expect } from 'vitest';
import { parseCondition, parseConditionObject } from './conditionParser.js';

// 测试用卡牌映射
const cardsMap = new Map([
  ['妻子', '妻子'],
  ['2000001', '主角'],
  ['2000172', '弑君计划卡'],
]);

describe('parseCondition', () => {
  it('注释优先级：有 comment 时直接返回注释文本', () => {
    expect(parseCondition('counter.7000490>=', 1, '方便结局检定', cardsMap))
      .toBe('方便结局检定');
  });

  it('have.<cardId> → 拥有 [卡牌名]', () => {
    expect(parseCondition('have.妻子', 1, null, cardsMap)).toBe('拥有 妻子');
    // 找不到卡牌名时显示原始 ID
    expect(parseCondition('have.未知卡', 1, null, cardsMap)).toBe('拥有 未知卡');
  });

  it('!have.<cardId> → 不拥有 [卡牌名]', () => {
    expect(parseCondition('!have.妻子', 1, null, cardsMap)).toBe('不拥有 妻子');
  });

  it('counter.<id>>=  → 计数器 ≥ 值', () => {
    expect(parseCondition('counter.7000490>=', 1, null, cardsMap)).toBe('计数器 ≥ 1');
  });

  it('counter.<id>< → 计数器 < 值', () => {
    expect(parseCondition('counter.7000449<', 1, null, cardsMap)).toBe('计数器 < 1');
  });

  it('counter.<id>= → 计数器 = 值', () => {
    expect(parseCondition('counter.7000001=', 5, null, cardsMap)).toBe('计数器 = 5');
  });

  it('counter+<id> → 计数器 +值', () => {
    expect(parseCondition('counter+7000001', 3, null, cardsMap)).toBe('计数器 +3');
  });

  it('counter-<id> → 计数器 -值', () => {
    expect(parseCondition('counter-7000001', 2, null, cardsMap)).toBe('计数器 -2');
  });

  it('table_have.<t>.<f> → 表 [t] 存在 [f]', () => {
    expect(parseCondition('table_have.2000366.目的地', 1, null, cardsMap))
      .toBe('表 2000366 存在 目的地');
  });

  it('s<d>.is → 卡位 [d] 是 [卡牌名]', () => {
    // value 是卡牌 ID，从 cardsMap 查找名称
    expect(parseCondition('s1.is', '2000001', null, cardsMap)).toBe('卡位 1 是 主角');
    // 找不到时显示原始 ID
    expect(parseCondition('s2.is', '9999999', null, cardsMap)).toBe('卡位 2 是 9999999');
  });

  it('r<d>:<attr>+<attr>>= → 检定 [属性] ≥ 值', () => {
    expect(parseCondition('r1:力量+敏捷>=', 10, null, cardsMap)).toBe('检定 力量+敏捷 ≥ 10');
  });

  it('未知 key → 返回原始 key 名', () => {
    expect(parseCondition('unknown_key', 1, null, cardsMap)).toBe('unknown_key');
  });
});

describe('parseConditionObject', () => {
  it('空对象返回空数组', () => {
    expect(parseConditionObject({}, cardsMap)).toEqual([]);
    expect(parseConditionObject(null, cardsMap)).toEqual([]);
  });

  it('跳过 __c / __ca / __ci 后缀字段', () => {
    const obj = {
      'have.妻子': 1,
      'have.妻子__c': '妻子存活',
      'counter.7000490>=': 1,
      'counter.7000490>=__c': '方便结局检定',
    };
    const result = parseConditionObject(obj, cardsMap);
    // 只有两个实际条件，注释字段被跳过
    expect(result).toHaveLength(2);
  });

  it('__c 注释优先于 key 名解析', () => {
    const obj = {
      'counter.7000490>=': 1,
      'counter.7000490>=__c': '方便结局检定',
    };
    const result = parseConditionObject(obj, cardsMap);
    expect(result[0]).toBe('方便结局检定');
  });

  it('any 递归解析 → 满足任意一项: [子条件]', () => {
    const obj = {
      any: {
        'have.2000001': 1,
        'have.妻子': 1,
      },
    };
    const result = parseConditionObject(obj, cardsMap);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('满足任意一项');
    expect(result[0]).toContain('拥有 主角');
    expect(result[0]).toContain('拥有 妻子');
  });

  it('多条件混合解析', () => {
    const obj = {
      'counter.7000449>=': 1,
      'counter.7000449>=__c': '主角没有参与果实',
      '!have.妻子': 1,
    };
    const result = parseConditionObject(obj, cardsMap);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('主角没有参与果实');
    expect(result[1]).toBe('不拥有 妻子');
  });
});

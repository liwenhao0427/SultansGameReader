import { describe, expect, it } from 'vitest'
import { parseCondition, parseConditionObject, parseEffect, parseEffectObject } from './conditionParser'

describe('conditionParser', () => {
  const cardsMap = new Map([
    ['2000193', '雨之子-下卷'],
    ['2000172', '弑君计划'],
  ])

  it('优先使用条件注释，并为 counter < 提供否定语义', () => {
    expect(parseCondition('counter.7000013<', 1, null, cardsMap)).toBe('还没有：计数器 7000013')
    expect(parseCondition('counter.7000013<', 1, '标识这个套路已用过', cardsMap)).toBe('标识这个套路已用过')
  })

  it('能解析完整条件对象', () => {
    expect(parseConditionObject({
      's2.is': 2000193,
      'counter.7000013<': 1,
      'counter.7000013<__c': '标识这个套路已用过',
      'have.2000172.正当性': 1,
    }, cardsMap)).toEqual([
      'S2 是 雨之子-下卷',
      '标识这个套路已用过',
      '拥有 弑君计划（正当性）',
    ])
  })

  it('优先使用结果注释，并为常见结果提供可读文本', () => {
    expect(parseEffect('counter+7000013', 1, '标识这个套路已用过', cardsMap)).toBe('标识这个套路已用过')
    expect(parseEffect('clean.s4', 1, null, cardsMap)).toBe('清除卡槽 S4')
    expect(parseEffect('s2-已拥有', 1, null, cardsMap)).toBe('S2 移除已拥有')
    expect(parseEffect('s1+智慧', 1, null, cardsMap)).toBe('S1 智慧 + 1')
  })

  it('能解析完整结果对象', () => {
    expect(parseEffectObject({
      'global_counter+7200009': 1,
      'global_counter+7200009__c': '完成剧情目标【讨她欢心】之一',
      's2-已拥有': 1,
      'clean.s4': 1,
      'clean.s4__c': '消除妻子的不满',
      's1+智慧': 1,
      'counter+7000013': 1,
      'counter+7000013__c': '标识这个套路已用过',
    }, cardsMap)).toEqual([
      '完成剧情目标【讨她欢心】之一',
      'S2 移除已拥有',
      '消除妻子的不满',
      'S1 智慧 + 1',
      '标识这个套路已用过',
    ])
  })
})

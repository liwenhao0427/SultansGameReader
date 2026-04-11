import { describe, expect, it } from 'vitest'
import { parseCondition, parseConditionObject, parseEffect, parseEffectObject } from './conditionParser'

const cardsMap = new Map([
  ['2000001', '阿尔图'],
  ['2000006', '梅姬'],
])

describe('conditionParser', () => {
  it('优先使用内置计数器常量作为展示名', () => {
    expect(parseCondition('counter.7100001>=', 10, null, cardsMap)).toContain('善名')
    expect(parseEffect('counter+7100006', 1, null, cardsMap)).toContain('金骰子次数')
  })

  it('可以展示文档里的通用条件写法', () => {
    expect(parseCondition('table_have.2000001.魅力', 3, null, cardsMap)).toContain('闲置区存在')
    expect(parseCondition('hand_have.char', 1, null, cardsMap)).toContain('手牌区存在')
    expect(parseCondition('rite', 5000001, null, cardsMap)).toContain('存在 仪式')
    expect(parseCondition('s1.type', 'item', null, cardsMap)).toContain('S1')
    expect(parseCondition('r1:s1.战斗+s2.体魄>=', [1, 5], null, cardsMap)).toContain('骰子检定')
    expect(parseCondition('f:战斗+体魄>=', 5, null, cardsMap)).toContain('公式检定')
  })

  it('可以解析 any/all 复合条件', () => {
    const lines = parseConditionObject({
      any: {
        is: 2000001,
        'counter.7100001>=': 5,
      },
      all: {
        'table_have.2000006': 1,
      },
    }, cardsMap)

    expect(lines.some((line) => line.includes('满足任意一项'))).toBe(true)
    expect(lines.some((line) => line.includes('闲置区存在'))).toBe(true)
  })

  it('可以展示文档里的关键动作写法', () => {
    expect(parseEffect('event_on', 5300001, null, cardsMap)).toContain('激活幕后')
    expect(parseEffect('loot', [6000071, 6000073], null, cardsMap)).toContain('掉落池')
    expect(parseEffect('clean.rite', 1, null, cardsMap)).toContain('移除所有仪式')
    expect(parseEffect('s1+战斗', 3, null, cardsMap)).toContain('增加')
    expect(parseEffect('s1+s2', 1, null, cardsMap)).toContain('装备到')
    expect(parseEffect('table.clean.妻子', 1, null, cardsMap)).toContain('移除闲置卡牌')
    expect(parseEffect('loot.已拥有+1', 6000071, null, cardsMap)).toContain('附加')
    expect(parseEffect('delay', { id: 1, round: 3, rite: 5000001 }, null, cardsMap)).toContain('3 回合后')
    expect(parseEffect('no_prompt', { card: 2000001 }, null, cardsMap)).toContain('隐藏执行')
  })

  it('可以解析结果对象中的嵌套动作', () => {
    const lines = parseEffectObject({
      success: {
        event_on: 5300001,
      },
      failed: {
        prompt: {
          id: 'p1',
          text: '失败了',
        },
      },
    }, cardsMap)

    expect(lines.some((line) => line.includes('前一动作成功后'))).toBe(true)
    expect(lines.some((line) => line.includes('前一动作失败后'))).toBe(true)
  })
})

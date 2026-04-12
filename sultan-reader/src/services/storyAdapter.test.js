import { describe, expect, test } from 'vitest'
import { adaptStoryData } from './storyAdapter'

describe('storyAdapter', () => {
  test('槽位条件中的唯一角色卡不会扩展成全部角色候选', () => {
    const cardsMap = new Map([
      ['2000123', '莎姬'],
      ['2000456', '流浪剑客'],
    ])
    const cardsById = {
      '2000123': { id: 2000123, name: '莎姬', type: 'char', rare: 1, resource: ['cards/2000123.png'] },
      '2000456': { id: 2000456, name: '流浪剑客', type: 'char', rare: 1, resource: ['cards/2000456.png'] },
    }
    const rite = {
      id: 5000157,
      name: '黄沙之战',
      cards_slot: {
        s2: {
          condition: {
            type: 'char',
            is: 2000123,
          },
          is_empty: 1,
          text: '鲁梅拉',
        },
      },
    }

    const model = adaptStoryData('rite', rite, cardsMap, cardsById)
    const slot = model.slots.find((entry) => entry.id === 's2')

    expect(slot).toBeTruthy()
    expect(slot.candidates).toHaveLength(1)
    expect(slot.candidates[0].cards).toHaveLength(1)
    expect(slot.candidates[0].cards[0].id).toBe('2000123')
    expect(slot.candidates[0].label).toContain('莎姬')
  })

  test('any 条件中的 is 固定卡牌与 cost 条件会合并到同一组候选', () => {
    const cardsMap = new Map([
      ['2000525', '银妆刀'],
      ['3000001', '金币'],
      ['3000002', '银币'],
    ])
    const cardsById = {
      '2000525': { id: 2000525, name: '银妆刀', type: 'item', rare: 2, resource: ['cards/2000525.png'] },
      '3000001': { id: 3000001, name: '金币', type: 'item', rare: 1, resource: ['cards/3000001.png'], tag: { 金币: 1 } },
      '3000002': { id: 3000002, name: '银币', type: 'item', rare: 1, resource: ['cards/3000002.png'], tag: { 金币: 1 } },
    }
    const rite = {
      id: 5000999,
      name: '测试仪式',
      cards_slot: {
        s3: {
          condition: {
            type: 'item',
            any: {
              'cost.金币': 1,
              is: 2000525,
            },
          },
          is_empty: 0,
          text: '祭品',
        },
      },
    }

    const model = adaptStoryData('rite', rite, cardsMap, cardsById)
    const slot = model.slots.find((entry) => entry.id === 's3')
    const candidateIds = slot.candidates.flatMap((candidate) => candidate.cards.map((card) => card.id))

    expect(slot).toBeTruthy()
    expect(new Set(candidateIds)).toEqual(new Set(['2000525', '3000001', '3000002']))
    expect(slot.candidates.every((candidate) => candidate.conditionText === slot.candidates[0].conditionText)).toBe(true)
  })

  test('5002006 的 s3 槽位在 pop 条件为空时应回退使用槽位条件筛选候选卡', () => {
    const cardsMap = new Map([
      ['2000525', '借书证'],
      ['2000029', '金币'],
      ['2000123', '莎姬'],
    ])
    const cardsById = {
      '2000525': { id: 2000525, name: '借书证', type: 'item', rare: 2, resource: ['cards/2000525.png'] },
      '2000029': { id: 2000029, name: '金币', type: 'item', rare: 1, resource: ['cards/2000029.png'], tag: { 金币: 1 } },
      '2000123': { id: 2000123, name: '莎姬', type: 'char', rare: 1, resource: ['cards/2000123.png'] },
    }
    const rite = {
      id: 5002006,
      name: '书店营业',
      cards_slot: {
        s3: {
          condition: {
            type: 'item',
            any: {
              'cost.金币': 1,
              is: 2000525,
            },
          },
          is_empty: 1,
          text: '你可以置入1金币买书，或置入借书证借阅。当然，你也可以什么都不带，只是看看。',
          pops: [
            {
              condition: {},
              action: {
                choose: {
                  'pop.5002006_s3_02.s5': '今日亦有新书入库',
                  'pop.5002006_s3_03.s5': '想引鱼儿上钩，有时无需饵料',
                  'pop.5002006_s3_04.s5': '挑选书籍，最见一个人的品味',
                },
              },
            },
          ],
        },
      },
    }

    const model = adaptStoryData('rite', rite, cardsMap, cardsById)
    const slot = model.slots.find((entry) => entry.id === 's3')
    const nonEmptyCandidates = slot.candidates.filter((candidate) => !candidate.isEmpty)
    const candidateIds = nonEmptyCandidates.flatMap((candidate) => candidate.cards.map((card) => card.id))
    const conditionGroupCount = new Set(
      nonEmptyCandidates.map((candidate) => candidate.conditionText || candidate.label)
    ).size

    expect(slot).toBeTruthy()
    expect(conditionGroupCount).toBe(1)
    expect(candidateIds).toEqual(['2000525', '2000029'])
  })
})

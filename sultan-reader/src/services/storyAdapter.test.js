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
    const uniqueCardCandidate = slot?.candidates.find((candidate) => candidate.cards?.[0]?.id === '2000123')

    expect(slot).toBeTruthy()
    expect(uniqueCardCandidate).toBeTruthy()
    expect(uniqueCardCandidate.cards).toHaveLength(1)
    expect(uniqueCardCandidate.cards[0].id).toBe('2000123')
    expect(uniqueCardCandidate.label).toContain('莎姬')
  })
})

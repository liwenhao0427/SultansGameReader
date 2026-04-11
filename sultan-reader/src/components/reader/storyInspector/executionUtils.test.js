import { describe, expect, it } from 'vitest'
import { buildExecutionFlow, buildSkipOptionId } from './executionUtils'

describe('executionUtils', () => {
  it('计数器条件按具体计数器分组，并默认跳过', () => {
    const flow = buildExecutionFlow({
      title: '测试仪式',
      rawPhases: [
        {
          index: 0,
          phaseKey: 'main',
          phase: '主结算',
          raw: {
            condition: {
              'counter.7000158=': 2,
            },
            result: {},
          },
        },
      ],
    }, {
      cardsMap: new Map(),
      slotCards: {},
      counterRegistry: new Map([
        ['7000158', { id: '7000158', displayName: '重新营业等待天数' }],
      ]),
    })

    expect(flow.conditionGroups).toHaveLength(1)
    expect(flow.conditionGroups[0].id).toBe('counter.7000158')
    expect(flow.conditionGroups[0].options[0].id).toBe(buildSkipOptionId('counter.7000158'))
    expect(flow.autoSelections['counter.7000158']).toBe(buildSkipOptionId('counter.7000158'))
  })
})

import { describe, expect, it } from 'vitest'
import { buildExecutionFlow } from './executionUtils'

function buildPhase(index, phaseKey, condition, result = {}, text = '') {
  return {
    index,
    phaseKey,
    phase: phaseKey,
    text,
    raw: {
      condition,
      result,
    },
  }
}

describe('executionUtils - settlement_extre', () => {
  it('主结算命中非空 result 后仍会继续进入额外结算', () => {
    const flow = buildExecutionFlow({
      title: '测试仪式',
      rawPhases: [
        buildPhase(0, 'settlement', { 's1.is': 1001 }, { card: [2001, 1] }, '主结算文本'),
        buildPhase(1, 'settlement_extre', { 'counter.7000635>=': 1 }, {}, '额外结算文本'),
      ],
    }, {
      cardsMap: new Map(),
      slotCards: {},
      branchSelections: {
        s1: 's1::s1.is::1001',
        'counter.7000635': 'counter.7000635::counter.7000635>=::1',
      },
    })

    const resultSteps = flow.steps.filter((step) => step.kind === 'result')
    expect(resultSteps.map((step) => step.text)).toEqual(['主结算文本', '额外结算文本'])
    expect(flow.isComplete).toBe(false)
  })

  it('额外结算在再次遇到非空 result 后停止继续向下展示', () => {
    const flow = buildExecutionFlow({
      title: '测试仪式',
      rawPhases: [
        buildPhase(0, 'settlement', { 's1.is': 1001 }, { card: [2001, 1] }, '主结算文本'),
        buildPhase(1, 'settlement_extre', { 'counter.7000635>=': 1 }, {}, '额外空结果'),
        buildPhase(2, 'settlement_extre', { 'counter.7000635>=': 1 }, { event_on: 5300001 }, '额外终止结果'),
        buildPhase(3, 'settlement_extre', { 'counter.7000635>=': 1 }, {}, '不应继续展示'),
      ],
    }, {
      cardsMap: new Map(),
      slotCards: {},
      branchSelections: {
        s1: 's1::s1.is::1001',
        'counter.7000635': 'counter.7000635::counter.7000635>=::1',
      },
    })

    const resultSteps = flow.steps.filter((step) => step.kind === 'result')
    expect(resultSteps.map((step) => step.text)).toEqual(['主结算文本', '额外空结果', '额外终止结果'])
    expect(flow.isComplete).toBe(true)
  })
})

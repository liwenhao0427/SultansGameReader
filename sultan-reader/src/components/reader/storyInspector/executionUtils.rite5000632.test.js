import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { adaptStoryData } from '../../../services/storyAdapter'
import { buildConditionGroupKey, buildExecutionFlow, buildSkipOptionId } from './executionUtils'

function loadRite5000632() {
  const filePath = path.resolve(process.cwd(), '../cache/rite/5000632.json')
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function summarizeSettlementGroups(model) {
  const summary = []

  for (const phase of model.rawPhases || []) {
    const groupKey = buildConditionGroupKey(phase.raw?.condition || {})
    if (!groupKey) continue

    if (summary.at(-1)?.groupKey === groupKey) continue

    summary.push({
      groupKey,
      firstText: phase.text || '',
    })
  }

  return summary
}

describe('executionUtils - 仪式 5000632', () => {
  it('可以按条件前缀汇总结算分组摘要', () => {
    const rite = loadRite5000632()
    const model = adaptStoryData('rite', rite, new Map(), {})

    expect(summarizeSettlementGroups(model)).toEqual([
      {
        groupKey: 'r1',
        firstText: rite.settlement_extre[0].result_text,
      },
      {
        groupKey: 'r2',
        firstText: rite.settlement_extre[2].result_text,
      },
      {
        groupKey: 'r3',
        firstText: rite.settlement_extre[4].result_text,
      },
      {
        groupKey: 'r1r2r3s4',
        firstText: rite.settlement_extre[6].result_text,
      },
      {
        groupKey: 'anyallr1r2r3r1r2r3r1r2r3r1r2r3s4',
        firstText: rite.settlement_extre[14].result_text,
      },
    ])
  })

  it('可以把 any/all 复合条件识别为单独的结算分支组', () => {
    const rite = loadRite5000632()
    const model = adaptStoryData('rite', rite, new Map(), {})
    const complexGroupKey = buildConditionGroupKey(rite.settlement_extre[14].condition)

    const flow = buildExecutionFlow(model, {
      cardsMap: new Map(),
      slotCards: {},
      branchSelections: {
        r1: buildSkipOptionId('r1'),
        r2: buildSkipOptionId('r2'),
        r3: buildSkipOptionId('r3'),
        r1r2r3s4: buildSkipOptionId('r1r2r3s4'),
      },
    })

    const complexGroup = flow.conditionGroups.find((group) => group.id === complexGroupKey)
    expect(complexGroupKey).toBe('anyallr1r2r3r1r2r3r1r2r3r1r2r3s4')
    expect(complexGroup).toBeTruthy()
    expect(complexGroup.options).toHaveLength(3)
    expect(complexGroup.options.slice(1).map((option) => option.rawValue)).toEqual([
      rite.settlement_extre[14].condition,
      rite.settlement_extre[15].condition,
    ])

    const selectedFlow = buildExecutionFlow(model, {
      cardsMap: new Map(),
      slotCards: {},
      branchSelections: {
        r1: buildSkipOptionId('r1'),
        r2: buildSkipOptionId('r2'),
        r3: buildSkipOptionId('r3'),
        r1r2r3s4: buildSkipOptionId('r1r2r3s4'),
        [complexGroupKey]: complexGroup.options[1].id,
      },
    })

    expect(selectedFlow.steps.at(-1)?.text).toBe(rite.settlement_extre[14].result_text)
  })
})

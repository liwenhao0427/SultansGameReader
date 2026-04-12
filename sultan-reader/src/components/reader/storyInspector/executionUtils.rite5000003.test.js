import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { adaptStoryData } from '../../../services/storyAdapter'
import { buildConditionGroupKey, buildExecutionFlow } from './executionUtils'

function loadRite5000003() {
  const filePath = path.resolve(process.cwd(), '../cache/rite/5000003.json')
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

describe('executionUtils - 仪式 5000003', () => {
  it('忽略 __c 注释键，并把连续结算结果合并到同一条件组中', () => {
    const rite = loadRite5000003()
    const targetSettlement = rite.settlement[0]
    const model = adaptStoryData('rite', rite, new Map(), {})
    const flow = buildExecutionFlow(model, {
      cardsMap: new Map(),
      slotCards: {},
    })

    expect(buildConditionGroupKey(targetSettlement.condition)).toBe('s3')

    const mergedResultGroup = flow.conditionGroups.find((group) => group.id.startsWith('resultblock:'))
    expect(mergedResultGroup).toBeTruthy()
    expect(
      mergedResultGroup.options.some((option) => (option.fullLabel || option.label || '').includes('荆棘戒指'))
    ).toBe(true)
    expect(
      mergedResultGroup.options.some((option) => (option.fullLabel || option.label || '').includes('s3戴上了荆棘戒指'))
    ).toBe(true)
    expect(Object.keys(flow.autoSelections || {}).length).toBeGreaterThan(0)
    expect(flow.steps.some((step) => step.kind === 'choice' && step.groupId === mergedResultGroup.id)).toBe(true)
  })
})

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
  it('分组时忽略 __c 注释键，但保留注释文本作为条件展示', () => {
    const rite = loadRite5000003()
    const targetSettlement = rite.settlement[0]
    const model = adaptStoryData('rite', rite, new Map(), {})
    const flow = buildExecutionFlow(model, {
      cardsMap: new Map(),
      slotCards: {},
    })

    expect(buildConditionGroupKey(targetSettlement.condition)).toBe('s3')

    const s3Group = flow.conditionGroups.find((group) => group.id === 's3')
    expect(s3Group).toBeTruthy()
    expect(
      s3Group.options.some((option) => (option.fullLabel || option.label || '').includes('荆棘戒指'))
    ).toBe(true)
    expect(
      s3Group.options.some((option) => (option.fullLabel || option.label || '').includes('s3戴上了荆棘戒指'))
    ).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { parseAfterStoryConditionObject } from './afterStoryCondition'

describe('afterStoryCondition', () => {
  it('优先显示条件注释，并保留分组注释', () => {
    const items = parseAfterStoryConditionObject({
      'counter.7000449<': 1,
      'counter.7000449<__c': '主角参与果实',
      'have.2000010.激情': 1,
      'have.2000010.激情__ca': '--------个人条件---------------------',
      '!have.妻子': 1,
    }, {
      2000010: { id: 2000010, name: '阿迪莱' },
    })

    expect(items[0].text).toBe('主角参与果实')
    expect(items[1]).toEqual({ type: 'section', text: '个人条件' })
    expect(items[2].text).toBe('拥有 阿迪莱（激情）')
    expect(items[3].text).toBe('没有 妻子')
  })
})

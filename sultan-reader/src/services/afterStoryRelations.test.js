import { describe, expect, it } from 'vitest'
import {
  buildAfterStoryRelations,
  extractEndingHintsFromComment,
  normalizeEndingName,
} from './afterStoryRelations.js'

describe('afterStoryRelations', () => {
  it('能从结局章节注释里提取结局名与显式 ID', () => {
    const hints = extractEndingHintsFromComment('---------------------------结局弑神者（502）------------------------------------------------')
    expect(hints.ids).toEqual(['502'])
    expect(hints.names).toEqual(['弑神者'])
  })

  it('能从后日谈注释里提取结局名', () => {
    const hints = extractEndingHintsFromComment('逃往中国的总结后日谈')
    expect(hints.names).toEqual(['逃往中国'])
  })

  it('会清理补充标记与修饰前缀', () => {
    expect(normalizeEndingName('消卡结局金色荒芜')).toBe('金色荒芜')
    expect(normalizeEndingName('结局终点的笑声(补充1)')).toBe('终点的笑声')
  })

  it('会把章节标题后的后续条目继承到同一个结局上，并保留条件对象', () => {
    const relations = buildAfterStoryRelations(
      [{
        id: '2000005',
        name: '巴拉特',
        extra: [
          { key: 'a1', __ca: '---------------------------结局新日之书------------------------------------------------', result_text: '第一段', condition: { 'have.妻子': 1 } },
          { key: 'a2', result_text: '第二段' },
          { key: 'a3', __ca: '---------------------------结局新日之坠------------------------------------------------', result_text: '第三段' },
        ],
      }],
      [
        { id: '206', name: '新日之书' },
        { id: '207', name: '新日之坠' },
      ]
    )

    expect(relations.overToAfterStories['206'][0].items.map((item) => item.key)).toEqual(['a1', 'a2'])
    expect(relations.overToAfterStories['206'][0].items[0].condition).toEqual({ 'have.妻子': 1 })
    expect(relations.overToAfterStories['207'][0].items.map((item) => item.key)).toEqual(['a3'])
  })
})

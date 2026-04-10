import { describe, expect, it } from 'vitest'
import { buildAfterStoryVariantAnalysis, splitAfterStoryText } from './afterStoryDiff'

describe('afterStoryDiff', () => {
  it('会按标点切分后日谈文本片段', () => {
    const segments = splitAfterStoryText('阿鲁米娜住下来了。他们不常露面，后来你给了她一张奢靡。')
    expect(segments.map((segment) => segment.text)).toEqual([
      '阿鲁米娜住下来了。',
      '他们不常露面，',
      '后来你给了她一张奢靡。',
    ])
  })

  it('会按句段出现比例映射到 100/80/60/40/20 五档颜色', () => {
    const result = buildAfterStoryVariantAnalysis([
      { key: 'a', text: '共同句。八成句。六成句。四成句。独有句A。' },
      { key: 'b', text: '共同句。八成句。六成句。四成句。独有句B。' },
      { key: 'c', text: '共同句。八成句。六成句。' },
      { key: 'd', text: '共同句。八成句。' },
      { key: 'e', text: '共同句。' },
    ])

    expect(result[0].segments.map((segment) => segment.tone)).toEqual(['p100', 'p80', 'p60', 'p40', 'p20'])
  })
})

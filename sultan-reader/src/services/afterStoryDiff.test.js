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

  it('会把所有变体都出现的句段标为普通色，把特有句段标为强调色', () => {
    const result = buildAfterStoryVariantAnalysis([
      { key: 'a', text: '阿鲁米娜住下来了。后来你给了她一张奢靡。' },
      { key: 'b', text: '阿鲁米娜住下来了。后来你给了她一张纵欲。' },
    ])

    expect(result[0].segments[0].tone).toBe('common')
    expect(result[0].segments[1].tone).toBe('unique')
    expect(result[1].segments[1].tone).toBe('unique')
  })
})

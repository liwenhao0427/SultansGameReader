import { describe, expect, it } from 'vitest'

describe('OverDetail - 单个结局数据处理', () => {
  it('单个结局记录按详情数据结构读取', () => {
    const data = {
      name: '伴君如伴虎',
      sub_name: '你死于触怒苏丹',
      text: '这并不有趣，你被苏丹像小丑一样处死。',
      bg: 'over_cg/over_cg_1',
      icon: 'over_icon/over_icon_1',
      text_extra: [
        { condition: {}, result_text: '' },
        { condition: {}, result_text: '补充尾声' },
      ],
    }

    const extraTexts = (Array.isArray(data.text_extra) ? data.text_extra : [])
      .map((item) => item?.result_text)
      .filter((text) => typeof text === 'string' && text.trim())

    expect(data.name).toBe('伴君如伴虎')
    expect(data.bg).toBe('over_cg/over_cg_1')
    expect(extraTexts).toEqual(['补充尾声'])
  })
})

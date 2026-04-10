import { describe, expect, it } from 'vitest'
import { resolveAfterStoryFallbackImage } from './afterStoryImageFallback'

describe('afterStoryImageFallback', () => {
  it('会优先匹配同名人物卡牌图片', () => {
    const image = resolveAfterStoryFallbackImage('贵族快脚', {
      1: { id: 1, name: '贵族快脚', resource: ['cards/kj'] },
      2: { id: 2, name: '阿鲁米娜', resource: ['cards/almn'] },
    })

    expect(image).toBe('cards/kj')
  })

  it('找不到完全一致时会尝试包含匹配', () => {
    const image = resolveAfterStoryFallbackImage('哲巴尔', {
      1: { id: 1, name: '青年哲巴尔', resource: ['cards/zb'] },
    })

    expect(image).toBe('cards/zb')
  })
})

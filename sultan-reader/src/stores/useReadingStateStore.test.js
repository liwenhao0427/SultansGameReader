import { describe, expect, it } from 'vitest'
import {
  getContentState,
  makeContentStateKey,
  matchesContentStateFilter,
} from './useReadingStateStore'

describe('useReadingStateStore helpers', () => {
  it('会生成稳定的 type:id 键', () => {
    expect(makeContentStateKey('event', '1001')).toBe('event:1001')
  })

  it('会给未记录内容返回默认状态', () => {
    expect(getContentState({}, 'rite', '1')).toEqual({ read: false, favorite: false })
  })

  it('会按筛选标签判断状态是否匹配', () => {
    const state = { read: true, favorite: false }

    expect(matchesContentStateFilter(state, 'all')).toBe(true)
    expect(matchesContentStateFilter(state, 'read')).toBe(true)
    expect(matchesContentStateFilter(state, 'unread')).toBe(false)
    expect(matchesContentStateFilter(state, 'favorite')).toBe(false)
  })
})

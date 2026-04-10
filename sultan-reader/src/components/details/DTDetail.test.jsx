import { describe, expect, it } from 'vitest'
import {
  JUMP_TYPE_MAP,
  buildDialogueItemMap,
  buildDialogueVisiblePath,
  resolveDialogueStartId,
} from './DTDetail.jsx'

const demoTree = {
  dialog_tree_id: 'DT1',
  first_word_id: 'S1',
  description: '测试对话树',
  Item: [
    {
      word_id: 'S1',
      word: '开场白',
      jump_type: '0',
      direct_id: 'S2',
      Option: [],
    },
    {
      word_id: 'S2',
      word: '请选择',
      jump_type: '1',
      direct_id: '',
      Option: [
        { option_Jump_id: 'S3', option_Jump_word: '走向分支 A' },
        { option_Jump_id: 'S4', option_Jump_word: '走向分支 B' },
      ],
    },
    {
      word_id: 'S3',
      word: '分支 A 结尾',
      jump_type: '3',
      direct_id: '',
      Option: [],
    },
    {
      word_id: 'S4',
      word: '分支 B 继续',
      jump_type: '0',
      direct_id: 'S5',
      Option: [],
    },
    {
      word_id: 'S5',
      word: '分支 B 结尾',
      jump_type: '3',
      direct_id: '',
      Option: [],
    },
  ],
}

describe('DTDetail 对话树路径推导', () => {
  it('jump_type 映射正确', () => {
    expect(JUMP_TYPE_MAP['0']).toBe('直接跳转')
    expect(JUMP_TYPE_MAP['1']).toBe('选项分支')
    expect(JUMP_TYPE_MAP['3']).toBe('结束')
  })

  it('优先使用 first_word_id 作为起点', () => {
    const itemMap = buildDialogueItemMap(demoTree.Item)
    expect(resolveDialogueStartId(demoTree, itemMap)).toBe('S1')
  })

  it('未选分支时只展开到第一个可选节点', () => {
    const path = buildDialogueVisiblePath(demoTree, {})
    expect(path.map((item) => item.word_id)).toEqual(['S1', 'S2'])
  })

  it('选择分支后会继续展开后续内容', () => {
    const path = buildDialogueVisiblePath(demoTree, { S2: 'S4' })
    expect(path.map((item) => item.word_id)).toEqual(['S1', 'S2', 'S4', 'S5'])
  })

  it('切换之前的选项会刷新后续路径', () => {
    const path = buildDialogueVisiblePath(demoTree, { S2: 'S3' })
    expect(path.map((item) => item.word_id)).toEqual(['S1', 'S2', 'S3'])
  })
})

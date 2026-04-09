// 后日谈节点 — 青色边框，显示 id + name
import BaseNode from './BaseNode'

const COLOR = '#94e2d5'

export default function AfterStoryNode({ data, selected }) {
  const { rawData } = data
  const label = rawData?.name ?? '—'
  return <BaseNode id={`after_story:${rawData?.id ?? data.label}`} label={label} color={COLOR} selected={selected} />
}

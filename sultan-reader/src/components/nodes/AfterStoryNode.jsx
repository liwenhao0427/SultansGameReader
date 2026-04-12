// 后日谈节点 — 青色边框，显示 id + name + 图片
import BaseNode from './BaseNode'

const COLOR = '#94e2d5'

export default function AfterStoryNode({ data, selected }) {
  const { rawData } = data
  const label = rawData?.name ?? '—'
  // 取第一个有 pic 的 extra 条目图片
  const firstPic = Array.isArray(rawData?.extra) ? (rawData.extra.find((e) => e?.pic)?.pic || null) : null
  return <BaseNode id={`after_story:${rawData?.id ?? data.label}`} label={label} color={COLOR} selected={selected} image={firstPic} onExpand={data.onExpand} />
}

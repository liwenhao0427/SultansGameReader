// 仪式节点 — 紫色边框，显示 id + name + icon图片
import BaseNode from './BaseNode'

const COLOR = '#cba6f7'

export default function RiteNode({ data, selected }) {
  const { rawData } = data
  const label = rawData?.name ?? '—'
  return <BaseNode id={`rite:${rawData?.id ?? data.label}`} label={label} color={COLOR} selected={selected} image={rawData?.icon || null} />
}

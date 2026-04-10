// 卡牌节点 — 绿色边框，显示 id + name + 图片
import BaseNode from './BaseNode'

const COLOR = '#a6e3a1'

export default function CardNode({ data, selected }) {
  const { rawData } = data
  const label = rawData?.name ?? '—'
  const image = Array.isArray(rawData?.resource) ? (rawData.resource[0] || null) : (rawData?.resource || null)
  return <BaseNode id={`card:${rawData?.id ?? data.label}`} label={label} color={COLOR} selected={selected} image={image} rare={rawData?.rare} />
}

// 卡牌节点 — 绿色边框，显示 id + name
import BaseNode from './BaseNode'

const COLOR = '#a6e3a1'

export default function CardNode({ data, selected }) {
  const { rawData } = data
  const label = rawData?.name ?? '—'
  return <BaseNode id={`card:${rawData?.id ?? data.label}`} label={label} color={COLOR} selected={selected} />
}

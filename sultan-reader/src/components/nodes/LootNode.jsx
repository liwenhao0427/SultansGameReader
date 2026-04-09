// 战利品节点 — 金色边框，显示 id + name
import BaseNode from './BaseNode'

const COLOR = '#f9e2af'

export default function LootNode({ data, selected }) {
  const { rawData } = data
  const label = rawData?.name ?? '—'
  return <BaseNode id={`loot:${rawData?.id ?? data.label}`} label={label} color={COLOR} selected={selected} />
}

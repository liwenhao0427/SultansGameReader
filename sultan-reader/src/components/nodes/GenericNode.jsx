// 通用节点 — 灰色边框，用于 over/upgrade/dt 类型，显示 id + label
import BaseNode from './BaseNode'

const COLOR = '#a6adc8'

export default function GenericNode({ data, selected }) {
  const { rawData, nodeType } = data
  const id = rawData?.id ?? data.label
  const label = rawData?.name ?? rawData?.text ?? data.label ?? '—'
  return <BaseNode id={`${nodeType ?? 'node'}:${id}`} label={label} color={COLOR} selected={selected} />
}

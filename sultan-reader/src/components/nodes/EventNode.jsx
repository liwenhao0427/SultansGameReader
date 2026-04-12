// 事件节点 — 蓝色边框，显示 id + text 摘要
import BaseNode from './BaseNode'

const COLOR = '#89b4fa'

export default function EventNode({ data, selected }) {
  const { rawData } = data
  const label = rawData?.name ?? rawData?.title ?? (rawData?.text ? String(rawData.text).slice(0, 24) : '—')
  return <BaseNode id={`event:${rawData?.id ?? data.label}`} label={label} color={COLOR} selected={selected} onExpand={data.onExpand} onRemove={data.onRemove} />
}

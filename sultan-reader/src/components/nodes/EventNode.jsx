// 事件节点 — 蓝色边框，显示 id + text 摘要
import BaseNode from './BaseNode'

const COLOR = '#89b4fa'

export default function EventNode({ data, selected }) {
  const { rawData } = data
  // text 字段作为摘要，截取前 50 字符
  const label = rawData?.text ? String(rawData.text).slice(0, 50) : '—'
  return <BaseNode id={`event:${rawData?.id ?? data.label}`} label={label} color={COLOR} selected={selected} />
}

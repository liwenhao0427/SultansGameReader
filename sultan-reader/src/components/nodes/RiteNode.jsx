// 仪式节点 — 紫色边框，显示 id + name + icon图片
import BaseNode from './BaseNode'
import { READER_RESOURCE_ASSETS } from '../../resourceConfig'

const COLOR = '#cba6f7'

export default function RiteNode({ data, selected }) {
  const { rawData } = data
  const label = rawData?.name ?? '—'
  return (
    <BaseNode
      id={`rite:${rawData?.id ?? data.label}`}
      label={label}
      color={COLOR}
      selected={selected}
      image={rawData?.icon || null}
      fallbackImage={READER_RESOURCE_ASSETS.defaultRiteNodeIcon}
      variant="iconTitle"
      onExpand={data.onExpand}
      onRemove={data.onRemove}
      expandCount={data.expandCount}
    />
  )
}

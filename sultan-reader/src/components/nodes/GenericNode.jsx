import BaseNode from './BaseNode'

const DEFAULT_COLOR = '#a6adc8'
const OVER_COLOR = '#d9aa84'

export default function GenericNode({ data, selected }) {
  const { rawData, nodeType } = data
  const id = rawData?.id ?? data.label
  const label = rawData?.name ?? rawData?.text ?? data.label ?? '未命名节点'
  const image = rawData?.bg || rawData?.icon || rawData?.pic || null
  const variant = nodeType === 'over' ? 'heroBackdrop' : 'text'
  const color = nodeType === 'over' ? OVER_COLOR : DEFAULT_COLOR

  return (
    <BaseNode
      id={`${nodeType ?? 'node'}:${id}`}
      label={label}
      color={color}
      selected={selected}
      image={image}
      variant={variant}
      onExpand={data.onExpand}
      onRemove={data.onRemove}
    />
  )
}

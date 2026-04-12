import BaseNode from './BaseNode'

const COLOR = '#a6adc8'

export default function GenericNode({ data, selected }) {
  const { rawData, nodeType } = data
  const id = rawData?.id ?? data.label
  const label = rawData?.name ?? rawData?.text ?? data.label ?? '未命名节点'
  const image = rawData?.bg || rawData?.icon || rawData?.pic || null

  return (
    <BaseNode
      id={`${nodeType ?? 'node'}:${id}`}
      label={label}
      color={COLOR}
      selected={selected}
      image={image}
      onExpand={data.onExpand}
    />
  )
}

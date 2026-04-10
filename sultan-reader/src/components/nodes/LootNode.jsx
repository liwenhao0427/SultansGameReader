// 战利品节点 — 金色边框，显示 id + name + 图片
import BaseNode from './BaseNode'

const COLOR = '#f9e2af'

export default function LootNode({ data, selected }) {
  const { rawData } = data
  const label = rawData?.name ?? '—'
  // 取第一个卡牌类型掉落物的图片
  const firstCardItem = Array.isArray(rawData?.item) ? rawData.item.find((i) => i?.type === 'card') : null
  const image = firstCardItem ? `cards/${firstCardItem.id}` : null
  return <BaseNode id={`loot:${rawData?.id ?? data.label}`} label={label} color={COLOR} selected={selected} image={image} />
}

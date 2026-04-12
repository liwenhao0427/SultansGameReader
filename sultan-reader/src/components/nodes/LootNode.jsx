// 战利品节点 — 按卡牌视觉展示，并沿用掉落卡牌的稀有度底板
import BaseNode from './BaseNode'
import useConfigStore from '../../stores/useConfigStore'

const COLOR = '#f9e2af'

export default function LootNode({ data, selected }) {
  const { rawData } = data
  const cardsById = useConfigStore((state) => state.cardsById)
  const label = rawData?.name ?? '—'

  // 取第一个卡牌类型掉落物，作为战利品节点的主视觉
  const firstCardItem = Array.isArray(rawData?.item) ? rawData.item.find((i) => i?.type === 'card') : null
  const card = firstCardItem ? cardsById?.[String(firstCardItem.id)] : null
  const image = Array.isArray(card?.resource) ? (card.resource[0] || null) : (card?.resource || null)
  const rare = card?.rare ?? null

  return (
    <BaseNode
      id={`loot:${rawData?.id ?? data.label}`}
      label={label}
      color={COLOR}
      selected={selected}
      image={image}
      rare={rare}
      variant="iconTitle"
      onExpand={data.onExpand}
      onRemove={data.onRemove}
    />
  )
}

// 后日谈节点 — 青色边框，显示 id + name + 图片
import BaseNode from './BaseNode'
import useConfigStore from '../../stores/useConfigStore'
import { resolveAfterStoryFallbackCard } from '../../services/afterStoryImageFallback'

const COLOR = '#94e2d5'

export default function AfterStoryNode({ data, selected }) {
  const { rawData } = data
  const cardsById = useConfigStore((state) => state.cardsById)
  const label = rawData?.name ?? '—'
  // 取第一个有 pic 的 extra 条目图片
  const firstPic = Array.isArray(rawData?.extra) ? (rawData.extra.find((e) => e?.pic)?.pic || null) : null
  const fallbackCard = resolveAfterStoryFallbackCard(label, cardsById)

  return (
    <BaseNode
      id={`after_story:${rawData?.id ?? data.label}`}
      label={label}
      color={COLOR}
      selected={selected}
      image={firstPic || fallbackCard?.image || null}
      rare={firstPic ? null : (fallbackCard?.rare ?? null)}
      variant="iconTitle"
      onExpand={data.onExpand}
      onRemove={data.onRemove}
    />
  )
}

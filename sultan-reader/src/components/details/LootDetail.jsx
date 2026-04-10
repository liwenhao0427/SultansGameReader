import useConfigStore from '../../stores/useConfigStore'
import { useResolvedImage } from '../../services/imageResolver'
import { CARD_RENDER_CONFIG, getCardFrameHeight, getCardRarityFrameAsset } from '../../resourceConfig'

const S = {
  shell: { display: 'grid', gap: 18 },
  title: { color: '#fff0d3', fontSize: 30, fontWeight: 900, lineHeight: 1.15 },
  subtitle: { marginTop: 8, color: '#d8bc84', fontSize: 14, lineHeight: 1.6 },
  sectionTitle: { color: '#d8bc84', fontSize: 12, letterSpacing: '0.22em', textTransform: 'uppercase' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
  card: {
    display: 'grid',
    gridTemplateColumns: '60px minmax(0, 1fr)',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    border: '1px solid rgba(212, 184, 126, 0.12)',
    background: 'rgba(212, 184, 126, 0.04)',
  },
  poster: {
    width: 60,
    height: getCardFrameHeight(60),
    borderRadius: 14,
    overflow: 'hidden',
    border: '1px solid rgba(212, 184, 126, 0.14)',
    background: 'rgba(18, 15, 11, 0.92)',
    position: 'relative',
  },
  posterImg: {
    position: 'absolute',
    inset: '3px 4px 16px',
    objectFit: CARD_RENDER_CONFIG.imageObjectFit,
    objectPosition: CARD_RENDER_CONFIG.imageObjectPosition,
    width: 'calc(100% - 8px)',
    height: 'calc(100% - 19px)',
  },
  posterPlaceholder: {
    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'rgba(241, 232, 213, 0.42)', fontSize: 11,
  },
  name: { color: '#fff0d3', fontSize: 18, fontWeight: 700, lineHeight: 1.35 },
  meta: { marginTop: 4, color: 'rgba(241, 232, 213, 0.52)', fontSize: 11, fontFamily: 'Consolas, monospace' },
  text: { marginTop: 8, color: '#f1e8d5', fontSize: 13, lineHeight: 1.7, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 4, overflow: 'hidden' },
  stat: { marginTop: 8, color: '#d8bc84', fontSize: 12, lineHeight: 1.6 },
}

function LootItemPoster({ pic, rare }) {
  const { url, loading } = useResolvedImage(pic)
  const { url: rareFrameUrl } = useResolvedImage(rare ? getCardRarityFrameAsset(rare) : null)

  return (
    <div style={{
      ...S.poster,
      backgroundImage: rareFrameUrl ? `url("${rareFrameUrl}")` : 'none',
      backgroundSize: '100% 100%',
      backgroundRepeat: 'no-repeat',
    }}>
      {loading ? (
        <div style={S.posterPlaceholder}>加载中…</div>
      ) : url ? (
        <img src={url} alt="" style={S.posterImg} />
      ) : (
        <div style={S.posterPlaceholder}>暂无图片</div>
      )}
    </div>
  )
}

export default function LootDetail({ data }) {
  const cardsById = useConfigStore((s) => s.cardsById)
  if (!data) return null

  const items = Array.isArray(data.item) ? data.item : []
  const enrichedItems = items.map((item, index) => {
    const card = item?.type === 'card' ? cardsById?.[String(item.id)] : null
    const pic = Array.isArray(card?.resource) ? (card.resource[0] || null) : (card?.resource || null)
    return {
      key: `${item?.type || 'item'}:${item?.id || index}:${index}`,
      id: item?.id,
      type: item?.type,
      num: item?.num,
      weight: item?.weight,
      name: card?.name || `${item?.type || '未知类型'} ${item?.id || ''}`.trim(),
      text: card?.text || '',
      pic,
      rare: card?.rare ?? null,
    }
  })

  return (
    <div style={S.shell}>
      <div>
        <div style={S.title}>{data.name || `战利品 ${data.id}`}</div>
        <div style={S.subtitle}>
          {[
            data.type != null ? `类型 ${data.type}` : null,
            data.type__c || null,
            data.repeat != null ? `重复 ${data.repeat}` : null,
          ].filter(Boolean).join(' / ')}
        </div>
      </div>

      {enrichedItems.length > 0 && (
        <div>
          <div style={S.sectionTitle}>掉落内容</div>
          <div style={{ ...S.grid, marginTop: 12 }}>
            {enrichedItems.map((item) => (
              <div key={item.key} style={S.card}>
                <LootItemPoster pic={item.pic} rare={item.rare} />
                <div style={{ minWidth: 0 }}>
                  <div style={S.name}>{item.name}</div>
                  <div style={S.meta}>{item.type}:{item.id}</div>
                  <div style={S.stat}>数量：{item.num ?? '-'} / 权重：{item.weight ?? '-'}</div>
                  {item.text && <div title={item.text} style={S.text}>{item.text}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

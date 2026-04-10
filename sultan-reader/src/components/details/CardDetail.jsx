import { useResolvedImage } from '../../services/imageResolver'
import { getCardRarityFrameAsset } from '../../resourceConfig'

const S = {
  shell: { display: 'grid', gap: 18 },
  hero: {
    display: 'grid',
    gridTemplateColumns: '160px minmax(0, 1fr)',
    gap: 18,
    alignItems: 'start',
  },
  poster: {
    width: 160,
    height: 228,
    borderRadius: 22,
    overflow: 'hidden',
    border: '1px solid rgba(212, 184, 126, 0.16)',
    background: 'rgba(18, 15, 11, 0.92)',
    boxShadow: '0 18px 36px rgba(0,0,0,0.24)',
    position: 'relative',
  },
  posterImg: { width: '100%', height: '100%', display: 'block', objectFit: 'cover' },
  posterPlaceholder: {
    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'rgba(241, 232, 213, 0.48)', fontSize: 13,
  },
  title: { color: '#fff0d3', fontSize: 34, fontWeight: 900, lineHeight: 1.15 },
  subtitle: { marginTop: 8, color: '#d8bc84', fontSize: 15, lineHeight: 1.6 },
  rarity: { marginTop: 12, color: '#f2d597', fontSize: 14, letterSpacing: '0.12em' },
  text: { color: '#f1e8d5', fontSize: 15, lineHeight: '1.9', whiteSpace: 'pre-wrap' },
  sectionTitle: { color: '#d8bc84', fontSize: 12, letterSpacing: '0.22em', textTransform: 'uppercase' },
  tagWrap: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  tag: {
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid rgba(212, 184, 126, 0.14)',
    background: 'rgba(212, 184, 126, 0.06)',
    color: '#f1e8d5',
    fontSize: 12,
  },
}

function CardImage({ resource, rare }) {
  const pic = Array.isArray(resource) ? resource[0] : resource
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
        <img src={url} alt="" style={{ ...S.posterImg, position: 'absolute', inset: '5px 8px 22px' }} />
      ) : (
        <div style={S.posterPlaceholder}>暂无图片</div>
      )}
    </div>
  )
}

export default function CardDetail({ data }) {
  if (!data) return null

  const tags = data.tag && typeof data.tag === 'object' ? Object.entries(data.tag) : []

  return (
    <div style={S.shell}>
      <div style={S.hero}>
        <CardImage resource={data.resource} rare={data.rare} />
        <div>
          <div style={S.title}>{data.name || `卡牌 ${data.id}`}</div>
          {data.title && <div style={S.subtitle}>{data.title}</div>}
          {data.rare ? <div style={S.rarity}>{'★'.repeat(data.rare)}</div> : null}
        </div>
      </div>

      {data.text && (
        <div>
          <div style={S.sectionTitle}>描述</div>
          <div style={{ ...S.text, marginTop: 10 }}>{data.text}</div>
        </div>
      )}

      {tags.length > 0 && (
        <div>
          <div style={S.sectionTitle}>标签</div>
          <div style={{ ...S.tagWrap, marginTop: 10 }}>
            {tags.map(([key, value]) => (
              <span key={key} style={S.tag}>
                {key}{value !== 1 ? ` ${value}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import { useResolvedImage } from '../../services/imageResolver'

const S = {
  title: { color: '#89b4fa', fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
  subtitle: { color: '#a6adc8', fontSize: 12, marginBottom: 8 },
  text: { color: '#cdd6f4', fontSize: 13, lineHeight: '1.6', whiteSpace: 'pre-wrap', marginBottom: 10 },
  img: { maxWidth: '100%', borderRadius: 4, marginBottom: 10 },
  imgPlaceholder: { width: 80, height: 80, background: '#313244', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#585b70', fontSize: 11, marginBottom: 10 },
  sectionTitle: { color: '#89b4fa', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  tagWrap: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 },
  tag: { background: '#313244', color: '#cba6f7', fontSize: 11, borderRadius: 3, padding: '1px 6px' },
  rarity: { color: '#f9e2af', fontSize: 12, marginBottom: 8 },
}

/** 稀有度星级显示 */
function Rarity({ rare }) {
  if (!rare) return null
  return <div style={S.rarity}>{'★'.repeat(rare)}{'☆'.repeat(Math.max(0, 5 - rare))}</div>
}

/** 卡牌立绘（resource 字段，可能是字符串或数组） */
function CardImage({ resource }) {
  // 取第一张图
  const pic = Array.isArray(resource) ? resource[0] : resource
  const { url, loading } = useResolvedImage(pic)
  if (!pic) return null
  if (loading) return <div style={S.imgPlaceholder}>加载中…</div>
  if (!url) return <div style={S.imgPlaceholder}>无图片</div>
  return <img src={url} alt="" style={S.img} />
}

/**
 * CardDetail — 卡牌详情组件
 * @param {{ data: object }} props
 */
export default function CardDetail({ data }) {
  if (!data) return null

  const tags = data.tag && typeof data.tag === 'object' ? Object.entries(data.tag) : []

  return (
    <div>
      {/* 名称和称号 */}
      <div style={S.title}>{data.name || `卡牌 ${data.id}`}</div>
      {data.title && <div style={S.subtitle}>{data.title}</div>}

      {/* 稀有度 */}
      <Rarity rare={data.rare} />

      {/* 立绘 */}
      <CardImage resource={data.resource} />

      {/* 描述文本 */}
      {data.text && <div style={S.text}>{data.text}</div>}

      {/* 标签 */}
      {tags.length > 0 && (
        <div>
          <div style={S.sectionTitle}>标签</div>
          <div style={S.tagWrap}>
            {tags.map(([k, v]) => (
              <span key={k} style={S.tag}>{k}{v !== 1 ? ` ${v}` : ''}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import { useResolvedImage } from '../../services/imageResolver'

const S = {
  title: { color: '#f3e7cb', fontSize: 26, fontWeight: 700, lineHeight: 1.25, marginBottom: 6 },
  subName: { color: '#c9a56a', fontSize: 13, marginBottom: 14 },
  imageWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    border: '1px solid rgba(212, 184, 126, 0.12)',
    background: 'rgba(22, 18, 13, 0.88)',
    marginBottom: 16,
  },
  image: { width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' },
  imagePlaceholder: {
    height: 220,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(241, 232, 213, 0.42)',
    fontSize: 12,
  },
  textBox: {
    background: 'rgba(24, 24, 37, 0.72)',
    borderRadius: 18,
    padding: '16px 18px',
    marginBottom: 14,
    border: '1px solid rgba(212, 184, 126, 0.08)',
  },
  text: { color: '#f1e8d5', fontSize: 15, lineHeight: '1.9', whiteSpace: 'pre-wrap' },
  extraBox: {
    background: 'rgba(28, 22, 16, 0.82)',
    borderRadius: 16,
    padding: '14px 16px',
    marginBottom: 12,
    border: '1px solid rgba(212, 184, 126, 0.08)',
  },
  extraText: { color: '#dcc9a3', fontSize: 13, lineHeight: '1.8', whiteSpace: 'pre-wrap' },
  meta: { color: 'rgba(241, 232, 213, 0.48)', fontSize: 11, fontFamily: 'Consolas, monospace' },
}

function OverImage({ pic }) {
  const { url, loading } = useResolvedImage(pic)

  if (!pic) return null

  return (
    <div style={S.imageWrap}>
      {loading && <div style={S.imagePlaceholder}>加载图片中…</div>}
      {!loading && !url && <div style={S.imagePlaceholder}>暂无结局配图</div>}
      {!loading && url && <img src={url} alt="" style={S.image} />}
    </div>
  )
}

/**
 * OverDetail - 单个结局详情
 * 结局来自 cache/single/over.json 的单条记录，因此这里按单结局阅读展示。
 */
export default function OverDetail({ data }) {
  if (!data) return null

  const extras = Array.isArray(data.text_extra) ? data.text_extra : []
  const extraTexts = extras
    .map((item) => item?.result_text)
    .filter((text) => typeof text === 'string' && text.trim())

  return (
    <div>
      {data.name && <div style={S.title}>{data.name}</div>}
      {data.sub_name && <div style={S.subName}>{data.sub_name}</div>}

      <OverImage pic={data.bg} />

      {data.text && (
        <div style={S.textBox}>
          <div style={S.text}>{data.text}</div>
        </div>
      )}

      {extraTexts.map((text, index) => (
        <div key={`${index}:${text.slice(0, 24)}`} style={S.extraBox}>
          <div style={S.extraText}>{text}</div>
        </div>
      ))}

      {data.icon && <div style={S.meta}>icon: {data.icon}</div>}
    </div>
  )
}

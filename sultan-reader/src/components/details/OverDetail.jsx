import { useEffect, useState } from 'react'
import { useResolvedImage } from '../../services/imageResolver'
import { getAfterStoryRelations } from '../../services/afterStoryRelations'

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
  sectionTitle: {
    color: '#f0d6a0',
    fontSize: 13,
    fontWeight: 700,
    margin: '20px 0 10px',
    letterSpacing: '0.08em',
  },
  relatedGroup: {
    display: 'grid',
    gridTemplateColumns: '84px minmax(0, 1fr)',
    gap: 14,
    padding: '14px 16px',
    borderRadius: 18,
    background: 'rgba(24, 24, 37, 0.64)',
    border: '1px solid rgba(212, 184, 126, 0.08)',
    marginBottom: 12,
  },
  relatedTitle: { color: '#f3e7cb', fontSize: 15, fontWeight: 700, marginBottom: 8 },
  relatedSnippet: { color: '#dcc9a3', fontSize: 13, lineHeight: '1.75', whiteSpace: 'pre-wrap', marginTop: 8 },
}

function OverImage({ pic }) {
  const { url, loading } = useResolvedImage(pic)

  if (!pic) return null

  return (
    <div style={S.imageWrap}>
      {loading && <div style={S.imagePlaceholder}>加载结局配图中…</div>}
      {!loading && !url && <div style={S.imagePlaceholder}>暂无结局配图</div>}
      {!loading && url && <img src={url} alt="" style={S.image} />}
    </div>
  )
}

function RelatedAfterStoryGroup({ group }) {
  const groupImage = group.items.find((item) => item.pic)?.pic || group.afterStoryImage || null
  const { url, loading } = useResolvedImage(groupImage)

  return (
    <div style={S.relatedGroup}>
      <div style={S.imageWrap}>
        {loading && <div style={{ ...S.imagePlaceholder, height: 120 }}>加载中…</div>}
        {!loading && !url && <div style={{ ...S.imagePlaceholder, height: 120 }}>后日谈</div>}
        {!loading && url && <img src={url} alt="" style={{ ...S.image, maxHeight: 120 }} />}
      </div>
      <div>
        <div style={S.relatedTitle}>{group.afterStoryName}</div>
        {group.items.map((item) => (
          <div key={item.key} style={S.relatedSnippet}>{item.text}</div>
        ))}
      </div>
    </div>
  )
}

/**
 * OverDetail - 单个结局详情
 * 结局来自 cache/single/over.json 的单条记录，并额外展示注释匹配出的后日谈片段。
 */
export default function OverDetail({ data }) {
  const [relatedAfterStories, setRelatedAfterStories] = useState([])

  useEffect(() => {
    let cancelled = false

    async function loadRelations() {
      if (!data?.id) {
        setRelatedAfterStories([])
        return
      }

      const relations = await getAfterStoryRelations()
      if (!cancelled) {
        setRelatedAfterStories(relations.overToAfterStories[String(data.id)] || [])
      }
    }

    loadRelations()
    return () => {
      cancelled = true
    }
  }, [data])

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

      {relatedAfterStories.length > 0 && (
        <div>
          <div style={S.sectionTitle}>关联后日谈</div>
          {relatedAfterStories.map((group) => (
            <RelatedAfterStoryGroup key={group.afterStoryId} group={group} />
          ))}
        </div>
      )}

      {data.icon && <div style={S.meta}>icon: {data.icon}</div>}
    </div>
  )
}

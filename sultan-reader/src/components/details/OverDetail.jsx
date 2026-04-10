import { useEffect, useMemo, useState } from 'react'
import { useResolvedImage } from '../../services/imageResolver'
import { getAfterStoryRelations } from '../../services/afterStoryRelations'
import { buildAfterStoryVariantAnalysis } from '../../services/afterStoryDiff'
import { resolveAfterStoryFallbackImage } from '../../services/afterStoryImageFallback'
import useConfigStore from '../../stores/useConfigStore'

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
    cursor: 'pointer',
    transition: 'border-color 120ms ease, transform 120ms ease, background 120ms ease',
  },
  relatedTitle: { color: '#f3e7cb', fontSize: 15, fontWeight: 700, marginBottom: 8 },
  relatedSnippet: { color: '#dcc9a3', fontSize: 13, lineHeight: '1.75', whiteSpace: 'pre-wrap', marginTop: 8 },
  relatedMetaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  relatedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    color: '#f0d6a0',
    background: 'rgba(212, 184, 126, 0.12)',
    border: '1px solid rgba(212, 184, 126, 0.12)',
  },
  relatedHint: {
    fontSize: 12,
    color: 'rgba(241, 232, 213, 0.58)',
  },
  previewClamp: {
    color: '#dcc9a3',
    fontSize: 13,
    lineHeight: '1.8',
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 4,
    overflow: 'hidden',
  },
  modalMask: {
    position: 'fixed',
    inset: 0,
    zIndex: 120,
    background: 'rgba(6, 5, 4, 0.74)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalPanel: {
    width: 'min(980px, 90vw)',
    maxHeight: '84vh',
    borderRadius: 28,
    border: '1px solid rgba(212, 184, 126, 0.14)',
    background: 'linear-gradient(180deg, rgba(26, 21, 16, 0.98), rgba(16, 13, 10, 0.98))',
    boxShadow: '0 36px 90px rgba(0, 0, 0, 0.42)',
    overflow: 'hidden',
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '20px 22px 16px',
    borderBottom: '1px solid rgba(212, 184, 126, 0.08)',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: '#f8edd7',
  },
  modalSubTitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 1.65,
    color: 'rgba(241, 232, 213, 0.68)',
  },
  modalActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  modalBody: {
    minHeight: 0,
    overflowY: 'auto',
    padding: 20,
    display: 'grid',
    gap: 18,
  },
  modalContent: {
    display: 'grid',
    gridTemplateColumns: '144px minmax(0, 1fr)',
    gap: 18,
    alignItems: 'start',
  },
  modalImageWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    border: '1px solid rgba(212, 184, 126, 0.12)',
    background: 'rgba(18, 15, 11, 0.92)',
  },
  modalImage: {
    width: '100%',
    height: 216,
    display: 'block',
    objectFit: 'contain',
    objectPosition: 'top center',
  },
  modalTextCard: {
    borderRadius: 22,
    padding: '18px 20px',
    background: 'rgba(24, 24, 37, 0.62)',
    border: '1px solid rgba(212, 184, 126, 0.08)',
  },
  modalLegend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
    color: 'rgba(241, 232, 213, 0.64)',
    fontSize: 12,
  },
}

const TONE_STYLE = {
  common: { color: 'rgba(233, 217, 190, 0.74)' },
  shared: { color: '#e5c889' },
  unique: { color: '#ffd98b', textShadow: '0 0 16px rgba(255, 191, 73, 0.12)' },
}

const actionButtonStyle = {
  padding: '9px 13px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.18)',
  background: 'rgba(212, 184, 126, 0.08)',
  color: '#f1e8d5',
  cursor: 'pointer',
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

function RelatedAfterStoryCard({ group, onOpen }) {
  const previewItem = group.items[0]
  const previewImage = previewItem?.pic || group.afterStoryImage || group.fallbackImage || null
  const { url, loading } = useResolvedImage(previewImage)

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        ...S.relatedGroup,
        textAlign: 'left',
      }}
    >
      <div style={S.imageWrap}>
        {loading && <div style={{ ...S.imagePlaceholder, height: 120 }}>加载中…</div>}
        {!loading && !url && <div style={{ ...S.imagePlaceholder, height: 120 }}>后日谈</div>}
        {!loading && url && <img src={url} alt="" style={{ ...S.image, maxHeight: 120 }} />}
      </div>
      <div>
        <div style={S.relatedTitle}>{group.afterStoryName}</div>
        <div style={S.previewClamp}>{previewItem?.text || '暂无可读文本'}</div>
        <div style={S.relatedMetaRow}>
          <span style={S.relatedBadge}>默认展示第 1 条</span>
          {group.items.length > 1 && <span style={S.relatedBadge}>共 {group.items.length} 种条件分支</span>}
          <span style={S.relatedHint}>点击查看完整后日谈与差异</span>
        </div>
      </div>
    </button>
  )
}

function VariantText({ item }) {
  if (!item) return null

  return (
    <div style={{ fontSize: 15, lineHeight: '2.05', whiteSpace: 'pre-wrap' }}>
      {item.segments.map((segment) => (
        <span key={segment.id} style={TONE_STYLE[segment.tone] || TONE_STYLE.common}>
          {segment.text}
        </span>
      ))}
    </div>
  )
}

function AfterStoryVariantModal({ group, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const activeItem = group?.items?.[currentIndex] || null
  const activeImage = activeItem?.pic || group?.afterStoryImage || group?.fallbackImage || null
  const { url, loading } = useResolvedImage(activeImage)

  useEffect(() => {
    setCurrentIndex(0)
  }, [group?.afterStoryId])

  useEffect(() => {
    if (!group) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') {
        setCurrentIndex((index) => (index - 1 + group.items.length) % group.items.length)
      }
      if (event.key === 'ArrowRight') {
        setCurrentIndex((index) => (index + 1) % group.items.length)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [group, onClose])

  if (!group) return null

  return (
    <div style={S.modalMask} onClick={onClose}>
      <div style={S.modalPanel} onClick={(event) => event.stopPropagation()}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.modalTitle}>{group.afterStoryName}</div>
            <div style={S.modalSubTitle}>
              {group.overName} 对应的角色后日谈。左右切换可以查看不同条件下的文本差异，越亮的句段越偏向当前条件特有内容。
            </div>
          </div>
          <div style={S.modalActions}>
            <button type="button" style={actionButtonStyle} onClick={() => setCurrentIndex((currentIndex - 1 + group.items.length) % group.items.length)}>
              上一条
            </button>
            <span style={S.relatedBadge}>{currentIndex + 1} / {group.items.length}</span>
            <button type="button" style={actionButtonStyle} onClick={() => setCurrentIndex((currentIndex + 1) % group.items.length)}>
              下一条
            </button>
            <button type="button" style={actionButtonStyle} onClick={onClose}>关闭</button>
          </div>
        </div>

        <div style={S.modalBody}>
          <div style={S.modalContent}>
            <div style={S.modalImageWrap}>
              {loading && <div style={{ ...S.imagePlaceholder, height: 216 }}>加载中…</div>}
              {!loading && !url && <div style={{ ...S.imagePlaceholder, height: 216 }}>后日谈配图</div>}
              {!loading && url && <img src={url} alt="" style={S.modalImage} />}
            </div>
            <div style={S.modalTextCard}>
              <div style={S.relatedMetaRow}>
                <span style={S.relatedBadge}>条件分支 {currentIndex + 1}</span>
                {activeItem?.note && <span style={S.relatedBadge}>{activeItem.note}</span>}
              </div>
              <div style={{ marginTop: 14 }}>
                <VariantText item={activeItem} />
              </div>
              <div style={S.modalLegend}>
                <span style={{ ...S.relatedBadge, ...TONE_STYLE.common }}>高频共通</span>
                <span style={{ ...S.relatedBadge, ...TONE_STYLE.shared }}>局部共享</span>
                <span style={{ ...S.relatedBadge, ...TONE_STYLE.unique }}>当前分支特有</span>
              </div>
            </div>
          </div>
        </div>
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
  const [activeAfterStoryId, setActiveAfterStoryId] = useState(null)
  const cardsById = useConfigStore((state) => state.cardsById)

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

  const analyzedGroups = useMemo(
    () => relatedAfterStories.map((group) => ({
      ...group,
      overName: data?.name || '',
      fallbackImage: resolveAfterStoryFallbackImage(group.afterStoryName, cardsById),
      items: buildAfterStoryVariantAnalysis(group.items),
    })),
    [cardsById, data?.name, relatedAfterStories]
  )

  const activeGroup = analyzedGroups.find((group) => group.afterStoryId === activeAfterStoryId) || null

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

      {analyzedGroups.length > 0 && (
        <div>
          <div style={S.sectionTitle}>关联后日谈</div>
          {analyzedGroups.map((group) => (
            <RelatedAfterStoryCard
              key={group.afterStoryId}
              group={group}
              onOpen={() => setActiveAfterStoryId(group.afterStoryId)}
            />
          ))}
        </div>
      )}

      {data.icon && <div style={S.meta}>icon: {data.icon}</div>}

      <AfterStoryVariantModal
        group={activeGroup}
        onClose={() => setActiveAfterStoryId(null)}
      />
    </div>
  )
}

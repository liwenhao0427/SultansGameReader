import { useEffect, useMemo, useState } from 'react'
import { useResolvedImage } from '../../services/imageResolver'
import { getAfterStoryRelations } from '../../services/afterStoryRelations'
import useConfigStore from '../../stores/useConfigStore'
import { AfterStoryVariantModal, buildAfterStoryVariantGroup, RelatedAfterStoryCard } from './AfterStoryVariantViewer'

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

export default function OverDetail({ data }) {
  const [relatedAfterStories, setRelatedAfterStories] = useState([])
  const [activeState, setActiveState] = useState({ groupId: null, index: 0 })
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
    () => relatedAfterStories.map((group) => buildAfterStoryVariantGroup({
      ...group,
      groupId: `${data?.id || 'over'}:${group.afterStoryId}`,
      overId: String(data?.id || ''),
      overName: data?.name || '',
    }, cardsById)),
    [cardsById, data?.id, data?.name, relatedAfterStories]
  )

  const activeGroup = analyzedGroups.find((group) => group.groupId === activeState.groupId)

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
              key={group.groupId}
              group={group}
              onOpen={() => setActiveState({ groupId: group.groupId, index: 0 })}
            />
          ))}
        </div>
      )}

      {data.icon && <div style={S.meta}>icon: {data.icon}</div>}

      <AfterStoryVariantModal
        groups={analyzedGroups}
        activeGroupId={activeGroup?.groupId || null}
        activeIndex={activeState.index}
        onGroupChange={(groupId, index) => setActiveState({ groupId, index })}
        onClose={() => setActiveState({ groupId: null, index: 0 })}
      />
    </div>
  )
}

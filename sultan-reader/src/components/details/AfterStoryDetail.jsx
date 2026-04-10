import { useEffect, useMemo, useState } from 'react'
import { useResolvedImage } from '../../services/imageResolver'
import { getAfterStoryRelations } from '../../services/afterStoryRelations'
import useConfigStore from '../../stores/useConfigStore'
import { AfterStoryVariantModal, buildAfterStoryVariantGroup } from './AfterStoryVariantViewer'

const S = {
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  title: { color: '#89b4fa', fontSize: 18, fontWeight: 'bold' },
  imageWrap: {
    width: 160,
    borderRadius: 18,
    overflow: 'hidden',
    border: '1px solid rgba(212, 184, 126, 0.12)',
    background: 'rgba(22, 18, 13, 0.88)',
    marginBottom: 14,
  },
  image: { width: '100%', display: 'block', objectFit: 'contain', objectPosition: 'top center' },
  imagePlaceholder: {
    height: 220,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(241, 232, 213, 0.42)',
    fontSize: 12,
  },
  desc: { color: 'rgba(241, 232, 213, 0.68)', fontSize: 13, lineHeight: 1.75, marginBottom: 14 },
  groupList: { display: 'grid', gap: 10 },
  groupButton: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 16,
    border: '1px solid rgba(212, 184, 126, 0.12)',
    background: 'rgba(24, 24, 37, 0.62)',
    color: '#f1e8d5',
    textAlign: 'left',
    cursor: 'pointer',
  },
  groupName: { fontSize: 14, fontWeight: 700, color: '#f3e7cb' },
  groupMeta: { marginTop: 6, fontSize: 12, color: 'rgba(241, 232, 213, 0.58)' },
  actionButton: {
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid rgba(212, 184, 126, 0.18)',
    background: 'rgba(212, 184, 126, 0.08)',
    color: '#f1e8d5',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
}

function HeaderImage({ pic }) {
  const { url, loading } = useResolvedImage(pic)
  if (!pic) return null

  return (
    <div style={S.imageWrap}>
      {loading && <div style={S.imagePlaceholder}>加载中…</div>}
      {!loading && !url && <div style={S.imagePlaceholder}>暂无配图</div>}
      {!loading && url && <img src={url} alt="" style={S.image} />}
    </div>
  )
}

export default function AfterStoryDetail({ data }) {
  const [activeState, setActiveState] = useState({ groupId: null, index: 0 })
  const cardsById = useConfigStore((state) => state.cardsById)
  const [relations, setRelations] = useState({ afterStoryToOvers: {} })

  useEffect(() => {
    let cancelled = false
    getAfterStoryRelations().then((result) => {
      if (!cancelled) setRelations(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const linkedOvers = relations.afterStoryToOvers?.[String(data?.id)] || []

  const viewerGroups = useMemo(
    () => linkedOvers.length > 0
      ? linkedOvers.map((over) => buildAfterStoryVariantGroup({
        groupId: `${over.overId}:${data?.id}`,
        overId: over.overId,
        overName: over.overName,
        afterStoryId: String(data?.id),
        afterStoryName: data?.name || String(data?.id),
        afterStoryImage: Array.isArray(data?.extra) ? (data.extra.find((item) => item?.pic)?.pic || null) : null,
        items: (Array.isArray(data?.extra) ? data.extra : [])
          .filter((item) => item?.result_text || item?.pic)
          .filter((item) => {
            const relationGroup = (relations.overToAfterStories?.[over.overId] || [])
              .find((group) => group.afterStoryId === String(data?.id))
            if (!relationGroup) return true
            const allowed = new Set(relationGroup.items.map((entry) => entry.key))
            return allowed.has(item.key)
          })
          .map((item, index) => ({
            key: item.key || `${data?.id}:${index}`,
            text: item.result_text || '',
            pic: item.pic || null,
            note: item.key__c || '',
            condition: item.condition || null,
          })),
      }, cardsById))
      : [buildAfterStoryVariantGroup({
        groupId: `all:${data?.id}`,
        overId: '',
        overName: '',
        afterStoryId: String(data?.id),
        afterStoryName: data?.name || String(data?.id),
        afterStoryImage: Array.isArray(data?.extra) ? (data.extra.find((item) => item?.pic)?.pic || null) : null,
        items: (Array.isArray(data?.extra) ? data.extra : [])
          .filter((item) => item?.result_text || item?.pic)
          .map((item, index) => ({
            key: item.key || `${data?.id}:${index}`,
            text: item.result_text || '',
            pic: item.pic || null,
            note: item.key__c || '',
            condition: item.condition || null,
          })),
      }, cardsById)],
    [cardsById, data, linkedOvers, relations.overToAfterStories]
  )

  const defaultImage = Array.isArray(data?.extra) ? (data.extra.find((item) => item?.pic)?.pic || null) : null
  const activeGroup = viewerGroups.find((group) => group.groupId === activeState.groupId) || null

  if (!data) return null

  return (
    <div>
      <div style={S.titleRow}>
        <div style={S.title}>{data.name || `后日谈 ${data.id}`}</div>
        <button
          type="button"
          style={S.actionButton}
          onClick={() => setActiveState({ groupId: viewerGroups[0]?.groupId || null, index: 0 })}
        >
          分支阅读
        </button>
      </div>

      <HeaderImage pic={defaultImage} />

      <div style={S.desc}>
        当前后日谈支持弹窗分支阅读。
        {linkedOvers.length > 0 ? ' 你可以按结局区分查看，也可以在弹窗里切到跨结局连续翻看。' : ' 当前未匹配到明确结局时，将按全部文本连续阅读。'}
      </div>

      <div style={S.groupList}>
        {viewerGroups.map((group) => (
          <button
            key={group.groupId}
            type="button"
            style={S.groupButton}
            onClick={() => setActiveState({ groupId: group.groupId, index: 0 })}
          >
            <div style={S.groupName}>{group.overName || '不区分结局'}</div>
            <div style={S.groupMeta}>共 {group.items.length} 条分支，点击进入弹窗阅读</div>
          </button>
        ))}
      </div>

      <AfterStoryVariantModal
        groups={viewerGroups}
        activeGroupId={activeGroup?.groupId || null}
        activeIndex={activeState.index}
        onGroupChange={(groupId, index) => setActiveState({ groupId, index })}
        onClose={() => setActiveState({ groupId: null, index: 0 })}
      />
    </div>
  )
}

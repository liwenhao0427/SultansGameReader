import { useEffect, useState } from 'react'
import { useResolvedImage } from '../../services/imageResolver'
import { buildAfterStoryVariantAnalysis } from '../../services/afterStoryDiff'
import { resolveAfterStoryFallbackImage } from '../../services/afterStoryImageFallback'
import { parseAfterStoryConditionObject } from '../../services/afterStoryCondition'
import RawFileView from '../RawFileView'

export const AFTER_STORY_TONE_STYLE = {
  p100: { color: 'rgba(206, 203, 196, 0.74)' },
  p80: { color: '#f3efe6' },
  p60: { color: '#f2df9f' },
  p40: { color: '#ffd668' },
  p20: { color: '#ffb44d', textShadow: '0 0 16px rgba(255, 159, 64, 0.18)' },
}

export const AFTER_STORY_VIEWER_STYLE = {
  imageWrap: {
    aspectRatio: '0.72',
    borderRadius: 20,
    overflow: 'hidden',
    border: '1px solid rgba(212, 184, 126, 0.12)',
    background: 'rgba(22, 18, 13, 0.88)',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    objectPosition: 'top center',
    display: 'block',
  },
  imagePlaceholder: {
    height: 220,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(241, 232, 213, 0.42)',
    fontSize: 12,
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
    padding: '5px 11px',
    borderRadius: 999,
    fontSize: 11,
    lineHeight: 1.2,
    color: '#f0d6a0',
    background: 'rgba(212, 184, 126, 0.12)',
    border: '1px solid rgba(212, 184, 126, 0.12)',
    whiteSpace: 'nowrap',
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
    width: 'min(1040px, 92vw)',
    height: '84vh',
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
    alignItems: 'flex-start',
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
    flexWrap: 'nowrap',
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
    aspectRatio: '0.72',
    borderRadius: 22,
    overflow: 'hidden',
    border: '1px solid rgba(212, 184, 126, 0.12)',
    background: 'rgba(18, 15, 11, 0.92)',
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
  conditionTagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 6,
  },
  conditionTag: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 11px',
    borderRadius: 999,
    fontSize: 12,
    lineHeight: 1.4,
    border: '1px solid rgba(212, 184, 126, 0.12)',
    background: 'rgba(212, 184, 126, 0.1)',
    whiteSpace: 'nowrap',
  },
  conditionSectionTag: {
    background: 'rgba(212, 184, 126, 0.06)',
    borderStyle: 'dashed',
    letterSpacing: '0.04em',
  },
}

const actionButtonStyle = {
  padding: '10px 16px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.18)',
  background: 'rgba(212, 184, 126, 0.08)',
  color: '#f1e8d5',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  minWidth: 74,
  fontSize: 14,
}

function VariantImage({ pic, style, height = 120 }) {
  const { url, loading } = useResolvedImage(pic)

  return (
    <div style={{ ...style.imageWrap, height }}>
      {loading && <div style={{ ...style.imagePlaceholder, height }}>加载中...</div>}
      {!loading && !url && <div style={{ ...style.imagePlaceholder, height }}>后日谈配图</div>}
      {!loading && url && <img src={url} alt="" style={style.image} />}
    </div>
  )
}

function VariantText({ item }) {
  if (!item) return null

  return (
    <div style={{ fontSize: 15, lineHeight: '2.05', whiteSpace: 'pre-wrap' }}>
      {item.segments.map((segment) => (
        <span key={segment.id} style={AFTER_STORY_TONE_STYLE[segment.tone] || AFTER_STORY_TONE_STYLE.p100}>
          {segment.text}
        </span>
      ))}
    </div>
  )
}

function normalizeConditionText(text) {
  return String(text || '')
    .replace(/[。！？；，、.!?;:\s]/g, '')
    .trim()
}

function getToneByFrequency(count, total) {
  if (!count || total <= 1) return 'p20'

  const ratio = count / total
  if (ratio >= 1) return 'p100'
  if (ratio >= 0.8) return 'p80'
  if (ratio >= 0.6) return 'p60'
  if (ratio >= 0.4) return 'p40'
  return 'p20'
}

export function buildAfterStoryVariantGroup(group, cardsById, overMap = {}) {
  const analyzedItems = buildAfterStoryVariantAnalysis(group.items).map((item) => ({
    ...item,
    conditionLines: parseAfterStoryConditionObject(item.condition, cardsById),
  }))

  const conditionCountMap = new Map()
  for (const item of analyzedItems) {
    const uniqueConditionSet = new Set(
      (item.conditionLines || [])
        .filter((line) => line.type === 'condition')
        .map((line) => normalizeConditionText(line.text))
        .filter(Boolean)
    )

    uniqueConditionSet.forEach((normalizedText) => {
      conditionCountMap.set(normalizedText, (conditionCountMap.get(normalizedText) || 0) + 1)
    })
  }

  return {
    ...group,
    fallbackImage: resolveAfterStoryFallbackImage(group.afterStoryName, cardsById),
    overName: overMap[group.overId]?.name || group.overName || '',
    items: analyzedItems.map((item) => ({
      ...item,
      conditionLines: (item.conditionLines || []).map((line) => {
        if (line.type !== 'condition') return line

        const normalizedText = normalizeConditionText(line.text)
        return {
          ...line,
          tone: normalizedText
            ? getToneByFrequency(conditionCountMap.get(normalizedText), analyzedItems.length)
            : 'p100',
        }
      }),
    })),
  }
}

export function RelatedAfterStoryCard({ group, onOpen, style = AFTER_STORY_VIEWER_STYLE }) {
  const previewItem = group.items[0]
  const previewImage = previewItem?.pic || group.afterStoryImage || group.fallbackImage || null

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ ...style.relatedGroup, textAlign: 'left' }}
    >
      <VariantImage pic={previewImage} style={style} />
      <div>
        <div style={style.relatedTitle}>{group.afterStoryName}</div>
        <div style={style.previewClamp}>{previewItem?.text || '暂无可读文本'}</div>
        <div style={style.relatedMetaRow}>
          <span style={style.relatedBadge}>默认展示第 1 条</span>
          {group.items.length > 1 && <span style={style.relatedBadge}>共 {group.items.length} 种条件分支</span>}
          {group.overName && <span style={style.relatedBadge}>{group.overName}</span>}
          <span style={style.relatedHint}>点击查看完整后日谈与差异</span>
        </div>
      </div>
    </button>
  )
}

export function AfterStoryVariantModal({
  groups,
  activeGroupId,
  activeIndex = 0,
  onClose,
  onGroupChange,
  rawSourcePath = null,
}) {
  const group = groups.find((item) => item.groupId === activeGroupId) || null
  const [currentIndex, setCurrentIndex] = useState(activeIndex)
  const [rawContent, setRawContent] = useState(null)

  useEffect(() => {
    setCurrentIndex(activeIndex)
  }, [activeIndex, activeGroupId])

  useEffect(() => {
    if (!group) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') moveVariant(-1)
      if (event.key === 'ArrowRight') moveVariant(1)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [group, currentIndex, groups])

  if (!group) return null

  const activeItem = group.items[currentIndex] || group.items[0] || null
  const activeImage = activeItem?.pic || group.afterStoryImage || group.fallbackImage || null

  function moveVariant(step) {
    if (!group) return

    const nextIndex = currentIndex + step
    if (nextIndex >= 0 && nextIndex < group.items.length) {
      setCurrentIndex(nextIndex)
      return
    }

    setCurrentIndex(step > 0 ? 0 : Math.max(0, group.items.length - 1))
  }

  function moveGroup(step) {
    if (!group) return

    const currentGroupIndex = groups.findIndex((item) => item.groupId === group.groupId)
    const nextGroupIndex = currentGroupIndex + step
    if (nextGroupIndex < 0 || nextGroupIndex >= groups.length) return

    const nextGroup = groups[nextGroupIndex]
    onGroupChange(nextGroup.groupId, 0)
  }

  async function handleViewRaw() {
    if (!rawSourcePath) return

    try {
      const content = await window.electronAPI.fileReadRaw(rawSourcePath)
      setRawContent(content)
    } catch (error) {
      setRawContent(`读取失败：${error?.message || '未知错误'}`)
    }
  }

  return (
    <>
      <div style={AFTER_STORY_VIEWER_STYLE.modalMask} onClick={onClose}>
        <div style={AFTER_STORY_VIEWER_STYLE.modalPanel} onClick={(event) => event.stopPropagation()}>
          <div style={AFTER_STORY_VIEWER_STYLE.modalHeader}>
            <div>
              <div style={AFTER_STORY_VIEWER_STYLE.modalTitle}>{group.afterStoryName}</div>
              <div style={AFTER_STORY_VIEWER_STYLE.modalSubTitle}>
                {group.overName ? `${group.overName} 对应的角色后日谈。` : '角色后日谈阅读。'}
                左右切换查看当前结局下不同条件的文本差异，结局按钮会直接跳到上个结局或下个结局。
              </div>
            </div>
            <div style={AFTER_STORY_VIEWER_STYLE.modalActions}>
              <button type="button" style={actionButtonStyle} onClick={() => moveVariant(-1)}>上一条</button>
              <span style={AFTER_STORY_VIEWER_STYLE.relatedBadge}>{currentIndex + 1} / {group.items.length}</span>
              <button type="button" style={actionButtonStyle} onClick={() => moveVariant(1)}>下一条</button>
              {groups.length > 1 && (
                <button type="button" style={actionButtonStyle} onClick={() => moveGroup(-1)}>上个结局</button>
              )}
              {groups.length > 1 && (
                <button type="button" style={actionButtonStyle} onClick={() => moveGroup(1)}>下个结局</button>
              )}
              {rawSourcePath && (
                <button type="button" style={actionButtonStyle} onClick={handleViewRaw}>查看原文件</button>
              )}
              <button type="button" style={actionButtonStyle} onClick={onClose}>关闭</button>
            </div>
          </div>

          <div style={AFTER_STORY_VIEWER_STYLE.modalBody}>
            <div style={AFTER_STORY_VIEWER_STYLE.modalContent}>
              <div style={AFTER_STORY_VIEWER_STYLE.modalImageWrap}>
                <VariantImage pic={activeImage} style={AFTER_STORY_VIEWER_STYLE} height={216} />
              </div>
              <div style={AFTER_STORY_VIEWER_STYLE.modalTextCard}>
                <div style={AFTER_STORY_VIEWER_STYLE.relatedMetaRow}>
                  {group.overName && <span style={AFTER_STORY_VIEWER_STYLE.relatedBadge}>{group.overName}</span>}
                  <span style={AFTER_STORY_VIEWER_STYLE.relatedBadge}>条件分支 {currentIndex + 1}</span>
                  {activeItem?.note && <span style={AFTER_STORY_VIEWER_STYLE.relatedBadge}>{activeItem.note}</span>}
                </div>

                <div style={{ marginTop: 14 }}>
                  {activeItem?.conditionLines?.length > 0 && (
                    <div style={AFTER_STORY_VIEWER_STYLE.conditionTagList}>
                      {activeItem.conditionLines.map((line, index) => (
                        <span
                          key={`${line.type}:${index}:${line.text}`}
                          style={{
                            ...AFTER_STORY_VIEWER_STYLE.conditionTag,
                            ...(line.type === 'section' ? AFTER_STORY_VIEWER_STYLE.conditionSectionTag : null),
                            ...(line.type === 'condition'
                              ? AFTER_STORY_TONE_STYLE[line.tone] || AFTER_STORY_TONE_STYLE.p100
                              : AFTER_STORY_TONE_STYLE.p100),
                          }}
                        >
                          {line.text}
                        </span>
                      ))}
                    </div>
                  )}

                  <VariantText item={activeItem} />
                </div>

                <div style={AFTER_STORY_VIEWER_STYLE.modalLegend}>
                  <span style={{ ...AFTER_STORY_VIEWER_STYLE.relatedBadge, ...AFTER_STORY_TONE_STYLE.p100 }}>100%</span>
                  <span style={{ ...AFTER_STORY_VIEWER_STYLE.relatedBadge, ...AFTER_STORY_TONE_STYLE.p80 }}>80%</span>
                  <span style={{ ...AFTER_STORY_VIEWER_STYLE.relatedBadge, ...AFTER_STORY_TONE_STYLE.p60 }}>60%</span>
                  <span style={{ ...AFTER_STORY_VIEWER_STYLE.relatedBadge, ...AFTER_STORY_TONE_STYLE.p40 }}>40%</span>
                  <span style={{ ...AFTER_STORY_VIEWER_STYLE.relatedBadge, ...AFTER_STORY_TONE_STYLE.p20 }}>20%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {rawContent !== null && (
        <RawFileView content={rawContent} onClose={() => setRawContent(null)} />
      )}
    </>
  )
}

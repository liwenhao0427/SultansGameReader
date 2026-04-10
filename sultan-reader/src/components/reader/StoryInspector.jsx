import { useEffect, useMemo, useRef, useState } from 'react'
import useConfigStore from '../../stores/useConfigStore'
import { useResolvedImage } from '../../services/imageResolver'
import { adaptStoryData } from '../../services/storyAdapter'
import { READER_CHROME } from '../../readerChromeConfig'
import { getCardRarityFrameAsset } from '../../resourceConfig'
import { linkNodesOnCanvas, mountNodeOnCanvas } from '../../services/graphNavigation'
import RawFileView from '../RawFileView'

const FULLSCREEN_TYPES = new Set(['rite', 'event', 'dt', 'over', 'after_story'])

function splitIntro(text) {
  if (!text) return []

  return text
    .split(/(?<=[。！？\n])/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
}

function CardPortrait({ card, compact = false, showName = true }) {
  const { url } = useResolvedImage(card?.image)
  const { url: rareFrameUrl } = useResolvedImage(getCardRarityFrameAsset(card?.rare))
  const width = compact ? 72 : 94
  const height = compact ? 108 : 142
  const artInset = compact ? '4px 6px 18px' : '5px 8px 22px'

  return (
    <div style={{
      width,
      height,
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid rgba(233, 219, 183, 0.22)',
      boxShadow: '0 14px 26px rgba(0, 0, 0, 0.26)',
      backgroundColor: 'rgba(18, 15, 11, 0.92)',
      backgroundImage: rareFrameUrl ? `url("${rareFrameUrl}")` : 'none',
      backgroundRepeat: 'no-repeat',
      backgroundSize: '100% 100%',
      backgroundPosition: 'center',
      position: 'relative',
      flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute',
        inset: artInset,
        overflow: 'hidden',
        borderRadius: compact ? 14 : 18,
        background: 'linear-gradient(180deg, rgba(87, 78, 58, 0.55), rgba(21, 17, 12, 0.88))',
      }}>
        {url ? (
          <img
            src={url}
            alt={card?.name || ''}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 8,
            textAlign: 'center',
            color: '#f4e9cd',
            fontSize: compact ? 11 : 12,
            lineHeight: 1.5,
          }}>
            {card?.name || '未知卡牌'}
          </div>
        )}
      </div>
      {showName && (
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: compact ? '6px 6px 7px' : '8px 8px 9px',
          backgroundImage: 'linear-gradient(180deg, transparent, rgba(4, 3, 2, 0.9))',
          color: '#fff7e6',
          fontSize: compact ? 10 : 11,
          lineHeight: 1.4,
          zIndex: 2,
        }}>
          {card?.name}
        </div>
      )}
    </div>
  )
}

function CardStack({ cards }) {
  if (!cards?.length) return null

  return (
    <div style={{ position: 'relative', width: 94 + Math.max(0, cards.length - 1) * 18, height: 142 }}>
      {cards.slice(0, 4).map((card, index) => (
        <div
          key={`${card.id}-${index}`}
          style={{
            position: 'absolute',
            left: index * 18,
            top: 0,
            zIndex: index + 1,
          }}
        >
          <CardPortrait card={card} />
        </div>
      ))}
    </div>
  )
}

function PreviewImage({ pic, maxHeight = 320 }) {
  const { url, loading } = useResolvedImage(pic)

  return (
    <div style={{
      width: '100%',
      minHeight: maxHeight,
      maxHeight,
      borderRadius: 24,
      overflow: 'hidden',
      border: '1px solid rgba(212, 184, 126, 0.14)',
      backgroundColor: 'rgba(17, 14, 10, 0.94)',
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.28)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {loading && <div style={imageFallbackStyle}>载入图片中…</div>}
      {!loading && url && (
        <img
          src={url}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      )}
      {!loading && !url && <div style={imageFallbackStyle}>暂无对应图片</div>}
    </div>
  )
}

function ConditionPreview({ text, color = '#dcc8a3', maxLines = 2 }) {
  if (!text) return null

  return (
    <div
      title={text}
      style={{
        ...smallLineStyle,
        marginTop: 4,
        color,
        fontSize: 12,
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: maxLines,
        overflow: 'hidden',
      }}
    >
      条件：{text}
    </div>
  )
}

function SlotButton({ slot, active, candidate, tags, onClick, slotBgKey }) {
  const { url: slotBgUrl } = useResolvedImage(slotBgKey)
  const previewCard = candidate?.cards?.[0] || slot.defaultCards?.[0] || null
  const slotCaption = candidate?.label || slot.defaultCards?.[0]?.name || slot.title

  return (
    <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
      <button
        type="button"
        onClick={onClick}
        style={{
          width: READER_CHROME.assets.slotFrame.width,
          minHeight: READER_CHROME.assets.slotFrame.minHeight,
          padding: 0,
          borderRadius: 22,
          border: active ? '1px solid rgba(239, 215, 169, 0.54)' : '1px solid rgba(219, 207, 181, 0.12)',
          backgroundColor: 'transparent',
          boxShadow: active ? '0 0 0 3px rgba(212, 184, 126, 0.12)' : 'none',
          cursor: 'pointer',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div style={{
          width: READER_CHROME.assets.slotFrame.width,
          minHeight: READER_CHROME.assets.slotFrame.minHeight,
          borderRadius: 22,
          backgroundImage: slotBgUrl
            ? `linear-gradient(180deg, rgba(8, 8, 8, 0.18), rgba(8, 8, 8, 0.48)), url("${slotBgUrl}")`
            : 'linear-gradient(180deg, rgba(180, 165, 139, 0.88), rgba(94, 80, 57, 0.92))',
          backgroundRepeat: 'no-repeat',
          backgroundSize: READER_CHROME.assets.slotFrame.backgroundSize,
          backgroundPosition: READER_CHROME.assets.slotFrame.backgroundPosition,
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            top: 8,
            left: 8,
            padding: '2px 6px',
            borderRadius: 999,
            background: 'rgba(12, 10, 8, 0.6)',
            color: '#f3e3c1',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
          }}>
            {slot.title}
          </div>
          {previewCard ? (
            <div style={{ position: 'absolute', inset: '6px 7px 10px' }}>
              <CardPortrait card={previewCard} compact showName={false} />
            </div>
          ) : (
            <div style={{
              position: 'absolute',
              inset: '10px 10px 12px',
              borderRadius: 18,
              background: 'linear-gradient(180deg, rgba(40, 33, 24, 0.4), rgba(12, 10, 8, 0.72))',
            }} />
          )}
          <div style={{
            position: 'absolute',
            left: 8,
            right: 8,
            bottom: 8,
            color: '#fff4dd',
            fontWeight: 800,
            fontSize: 12,
            lineHeight: 1.25,
            textShadow: '0 2px 6px rgba(0,0,0,0.68)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {slotCaption}
          </div>
        </div>
      </button>
      {tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                tag.onRemove?.()
              }}
              style={slotTagButtonStyle}
            >
              <span>{tag.label}</span>
              <span style={{ opacity: 0.8 }}>x</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CandidateHandItem({ candidate, active, onSelect }) {
  const previewCard = candidate.cards?.[0] || null

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: '100%',
        minWidth: 0,
        padding: 12,
        borderRadius: 20,
        border: active
          ? '1px solid rgba(239, 215, 169, 0.54)'
          : '1px solid rgba(212, 184, 126, 0.16)',
        backgroundColor: active ? 'rgba(212, 184, 126, 0.16)' : 'rgba(18, 15, 11, 0.92)',
        color: '#f3ebda',
        boxShadow: active
          ? '0 0 0 3px rgba(212, 184, 126, 0.12), 0 18px 34px rgba(0,0,0,0.24)'
          : '0 14px 28px rgba(0,0,0,0.22)',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{
        minHeight: 122,
        borderRadius: 18,
        overflow: 'hidden',
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(41, 33, 24, 0.96), rgba(24, 18, 13, 0.96))',
      }}>
        {candidate.cards.length > 1 ? (
          <div style={{ position: 'absolute', inset: '10px 12px 12px' }}>
            <CardStack cards={candidate.cards} />
          </div>
        ) : previewCard ? (
          <div style={{ position: 'absolute', inset: '8px 10px 10px' }}>
            <CardPortrait card={previewCard} showName={false} />
          </div>
        ) : null}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(8, 7, 6, 0.12), rgba(8, 7, 6, 0.68))',
        }} />
        <div style={{
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 12,
          zIndex: 2,
        }}>
          <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.3, color: '#fff2d7' }}>
            {candidate.label}
          </div>
          <ConditionPreview text={candidate.conditionText} color="#e1cfad" />
        </div>
        {!previewCard && candidate.cards.length <= 1 && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 18px 44px',
            textAlign: 'center',
            color: 'rgba(246, 230, 196, 0.4)',
            fontSize: 18,
            fontWeight: 700,
          }}>
            {candidate.label}
          </div>
        )}
      </div>
    </button>
  )
}

function SettlementHintItem({ hint, active, onToggle }) {
  const previewCard = hint.cards?.[0] || null

  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: '100%',
        padding: 10,
        borderRadius: 18,
        border: active ? '1px solid rgba(143, 191, 119, 0.42)' : '1px solid rgba(212, 184, 126, 0.14)',
        background: active ? 'rgba(100, 140, 83, 0.12)' : 'rgba(22, 18, 14, 0.94)',
        color: '#f1e8d5',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{
        minHeight: 94,
        borderRadius: 14,
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(40, 31, 23, 0.98), rgba(21, 16, 12, 0.98))',
      }}>
        {previewCard && (
          <div style={{ position: 'absolute', inset: '8px 10px 10px' }}>
            <CardPortrait card={previewCard} compact showName={false} />
          </div>
        )}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(8, 7, 6, 0.15), rgba(8, 7, 6, 0.74))',
        }} />
        <div style={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 10,
          zIndex: 2,
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3, color: '#fff0d3' }}>
            {hint.label}
          </div>
          <ConditionPreview text={hint.conditionText} />
        </div>
      </div>
    </button>
  )
}

export default function StoryInspector({ type, data, onClose }) {
  const cardsLite = useConfigStore((s) => s.cardsLite)
  const cardsById = useConfigStore((s) => s.cardsById)
  const model = adaptStoryData(type, data, cardsLite, cardsById)
  const [templateData, setTemplateData] = useState(null)
  const [rawContent, setRawContent] = useState(null)
  const { url: headerIconUrl } = useResolvedImage(model?.headerIcon)

  const [activeSlotId, setActiveSlotId] = useState(null)
  const [slotSelections, setSlotSelections] = useState({})
  const [settlementSelections, setSettlementSelections] = useState({})
  const [globalSettlementSelections, setGlobalSettlementSelections] = useState([])
  const [revealedLineCount, setRevealedLineCount] = useState(1)
  const [revealedSegmentCount, setRevealedSegmentCount] = useState(0)
  const [autoAdvance, setAutoAdvance] = useState(false)
  const readerBodyRef = useRef(null)

  function buildDialogueLines(slotId, selections, settlementState, globalSelections = globalSettlementSelections) {
    const slot = model?.slots?.find((entry) => entry.id === slotId) || null
    const candidate = slot?.candidates?.find((entry) => entry.id === selections?.[slotId]) || slot?.candidates?.[0] || null
    void settlementState
    void globalSelections

    return splitIntro(model?.intro)
      .concat((candidate?.choiceTexts || []).map((entry) => entry.text))
  }

  useEffect(() => {
    if (!model) return

    const defaults = Object.fromEntries(
      (model.slots || []).map((slot) => [slot.id, slot.candidates?.[0]?.id || null])
    )
    const hintDefaults = Object.fromEntries(
      (model.slots || []).map((slot) => [slot.id, []])
    )
    const firstSlotId = model.slots?.[0]?.id || null
    const firstCandidate = model.slots?.[0]?.candidates?.[0] || null
    const initialLines = splitIntro(model.intro).concat((firstCandidate?.choiceTexts || []).map((entry) => entry.text))

    setSlotSelections(defaults)
    setSettlementSelections(hintDefaults)
    setGlobalSettlementSelections([])
    setActiveSlotId(firstSlotId)
    setRevealedLineCount(initialLines.length > 0 ? 1 : 0)
    setRevealedSegmentCount(0)
  }, [type, data?.id, data?._source_path])

  useEffect(() => {
    let cancelled = false

    if (type !== 'rite' || !model?.mappingId) {
      setTemplateData(null)
      return () => {
        cancelled = true
      }
    }

    window.electronAPI.configReadCache('rite_template', String(model.mappingId))
      .then((result) => {
        if (!cancelled) {
          setTemplateData(result || null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTemplateData(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [type, model?.mappingId])

  const selectedSlot = useMemo(
    () => model?.slots?.find((slot) => slot.id === activeSlotId) || null,
    [model?.slots, activeSlotId]
  )

  const selectedCandidate = useMemo(() => {
    if (!selectedSlot) return null
    return selectedSlot.candidates?.find((candidate) => candidate.id === slotSelections[selectedSlot.id]) || selectedSlot.candidates?.[0] || null
  }, [selectedSlot, slotSelections])

  const selectedSettlementHints = useMemo(() => {
    if (!selectedSlot) return []
    return (selectedSlot.settlementHints || []).filter((hint) => settlementSelections[selectedSlot.id]?.includes(hint.id))
  }, [selectedSlot, settlementSelections])

  const dialogueLines = useMemo(() => {
    const introLines = splitIntro(model?.intro)
    const candidateLines = (selectedCandidate?.choiceTexts || []).map((entry) => entry.text)
    return [...introLines, ...candidateLines].filter(Boolean)
  }, [model?.intro, selectedCandidate])

  const selectedHintIds = useMemo(
    () => new Set(Object.values(settlementSelections).flat()),
    [settlementSelections]
  )
  const selectedGlobalHintIds = useMemo(
    () => new Set(globalSettlementSelections),
    [globalSettlementSelections]
  )
  const selectedHintGuids = useMemo(
    () => new Set(
      (model?.slots || [])
        .flatMap((slot) => slot.settlementHints || [])
        .filter((hint) => selectedHintIds.has(hint.id))
        .map((hint) => hint.id.split(':').slice(-1)[0])
    ),
    [model?.slots, selectedHintIds]
  )
  const selectedGlobalHintGuids = useMemo(
    () => new Set(
      (model?.globalSettlementHints || [])
        .filter((hint) => selectedGlobalHintIds.has(hint.id))
        .map((hint) => hint.id.split(':').slice(-1)[0])
    ),
    [model?.globalSettlementHints, selectedGlobalHintIds]
  )
  const availableSegments = useMemo(() => {
    if (type !== 'rite') return model?.segments || []
    return (model?.segments || []).filter((segment) => (
      segment.guid && (selectedHintGuids.has(segment.guid) || selectedGlobalHintGuids.has(segment.guid))
    ))
  }, [model?.segments, selectedHintGuids, selectedGlobalHintGuids, type])

  const visibleLines = dialogueLines.slice(0, revealedLineCount)
  const visibleSegments = availableSegments.slice(0, revealedSegmentCount)
  const currentGateSegment = visibleSegments.find((segment) => segment.options?.length > 0)
  const canRevealLine = revealedLineCount < dialogueLines.length
  const canRevealSegment = !canRevealLine && !currentGateSegment && revealedSegmentCount < availableSegments.length
  const isFullscreenReader = FULLSCREEN_TYPES.has(type)
  const slotBackgroundMap = templateData?.slots || {}

  if (!model) return null

  async function handleViewRaw() {
    if (!data?._source_path) return
    try {
      const content = await window.electronAPI.fileReadRaw(data._source_path)
      setRawContent(content)
    } catch (error) {
      setRawContent(`读取失败：${error?.message || '未知错误'}`)
    }
  }

  async function handleOpenAction(action, offsetIndex = 0) {
    if (!action?.targetType || !action?.targetId) return

    const targetNodeKey = await mountNodeOnCanvas(
      {
        id: action.targetId,
        type: action.targetType,
        name: action.text,
      },
      { x: 460 + offsetIndex * 60, y: 180 + offsetIndex * 50 },
      { autoSelect: true, expandRelations: false }
    )

    if (targetNodeKey && data?.id != null) {
      linkNodesOnCanvas(
        `${type}:${data.id}`,
        action.targetType,
        action.targetId,
        action.branch === 'success' ? 'success' : action.branch === 'failed' ? 'failed' : 'default',
        action.text
      )
    }
  }

  function branchActions(segment, branch) {
    return (segment.choiceActions || []).filter((action) => action.branch === branch)
  }

  function resetFlow(nextSlotId = activeSlotId, nextSelections = slotSelections, nextSettlementSelections = settlementSelections, nextGlobalSelections = globalSettlementSelections) {
    const nextLines = buildDialogueLines(nextSlotId, nextSelections, nextSettlementSelections, nextGlobalSelections)
    setRevealedLineCount(nextLines.length > 0 ? 1 : 0)
    setRevealedSegmentCount(0)
  }

  function advanceFlow() {
    if (canRevealLine) {
      setRevealedLineCount((count) => Math.min(dialogueLines.length, count + 1))
      return
    }

    if (canRevealSegment) {
      setRevealedSegmentCount((count) => Math.min(availableSegments.length, count + 1))
      return
    }

    setAutoAdvance(false)
  }

  function handleSelectSlot(slotId) {
    setActiveSlotId(slotId)
    resetFlow(slotId)
  }

  function handleChangeCandidate(candidateId) {
    if (!selectedSlot) return

    const nextSelections = {
      ...slotSelections,
      [selectedSlot.id]: candidateId,
    }

    setSlotSelections(nextSelections)
    const nextLines = buildDialogueLines(selectedSlot.id, nextSelections, settlementSelections, globalSettlementSelections)
    setRevealedLineCount(nextLines.length > 0 ? 1 : 0)
    setRevealedSegmentCount(0)
  }

  function handleToggleSettlementHint(hintId) {
    if (!selectedSlot) return

    const slotId = selectedSlot.id
    const activeIds = settlementSelections[slotId] || []
    const nextIds = activeIds.includes(hintId)
      ? activeIds.filter((id) => id !== hintId)
      : [...activeIds, hintId]
    const nextSettlementSelections = {
      ...settlementSelections,
      [slotId]: nextIds,
    }

    setSettlementSelections(nextSettlementSelections)
    resetFlow(slotId, slotSelections, nextSettlementSelections, globalSettlementSelections)
  }

  function handleToggleGlobalSettlementHint(hintId) {
    const nextIds = globalSettlementSelections.includes(hintId)
      ? globalSettlementSelections.filter((id) => id !== hintId)
      : [...globalSettlementSelections, hintId]

    setGlobalSettlementSelections(nextIds)
    resetFlow(activeSlotId, slotSelections, settlementSelections, nextIds)
  }

  function handleManualReset() {
    const defaults = Object.fromEntries(
      (model.slots || []).map((slot) => [slot.id, slot.candidates?.[0]?.id || null])
    )
    const hintDefaults = Object.fromEntries(
      (model.slots || []).map((slot) => [slot.id, []])
    )
    setSlotSelections(defaults)
    setSettlementSelections(hintDefaults)
    setGlobalSettlementSelections([])
    setActiveSlotId(model.slots?.[0]?.id || null)

    const firstCandidate = model.slots?.[0]?.candidates?.[0] || null
    const nextLines = splitIntro(model.intro).concat((firstCandidate?.choiceTexts || []).map((entry) => entry.text))
    setRevealedLineCount(nextLines.length > 0 ? 1 : 0)
    setRevealedSegmentCount(0)
    setAutoAdvance(false)
  }

  useEffect(() => {
    if (!readerBodyRef.current) return

    const frame = requestAnimationFrame(() => {
      const element = readerBodyRef.current
      if (!element) return
      element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
    })

    return () => cancelAnimationFrame(frame)
  }, [revealedLineCount, revealedSegmentCount])

  useEffect(() => {
    if (!autoAdvance) return

    if (!canRevealLine && !canRevealSegment) {
      setAutoAdvance(false)
      return
    }

    const timer = window.setInterval(() => {
      advanceFlow()
    }, 1800)

    return () => window.clearInterval(timer)
  }, [autoAdvance, canRevealLine, canRevealSegment, dialogueLines.length, availableSegments.length])

  const headerBlock = (
    <div style={storyHeaderShellStyle}>
      <div style={storyHeaderCardStyle}>
        {model.meta.length > 0 && (
          <div style={storyMetaWrapStyle}>
            {model.meta.slice(0, 6).map((item) => (
              <span key={item} style={metaChipCompactStyle}>
                {item}
              </span>
            ))}
          </div>
        )}
        <div style={{ fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', color: READER_CHROME.header.subtitleColor }}>
          {model.subtitle || model.kind}
        </div>
        <div style={storyHeaderTitleRowStyle}>
          {headerIconUrl && (
            <div
              aria-hidden="true"
              style={{
                width: 52,
                height: 52,
                flexShrink: 0,
                borderRadius: 12,
                backgroundColor: 'rgba(255, 248, 235, 0.28)',
                backgroundImage: `url("${headerIconUrl}")`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                boxShadow: '0 10px 24px rgba(72, 46, 19, 0.16)',
              }}
            />
          )}
          <div style={storyHeaderTitleStyle}>
            {model.title}
          </div>
        </div>
      </div>
    </div>
  )

  const content = (
    <div style={{
      height: '100%',
      minHeight: 0,
      display: 'grid',
      color: '#f1e8d5',
      overflow: 'hidden',
    }}>
      <div style={{
        height: '100%',
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: model.slots.length > 0 ? '232px minmax(280px, 360px) minmax(0, 0.92fr)' : 'minmax(280px, 360px) minmax(0, 0.92fr)',
        gap: 22,
        overflow: 'hidden',
      }}>
        {model.slots.length > 0 && (
          <div style={{
            height: '100%',
            minHeight: 0,
            borderRadius: 32,
            border: '1px solid rgba(212, 184, 126, 0.12)',
            backgroundColor: 'rgba(20, 16, 12, 0.92)',
            boxShadow: '0 20px 44px rgba(0, 0, 0, 0.26)',
            padding: '20px 16px',
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr) auto',
            gap: 16,
            overflow: 'hidden',
          }}>
            <div>
              <div style={sectionTitleStyle}>卡牌槽位</div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 14,
              overflowY: 'auto',
              paddingRight: 4,
              alignContent: 'start',
            }}>
              {model.slots.map((slot) => {
                const currentCandidate = slot.candidates?.find((candidate) => candidate.id === slotSelections[slot.id]) || slot.candidates?.[0] || null
                const activeTags = (slot.settlementHints || [])
                  .filter((hint) => settlementSelections[slot.id]?.includes(hint.id))
                  .map((hint) => ({
                    id: hint.id,
                    label: hint.label,
                    onRemove: () => {
                      setSettlementSelections((current) => {
                        const next = {
                          ...current,
                          [slot.id]: (current[slot.id] || []).filter((id) => id !== hint.id),
                        }
                        resetFlow(activeSlotId, slotSelections, next, globalSettlementSelections)
                        return next
                      })
                    },
                  }))
                return (
                  <SlotButton
                    key={slot.id}
                    slot={slot}
                    slotBgKey={slotBackgroundMap?.[slot.id]?.slot_bg || templateData?.nomal_slot_bg || READER_CHROME.assets.slotFrame.asset}
                    active={activeSlotId === slot.id}
                    candidate={currentCandidate}
                    tags={activeTags}
                    onClick={() => handleSelectSlot(slot.id)}
                  />
                )
              })}
            </div>

            <button type="button" style={secondaryButtonStyle} onClick={handleManualReset}>
              重置仪式
            </button>
          </div>
        )}

        <div style={candidateStageStyle}>
          <div>
            <div style={sectionTitleStyle}>卡牌候选</div>
            <div style={{ ...smallLineStyle, marginTop: 8 }}>
              当前显示的是 {selectedSlot?.title || '当前槽位'} 的候选卡牌或条件分支。
            </div>
            {selectedSlot?.text && (
              <div style={{ ...smallLineStyle, marginTop: 10 }}>
                {selectedSlot.text}
              </div>
            )}
            {selectedSlot?.conditions?.length > 0 && (
              <div style={{ ...smallLineStyle, marginTop: 8 }}>
                <span title={selectedSlot.conditions.join('，')}>
                  可放入条件：{selectedSlot.conditions.join('，')}
                </span>
              </div>
            )}
          </div>

          {selectedSlot?.candidates?.length > 0 ? (
            <div style={{
              marginTop: 16,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 14,
              overflowY: 'auto',
              paddingRight: 4,
            }}>
              {selectedSlot.candidates.map((candidate) => (
                <CandidateHandItem
                  key={candidate.id}
                  candidate={candidate}
                  active={slotSelections[selectedSlot.id] === candidate.id}
                  onSelect={() => handleChangeCandidate(candidate.id)}
                />
              ))}
            </div>
          ) : (
            <div style={emptyCandidateStyle}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f5e5c4' }}>
                当前槽位没有显式候选
              </div>
              <div style={{ ...smallLineStyle, marginTop: 10, textAlign: 'center' }}>
                这个槽位没有直接给出 `pops` 候选卡牌。
                <br />
                目前先按槽位说明与后续结算文本继续阅读。
              </div>
              {selectedSlot?.conditions?.length > 0 && (
                <div style={{ ...smallLineStyle, marginTop: 12, textAlign: 'center' }}>
                  <span title={selectedSlot.conditions.join('，')}>
                    条件：{selectedSlot.conditions.join('，')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{
          height: '100%',
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '1fr',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            minHeight: 0,
            borderRadius: 32,
            border: '1px solid rgba(212, 184, 126, 0.14)',
            boxShadow: '0 24px 58px rgba(0, 0, 0, 0.28)',
            backgroundColor: 'rgba(22, 17, 13, 0.92)',
            overflow: 'hidden',
            display: 'grid',
            gridTemplateRows: 'minmax(0, 1fr) auto',
          }}>
            <div style={{
              minHeight: 0,
              overflowY: 'auto',
              padding: '24px 24px 16px',
              display: 'grid',
              gap: 18,
            }} ref={readerBodyRef}>
              {selectedSlot?.settlementHints?.length > 0 && (
                <div style={settlementPanelStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={sectionTitleStyle}>结算条件</div>
                      <div style={{ ...smallLineStyle, marginTop: 6 }}>
                        可为 {selectedSlot.title} 勾选多个附加分支，右侧对白只会按当前勾选推进。
                      </div>
                    </div>
                    <div style={settlementCountStyle}>
                      已选 {selectedSettlementHints.length}
                    </div>
                  </div>
                  <div style={{
                    marginTop: 14,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 10,
                  }}>
                    {selectedSlot.settlementHints.map((hint) => (
                      <SettlementHintItem
                        key={hint.id}
                        hint={hint}
                        active={settlementSelections[selectedSlot.id]?.includes(hint.id)}
                        onToggle={() => handleToggleSettlementHint(hint.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {model?.globalSettlementHints?.length > 0 && (
                <div style={settlementPanelStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={sectionTitleStyle}>全局条件</div>
                      <div style={{ ...smallLineStyle, marginTop: 6 }}>
                        这些分支不绑定单一卡槽，也可以提前勾选参与推进。
                      </div>
                    </div>
                    <div style={settlementCountStyle}>
                      已选 {globalSettlementSelections.length}
                    </div>
                  </div>
                  <div style={{
                    marginTop: 14,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 10,
                  }}>
                    {model.globalSettlementHints.map((hint) => (
                      <SettlementHintItem
                        key={hint.id}
                        hint={hint}
                        active={globalSettlementSelections.includes(hint.id)}
                        onToggle={() => handleToggleGlobalSettlementHint(hint.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {model.image && (
                <PreviewImage pic={model.image} maxHeight={260} />
              )}

              {visibleLines.length > 0 && (
                <div style={{ display: 'grid', gap: 12 }}>
                  {visibleLines.map((line, index) => (
                    <div
                      key={`${line}-${index}`}
                      style={{
                        maxWidth: READER_CHROME.assets.dialogueFrame.maxWidth,
                        minHeight: READER_CHROME.assets.dialogueFrame.minHeight,
                        marginLeft: index % 2 === 0 ? 0 : 'auto',
                        padding: READER_CHROME.assets.dialogueFrame.padding,
                        borderRadius: 22,
                        background: 'linear-gradient(180deg, rgba(30, 24, 18, 0.92), rgba(18, 14, 11, 0.98))',
                        border: '1px solid rgba(212, 184, 126, 0.14)',
                        boxShadow: '0 18px 36px rgba(0, 0, 0, 0.22)',
                      }}
                    >
                      <div style={{ fontSize: 18, lineHeight: 1.95, color: '#f7edd8', whiteSpace: 'pre-wrap' }}>
                        {line}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {visibleSegments.length > 0 && (
                <div style={{ display: 'grid', gap: 14 }}>
                  {visibleSegments.map((segment, index) => (
                    <div key={`${segment.phase}-${index}`} style={segmentCardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                        <div>
                          <div style={sectionTitleStyle}>{segment.phase}</div>
                          {segment.title && (
                            <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700 }}>{segment.title}</div>
                          )}
                        </div>
                        {segment.conditions.length > 0 && (
                          <div style={{ ...smallLineStyle, maxWidth: 240, textAlign: 'right' }}>
                            {segment.conditions.join(' / ')}
                          </div>
                        )}
                      </div>

                      {segment.text && (
                        <div style={{ marginTop: 12, fontSize: 16, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                          {segment.text}
                        </div>
                      )}

                      {segment.image && (
                        <div style={{ marginTop: 14 }}>
                          <PreviewImage pic={segment.image} maxHeight={260} />
                        </div>
                      )}

                      {segment.options.length > 0 && (
                        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          {segment.options.map((option) => (
                            <button key={option.id} type="button" style={choiceButtonStyle}>
                              {option.text}
                            </button>
                          ))}
                        </div>
                      )}

                      {segment.choiceActions?.filter((action) => action.branch === 'direct').length > 0 && (
                        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          {segment.choiceActions.filter((action) => action.branch === 'direct').map((action, actionIndex) => (
                            <button
                              key={`${action.key}-${action.value}-${actionIndex}`}
                              type="button"
                              style={actionButtonStyle}
                              onClick={() => handleOpenAction(action, actionIndex)}
                            >
                              打开{action.targetType === 'rite' ? '仪式' : action.targetType === 'event' ? '事件' : '结局'} {action.targetId}
                            </button>
                          ))}
                        </div>
                      )}

                      {(branchActions(segment, 'success').length > 0 || branchActions(segment, 'failed').length > 0) && (
                        <div style={{ marginTop: 14, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {branchActions(segment, 'success').length > 0 && (
                            <button
                              type="button"
                              style={branchSuccessButtonStyle}
                              onClick={() => branchActions(segment, 'success').forEach((action, actionIndex) => handleOpenAction(action, actionIndex))}
                            >
                              选择成功
                            </button>
                          )}
                          {branchActions(segment, 'failed').length > 0 && (
                            <button
                              type="button"
                              style={branchFailedButtonStyle}
                              onClick={() => branchActions(segment, 'failed').forEach((action, actionIndex) => handleOpenAction(action, actionIndex))}
                            >
                              选择失败
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{
              padding: '16px 24px 24px',
              borderTop: '1px solid rgba(212, 184, 126, 0.08)',
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}>
              {canRevealLine && (
                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={advanceFlow}
                >
                  下一句
                </button>
              )}
              {canRevealSegment && (
                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={advanceFlow}
                >
                  推进后续
                </button>
              )}
              <button
                type="button"
                style={autoAdvance ? activeToggleButtonStyle : secondaryButtonStyle}
                onClick={() => setAutoAdvance((value) => !value)}
              >
                {autoAdvance ? '停止自动' : '自动下一句'}
              </button>
              {!canRevealLine && !canRevealSegment && availableSegments.length > 0 && (
                <span style={smallLineStyle}>当前已推进到可选分支或末尾。</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (!isFullscreenReader) return content

  return (
    <div style={overlayShellStyle}>
      <div style={overlayCardStyle}>
        <div style={overlayHeaderStyle}>
          <div style={overlayHeaderLeftStyle}>
            {headerBlock}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {data?._source_path && (
              <button type="button" onClick={handleViewRaw} style={secondaryButtonStyle}>查看原始文件</button>
            )}
            <button type="button" onClick={onClose} style={closeButtonStyle}>关闭</button>
          </div>
        </div>
        <div style={{ height: '100%', minHeight: 0, overflow: 'hidden', padding: 24 }}>
          {content}
        </div>
      </div>
      {rawContent !== null && (
        <RawFileView content={rawContent} onClose={() => setRawContent(null)} />
      )}
    </div>
  )
}

const imageFallbackStyle = {
  color: 'rgba(241, 232, 213, 0.58)',
  fontSize: 14,
}

const storyHeaderShellStyle = {
  display: 'flex',
  justifyContent: 'flex-start',
  minWidth: 0,
}

const storyHeaderCardStyle = {
  width: '100%',
  padding: '12px 16px 10px',
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 22,
  background: 'linear-gradient(180deg, rgba(250, 244, 231, 0.98), rgba(227, 212, 186, 0.95))',
  color: READER_CHROME.header.metaColor,
  border: '1px solid rgba(212, 184, 126, 0.14)',
  boxShadow: '0 10px 26px rgba(0, 0, 0, 0.18)',
}

const storyMetaWrapStyle = {
  position: 'absolute',
  top: 10,
  right: 14,
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: 8,
  maxWidth: '52%',
}

const storyHeaderTitleRowStyle = {
  marginTop: 6,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
}

const storyHeaderTitleStyle = {
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1.18,
  color: '#3f2a16',
  letterSpacing: '0.01em',
}

const sectionTitleStyle = {
  fontSize: 12,
  letterSpacing: '0.24em',
  textTransform: 'uppercase',
  color: '#d4b87e',
}

const smallLineStyle = {
  fontSize: 13,
  lineHeight: 1.7,
  color: '#cbb391',
}

const slotTagStyle = {
  padding: '2px 7px',
  borderRadius: 999,
  backgroundColor: 'rgba(212, 184, 126, 0.12)',
  border: '1px solid rgba(212, 184, 126, 0.14)',
  color: '#dcc9a6',
  fontSize: 10,
  lineHeight: 1.3,
}

const slotTagButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '2px 7px',
  borderRadius: 999,
  backgroundColor: 'rgba(212, 184, 126, 0.12)',
  border: '1px solid rgba(212, 184, 126, 0.14)',
  color: '#dcc9a6',
  fontSize: 10,
  lineHeight: 1.3,
  cursor: 'pointer',
}

const metaChipCompactStyle = {
  padding: '4px 10px',
  borderRadius: 999,
  border: '1px solid rgba(92, 62, 31, 0.12)',
  backgroundColor: 'rgba(126, 93, 53, 0.12)',
  color: '#6a4623',
  fontSize: 11,
  lineHeight: 1.4,
}

const segmentCardStyle = {
  padding: '18px 18px 16px',
  borderRadius: 24,
  border: '1px solid rgba(212, 184, 126, 0.12)',
  backgroundImage: 'linear-gradient(180deg, rgba(31, 24, 18, 0.96), rgba(20, 16, 12, 0.96))',
}

const settlementPanelStyle = {
  padding: '16px 16px 14px',
  borderRadius: 22,
  border: '1px solid rgba(212, 184, 126, 0.12)',
  background: 'linear-gradient(180deg, rgba(28, 22, 16, 0.94), rgba(19, 15, 11, 0.98))',
}

const settlementCountStyle = {
  padding: '5px 10px',
  borderRadius: 999,
  border: '1px solid rgba(143, 191, 119, 0.18)',
  background: 'rgba(143, 191, 119, 0.08)',
  color: '#d8e8ca',
  fontSize: 12,
}

const candidateStageStyle = {
  height: '100%',
  borderRadius: 32,
  border: '1px solid rgba(212, 184, 126, 0.14)',
  backgroundColor: 'rgba(16, 14, 11, 0.95)',
  boxShadow: '0 18px 42px rgba(0, 0, 0, 0.26)',
  padding: '20px 18px 18px',
  minHeight: 0,
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  overflow: 'hidden',
}

const emptyCandidateStyle = {
  marginTop: 16,
  borderRadius: 24,
  border: '1px dashed rgba(212, 184, 126, 0.18)',
  backgroundColor: 'rgba(22, 18, 14, 0.92)',
  padding: '22px 18px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
}

const primaryButtonStyle = {
  padding: '12px 18px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.24)',
  backgroundColor: 'rgba(212, 184, 126, 0.14)',
  color: '#fff1d4',
  cursor: 'pointer',
  fontSize: 14,
}

const secondaryButtonStyle = {
  padding: '10px 16px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.18)',
  backgroundColor: 'rgba(212, 184, 126, 0.08)',
  color: '#f3ead8',
  cursor: 'pointer',
}

const activeToggleButtonStyle = {
  ...secondaryButtonStyle,
  border: '1px solid rgba(143, 191, 119, 0.28)',
  backgroundColor: 'rgba(143, 191, 119, 0.14)',
  color: '#e4f1d7',
}

const choiceButtonStyle = {
  padding: '9px 14px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.24)',
  backgroundColor: 'rgba(212, 184, 126, 0.08)',
  color: '#f2ead5',
  cursor: 'pointer',
}

const actionButtonStyle = {
  padding: '10px 14px',
  borderRadius: 999,
  border: '1px solid rgba(143, 191, 119, 0.24)',
  backgroundColor: 'rgba(143, 191, 119, 0.08)',
  color: '#e5f1d9',
  cursor: 'pointer',
}

const branchSuccessButtonStyle = {
  padding: '10px 14px',
  borderRadius: 999,
  border: '1px solid rgba(143, 191, 119, 0.24)',
  backgroundColor: 'rgba(143, 191, 119, 0.12)',
  color: '#e5f1d9',
  cursor: 'pointer',
}

const branchFailedButtonStyle = {
  padding: '10px 14px',
  borderRadius: 999,
  border: '1px solid rgba(195, 91, 91, 0.24)',
  backgroundColor: 'rgba(195, 91, 91, 0.12)',
  color: '#f6d1d1',
  cursor: 'pointer',
}

const overlayShellStyle = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(5, 4, 3, 0.8)',
  zIndex: 90,
  backdropFilter: `blur(${READER_CHROME.eventOverlay.backdropBlur})`,
}

const overlayCardStyle = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  backgroundImage: READER_CHROME.eventOverlay.background,
}

const overlayHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '16px 24px 12px',
  borderBottom: '1px solid rgba(212, 184, 126, 0.12)',
}

const overlayHeaderLeftStyle = {
  flex: 1,
  minWidth: 0,
}

const closeButtonStyle = {
  padding: '10px 16px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.24)',
  backgroundColor: 'rgba(212, 184, 126, 0.08)',
  color: '#f2ead5',
  cursor: 'pointer',
}

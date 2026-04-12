import { useEffect, useMemo, useRef, useState } from 'react'
import useConfigStore from '../../stores/useConfigStore'
import { useResolvedImage } from '../../services/imageResolver'
import { adaptStoryData } from '../../services/storyAdapter'
import { READER_CHROME } from '../../readerChromeConfig'
import { CARD_RENDER_CONFIG, getCardFrameHeight, getCardRarityFrameAsset, READER_RESOURCE_ASSETS, RITE_TEMPLATE_DEFAULTS } from '../../resourceConfig'
import { linkNodesOnCanvas, mountNodeOnCanvas } from '../../services/graphNavigation'
import RawFileView from '../RawFileView'
import ExecutionModal from './storyInspector/ExecutionModal'
import { buildExecutionFlow, resolveExecutionTargetImage, resolveSelectedSlotCard } from './storyInspector/executionUtils'
import * as storyInspectorStyles from './storyInspector/storyInspectorStyles'

const FULLSCREEN_TYPES = new Set(['rite', 'event', 'dt', 'over', 'after_story'])
const AUTO_FOLLOWUP_TARGET_TYPES = new Set(['event', 'rite', 'loot', 'over'])

function shallowEqualObject(left, right) {
  const leftKeys = Object.keys(left || {})
  const rightKeys = Object.keys(right || {})
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every((key) => {
    const leftValue = left[key]
    const rightValue = right[key]
    if (leftValue && typeof leftValue === 'object' && rightValue && typeof rightValue === 'object') {
      return JSON.stringify(leftValue) === JSON.stringify(rightValue)
    }
    return leftValue === rightValue
  })
}

const {
  imageFallbackStyle,
  eventFallbackBoardStyle,
  eventReaderShellStyle,
  eventBackdropShellStyle,
  eventBackdropEdgeStyle,
  eventBackdropHalfStyle,
  eventBackdropCenterStyle,
  eventReaderGridStyle,
  eventBoardStageStyle,
  eventBoardContentStyle,
  eventReaderVisualStageStyle,
  eventVisualSpacerStyle,
  eventPortraitDockStyle,
  eventFigureWrapStyle,
  eventFigureImageStyle,
  eventFigureFallbackStyle,
  eventParagraphStyle,
  eventChoicesWrapStyle,
  eventChoiceButtonStyle,
  eventChoiceButtonActiveStyle,
  eventActionRowStyle,
  eventResultBlockStyle,
  eventTriggerShellStyle,
  eventTriggerDetailStyle,
  eventTriggerMetaStyle,
  storyHeaderShellStyle,
  storyHeaderCardStyle,
  storyMetaWrapStyle,
  storyHeaderTitleRowStyle,
  storyHeaderActionsStyle,
  conditionSummaryTextStyle,
  storyHeaderTitleStyle,
  sectionTitleStyle,
  smallLineStyle,
  slotTagStyle,
  slotTagButtonStyle,
  metaChipCompactStyle,
  effectChipStyle,
  effectCardLinkStyle,
  segmentCardStyle,
  readerFilterInputStyle,
  candidateStageStyle,
  emptyCandidateStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  activeToggleButtonStyle,
  choiceButtonStyle,
  actionButtonStyle,
  ritePreparationPanelStyle,
  riteSlotScrollerStyle,
  riteCandidateGridStyle,
  ritePreparationInfoPanelStyle,
  ritePreparationFooterStyle,
  translucentTextBlockStyle,
  candidateToolbarStyle,
  candidateToolbarGroupStyle,
  candidateSearchInputStyle,
  riteHiddenBackdropStyle,
  branchSuccessButtonStyle,
  branchFailedButtonStyle,
  overlayShellStyle,
  overlayCardStyle,
  overlayHeaderStyle,
  overlayHeaderLeftStyle,
  closeButtonStyle,
  selectionOverlayStyle,
  selectionDialogStyle,
  selectionDialogHeaderStyle,
  selectionDialogSearchWrapStyle,
  selectionDialogBodyStyle,
  selectionDialogEmptyStyle,
  selectionDialogItemStyle,
  selectionDialogItemActiveStyle,
  selectionDialogItemTitleStyle,
  selectionDialogItemMetaStyle,
} = storyInspectorStyles


function normalizeTextContent(text) {
  if (text == null) return ''
  if (typeof text === 'string') return text
  if (Array.isArray(text)) {
    return text
      .map((item) => normalizeTextContent(item))
      .filter(Boolean)
      .join('\n\n')
  }
  if (typeof text === 'object') {
    if (typeof text.text === 'string') return text.text
    if (typeof text.result_text === 'string') return text.result_text
    if (typeof text.tips_text === 'string') return text.tips_text
    if (typeof text.word === 'string') return text.word
    return ''
  }
  return String(text)
}

function splitIntro(text) {
  const normalized = normalizeTextContent(text)
  if (!normalized) return []

  return [normalized.trim()].filter(Boolean)
}

function truncateDisplayText(text, maxLength = 120) {
  const content = normalizeTextContent(text)
  if (!content) return ''
  if (content.length <= maxLength) return content
  return `${content.slice(0, maxLength)}...`
}

const CONDITION_BUTTON_MAX_LENGTH = 26
const CONDITION_PREVIEW_MAX_LENGTH = 72

function CardPortrait({ card, compact = false, showName = true, widthOverride = null }) {
  const { url } = useResolvedImage(card?.image)
  const { url: rareFrameUrl } = useResolvedImage(getCardRarityFrameAsset(card?.rare))
  const width = widthOverride || (compact ? 54 : 66)
  const height = getCardFrameHeight(width)
  const artInset = compact
    ? '1px 2px 9px'
    : width > 66
      ? '5px 6px 24px'
      : '4px 5px 20px'

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
            style={{
              width: '100%',
              height: '100%',
              objectFit: CARD_RENDER_CONFIG.imageObjectFit,
              objectPosition: CARD_RENDER_CONFIG.imageObjectPosition,
              display: 'block',
            }}
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
            fontSize: compact ? 11 : width > 66 ? 13 : 12,
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
          fontSize: compact ? 10 : width > 66 ? 13 : 11,
          lineHeight: 1.4,
          zIndex: 2,
          fontWeight: 700,
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
    <div style={{ position: 'relative', width: 66 + Math.max(0, cards.length - 1) * 14, height: getCardFrameHeight(66) }}>
      {cards.slice(0, 4).map((card, index) => (
        <div
          key={`${card.id}-${index}`}
          style={{
            position: 'absolute',
            left: index * 14,
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

function TemplateBackgroundLayer({ pic, titleX }) {
  const [naturalWidth, setNaturalWidth] = useState(null)
  const cropWidth = Number(titleX) > 0 ? Number(titleX) * 0.75 : null
  const widthPercent = naturalWidth && cropWidth
    ? `${(naturalWidth / cropWidth) * 100}%`
    : '100%'

  if (!pic) return null

  return (
    <img
      src={pic}
      alt=""
      onLoad={(event) => setNaturalWidth(event.currentTarget.naturalWidth || null)}
      style={{
        position: 'absolute',
        inset: 0,
        width: widthPercent,
        height: '100%',
        objectFit: 'fill',
        objectPosition: 'left top',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    />
  )
}

function EventBackdrop({ children }) {
  const { url } = useResolvedImage(READER_RESOURCE_ASSETS.noteBackground)

  return (
    <div style={eventBackdropShellStyle}>
      <div style={eventBackdropEdgeStyle}>
        <div style={{
          ...eventBackdropHalfStyle,
          backgroundImage: url ? `url("${url}")` : eventFallbackBoardStyle.backgroundImage,
        }} />
        <div style={{
          ...eventBackdropHalfStyle,
          backgroundImage: url ? `url("${url}")` : eventFallbackBoardStyle.backgroundImage,
          transform: 'scaleX(-1)',
        }} />
      </div>
      <div style={eventBackdropCenterStyle}>
        {children}
      </div>
    </div>
  )
}

function EventChoiceCard({ option, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        ...eventChoiceButtonStyle,
        ...(active ? eventChoiceButtonActiveStyle : null),
      }}
    >
      {option.text}
    </button>
  )
}

function EventSideFigure({ card }) {
  const { url, loading } = useResolvedImage(card?.image)

  if (!card) return null

  return (
    <div style={eventFigureWrapStyle}>
      {loading && <div style={eventFigureFallbackStyle}>载入中…</div>}
      {!loading && url && (
        <img
          src={url}
          alt={card.name || ''}
          style={eventFigureImageStyle}
        />
      )}
      {!loading && !url && (
        <div style={eventFigureFallbackStyle}>
          {card.name || '角色'}
        </div>
      )}
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

function EffectSummary({ effects, compact = false, onOpenCard = null }) {
  if (!effects?.length) return null

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: compact ? 6 : 10,
    }}>
      {effects.map((effect, index) => (
        <div
          key={`${effect.type}-${effect.label}-${index}`}
          title={effect.cards?.length > 0 ? `${effect.label}：${effect.cards.map((card) => card.name).join(' / ')}` : effect.label}
          style={effectChipStyle}
        >
          <span>{effect.label}</span>
          {effect.cards?.length > 0 && (
            <span style={{ opacity: 0.92, display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
              <span>：</span>
              {effect.cards.map((card) => (
                <button
                  key={`${effect.type}:${index}:${card.id}`}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpenCard?.(card)
                  }}
                  style={effectCardLinkStyle}
                >
                  {card.name}
                </button>
              ))}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function ActionSummary({ actions, onOpenAction }) {
  if (!actions?.length) return null

  return (
    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {actions.map((action, index) => (
        <button
          key={`${action.key}:${action.targetType || ''}:${action.targetId || ''}:${index}`}
          type="button"
          style={actionButtonStyle}
          onClick={() => onOpenAction?.(action, index)}
        >
          {action.targetType && action.targetId
            ? `动作：${action.key} -> ${action.targetType} ${action.targetId}`
            : `动作：${action.text || action.key}`}
        </button>
      ))}
    </div>
  )
}

function StoryPopLine({ pop, card }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '48px minmax(0,1fr)', gap: 12, alignItems: 'start' }}>
      <div style={{ paddingTop: 2 }}>
        <CardPortrait card={card} compact showName={false} widthOverride={48} />
      </div>
      <div style={{ color: '#f5ecd9', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
        {pop.text}
      </div>
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
          border: active ? '1px solid rgba(239, 215, 169, 0.62)' : '1px solid rgba(244, 232, 206, 0.22)',
          backgroundColor: 'transparent',
          boxShadow: active ? '0 0 0 2px rgba(212, 184, 126, 0.14)' : 'none',
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
            ? `url("${slotBgUrl}")`
            : 'linear-gradient(180deg, rgba(180, 165, 139, 0.22), rgba(94, 80, 57, 0.18))',
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
            <div style={{ position: 'absolute', inset: '8px 2px 2px 10px' }}>
              <CardPortrait card={previewCard} compact showName={false} />
            </div>
          ) : (
            <div style={{
              position: 'absolute',
              inset: '10px 10px 12px',
              borderRadius: 18,
              background: 'rgba(10, 9, 7, 0.1)',
              border: '1px solid rgba(244, 232, 206, 0.1)',
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
  const cardWidth = 92
  const cardHeight = getCardFrameHeight(cardWidth)

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: cardWidth,
        minWidth: cardWidth,
        height: cardHeight,
        padding: 0,
        borderRadius: 18,
        border: 'none',
        backgroundColor: 'transparent',
        color: '#f3ebda',
        boxShadow: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        boxSizing: 'border-box',
      }}
    >
      {previewCard ? (
        <div style={{
          borderRadius: 18,
          boxShadow: active ? '0 0 0 2px rgba(239, 215, 169, 0.44), 0 12px 22px rgba(0,0,0,0.2)' : 'none',
        }}>
          <CardPortrait card={previewCard} showName widthOverride={cardWidth} />
        </div>
      ) : (
        <div style={{
          width: cardWidth,
          height: cardHeight,
          borderRadius: 18,
          overflow: 'hidden',
          position: 'relative',
          background: active
            ? 'linear-gradient(180deg, rgba(69, 55, 35, 0.98), rgba(24, 18, 13, 0.98))'
            : 'linear-gradient(180deg, rgba(41, 33, 24, 0.96), rgba(24, 18, 13, 0.96))',
          border: active ? '1px solid rgba(239, 215, 169, 0.52)' : '1px solid rgba(244, 232, 206, 0.18)',
          boxShadow: active ? '0 12px 22px rgba(0,0,0,0.2)' : 'none',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(8, 7, 6, 0.08), rgba(8, 7, 6, 0.74))',
          }} />
          <div style={{
            position: 'absolute',
            inset: '12px 10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: '#fff2d7',
            fontSize: 17,
            fontWeight: 800,
            lineHeight: 1.35,
          }}>
            <span
              title={candidate.label}
              style={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 4,
                overflow: 'hidden',
              }}
            >
              {candidate.label}
            </span>
          </div>
        </div>
      )}
    </button>
  )
}

/**
 * 默认选中规则：选最后一个无条件（conditionText 为空）的项，否则不选（返回 null）
 * 这样避免强制选中有条件限制的结算分支
 */
function pickDefaultHintId(hints = []) {
  if (!Array.isArray(hints) || hints.length === 0) return null
  // 从后往前找第一个无条件的项
  for (let i = hints.length - 1; i >= 0; i--) {
    if (!hints[i].conditionText) return hints[i].id
  }
  return null
}

function buildDefaultSettlementSelections(slots = []) {
  return Object.fromEntries(
    slots.map((slot) => [slot.id, pickDefaultHintId(slot.settlementHints)])
  )
}

function buildTemplateSlotLayout(slots = {}, activeSlotIds = []) {
  const entries = activeSlotIds
    .map((slotId) => ({ slotId, config: slots?.[slotId] || null }))
    .filter((entry) => entry.config?.pos)

  if (entries.length === 0) return {}

  const xs = entries.map((entry) => Number(entry.config.pos.x) || 0)
  const ys = entries.map((entry) => Math.abs(Number(entry.config.pos.y) || 0))
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const rangeX = Math.max(1, maxX - minX)
  const rangeY = Math.max(1, maxY - minY)

  return Object.fromEntries(entries.map(({ slotId, config }) => {
    const x = Number(config.pos.x) || 0
    const y = Math.abs(Number(config.pos.y) || 0)
    const left = 8 + ((x - minX) / rangeX) * 58
    const top = 10 + ((y - minY) / rangeY) * 54
    const scale = Math.max(0.72, Math.min(1.12, Number(config.scale?.x) || 1))

    return [slotId, {
      left: `${left}%`,
      top: `${top}%`,
      transform: `translate(-50%, -50%) scale(${scale}) rotate(${Number(config.rotation_z) || 0}deg)`,
      zIndex: 2,
    }]
  }))
}

function matchesSlotOccupancyCondition(conditionRaw = {}, slotState = {}) {
  if (!conditionRaw || typeof conditionRaw !== 'object') return true

  return Object.entries(conditionRaw).every(([key, value]) => {
    if (!/^!?s\d+$/.test(key) || Number(value) <= 0) return true
    const slotId = key.startsWith('!') ? key.slice(1) : key
    const isEmpty = slotState[slotId]?.isEmpty ?? false
    return key.startsWith('!') ? isEmpty : !isEmpty
  })
}

export default function StoryInspector({ type, data, onClose }) {
  const RITE_CANDIDATE_PAGE_SIZE = 7
  const cardsLite = useConfigStore((s) => s.cardsLite)
  const cardsById = useConfigStore((s) => s.cardsById)
  const model = adaptStoryData(type, data, cardsLite, cardsById)
  const [templateData, setTemplateData] = useState(null)
  const [rawContent, setRawContent] = useState(null)
  const { url: headerIconUrl } = useResolvedImage(model?.headerIcon)

  const [activeSlotId, setActiveSlotId] = useState(null)
  const [slotSelections, setSlotSelections] = useState({})
  const [settlementSelections, setSettlementSelections] = useState({})
  const [globalSettlementSelection, setGlobalSettlementSelection] = useState(null)
  const [revealedLineCount, setRevealedLineCount] = useState(1)
  const [revealedSegmentCount, setRevealedSegmentCount] = useState(0)
  const [autoAdvance, setAutoAdvance] = useState(false)
  const [candidatePage, setCandidatePage] = useState(1)
  const [selectedConditionId, setSelectedConditionId] = useState(null)
  const [conditionSelectorOpen, setConditionSelectorOpen] = useState(false)
  const [candidateConditionFilterText, setCandidateConditionFilterText] = useState('')
  const [candidateCardFilterText, setCandidateCardFilterText] = useState('')
  const [slotConditionSelections, setSlotConditionSelections] = useState({})
  const [conditionPreviewExpanded, setConditionPreviewExpanded] = useState(false)
  const [executionOpen, setExecutionOpen] = useState(false)
  const [executionMode, setExecutionMode] = useState('normal')
  const [executionConditionSelections, setExecutionConditionSelections] = useState({})
  const [hideReaderUi, setHideReaderUi] = useState(false)
  const [executionStepIndex, setExecutionStepIndex] = useState(0)
  const [eventChoicePath, setEventChoicePath] = useState([])
  const readerBodyRef = useRef(null)
  const autoMountedEventIdRef = useRef(null)
  const executedActionKeyRef = useRef(new Set())
  const { url: templateBgUrl } = useResolvedImage(templateData?.bg || READER_RESOURCE_ASSETS.defaultRiteBackground)
  const { url: settlementBgUrl } = useResolvedImage(READER_RESOURCE_ASSETS.settlementBackground)
  const { url: settlementDiceBgUrl } = useResolvedImage(READER_RESOURCE_ASSETS.settlementDiceBackground)
  const [executionTargetNameMap, setExecutionTargetNameMap] = useState({})

  function buildDialogueLines(slotId, selections, settlementState, globalSelection = globalSettlementSelection) {
    const slot = model?.slots?.find((entry) => entry.id === slotId) || null
    void slot
    void selections
    void settlementState
    void globalSelection

    return splitIntro(model?.intro)
  }

  useEffect(() => {
    if (!model) return

    const defaults = Object.fromEntries(
      (model.slots || []).map((slot) => [slot.id, slot.candidates?.[0]?.id || null])
    )
    const hintDefaults = buildDefaultSettlementSelections(model.slots || [])
    const firstSlotId = model.slots?.[0]?.id || null
    const initialLines = splitIntro(model.intro)

    setSlotSelections(defaults)
    setSettlementSelections(hintDefaults)
    setGlobalSettlementSelection(pickDefaultHintId(model.globalSettlementHints || []))
    setActiveSlotId(firstSlotId)
    setCandidatePage(1)
    setSelectedConditionId(null)
    setSlotConditionSelections({})
    setConditionSelectorOpen(false)
    setCandidateConditionFilterText('')
    setCandidateCardFilterText('')
    setConditionPreviewExpanded(false)
    setRevealedLineCount(type === 'rite' ? initialLines.length : (initialLines.length > 0 ? 1 : 0))
    setRevealedSegmentCount(type === 'rite' ? 9999 : 0)
    setExecutionOpen(false)
    setExecutionMode('normal')
    setExecutionConditionSelections({})
    setHideReaderUi(false)
    setExecutionStepIndex(0)
    setEventChoicePath([])
    autoMountedEventIdRef.current = null
  }, [type, data?.id, data?._source_path])

  useEffect(() => {
    let cancelled = false

    if (type !== 'rite') {
      setTemplateData(null)
      return () => { cancelled = true }
    }

    // 正确的 mapping 流程：
    // 1. 用仪式的 mapping_id 查 rite_template_mappings，得到 template_id
    // 2. 再用 template_id 读对应的 rite_template 文件
    async function loadTemplate() {
      const mappingId = model?.mappingId
      let templateId = RITE_TEMPLATE_DEFAULTS.id

      if (mappingId) {
        try {
          const mappings = await window.electronAPI.configReadCache('rite_template_mappings', 'rite_template_mappings')
          const entry = mappings?.[String(mappingId)]
          if (entry?.template_id) {
            templateId = String(entry.template_id)
          }
        } catch {
          // 读取失败时回退到默认
        }
      }

      let result = await window.electronAPI.configReadCache('rite_template', templateId).catch(() => null)
      if (!result) {
        result = await window.electronAPI.configReadCache('rite_template', RITE_TEMPLATE_DEFAULTS.id).catch(() => null)
      }
      if (!cancelled) {
        setTemplateData(result || { bg: RITE_TEMPLATE_DEFAULTS.background, slots: {} })
      }
    }

    loadTemplate()

    return () => { cancelled = true }
  }, [type, model?.mappingId])

  const selectedSlot = useMemo(
    () => model?.slots?.find((slot) => slot.id === activeSlotId) || null,
    [model?.slots, activeSlotId]
  )

  const selectedSlotCandidates = useMemo(() => {
    if (!selectedSlot) return []
    return selectedSlot.candidates || []
  }, [selectedSlot])

  const selectedSlotConditionGroups = useMemo(() => {
    if (!selectedSlotCandidates.length) return []

    const groups = []
    const groupMap = new Map()

    selectedSlotCandidates.forEach((candidate, index) => {
      const rawLabel = candidate.conditionText || candidate.label || `条件 ${index + 1}`
      if (!groupMap.has(rawLabel)) {
        const group = {
          id: `${selectedSlot?.id || 'slot'}:condition:${groups.length}`,
          label: rawLabel,
          candidates: [],
        }
        groupMap.set(rawLabel, group)
        groups.push(group)
      }
      groupMap.get(rawLabel).candidates.push(candidate)
    })

    return groups
  }, [selectedSlot?.id, selectedSlotCandidates])

  const visibleConditionGroups = useMemo(() => {
    const keyword = candidateConditionFilterText.trim().toLowerCase()
    if (!keyword) return selectedSlotConditionGroups
    return selectedSlotConditionGroups.filter((group) => (
      (group.label || '').toLowerCase().includes(keyword)
    ))
  }, [candidateConditionFilterText, selectedSlotConditionGroups])

  const activeConditionGroup = useMemo(() => {
    if (visibleConditionGroups.length === 0) return null
    return visibleConditionGroups.find((group) => group.id === selectedConditionId) || visibleConditionGroups[0]
  }, [selectedConditionId, visibleConditionGroups])

  const activeConditionCandidates = useMemo(() => {
    if (visibleConditionGroups.length === 0) return []
    return activeConditionGroup?.candidates || selectedSlotCandidates
  }, [activeConditionGroup?.candidates, selectedSlotCandidates, visibleConditionGroups.length])

  const visibleCandidateCards = useMemo(() => {
    const keyword = candidateCardFilterText.trim().toLowerCase()
    if (!keyword) return activeConditionCandidates
    return activeConditionCandidates.filter((candidate) => {
      const cardNames = (candidate.cards || []).map((card) => `${card.name || ''} ${card.title || ''}`).join(' ')
      const candidateText = `${candidate.label || ''} ${cardNames}`.toLowerCase()
      return candidateText.includes(keyword)
    })
  }, [activeConditionCandidates, candidateCardFilterText])

  const selectedSlotPageCount = useMemo(() => (
    Math.max(1, Math.ceil(visibleCandidateCards.length / RITE_CANDIDATE_PAGE_SIZE))
  ), [RITE_CANDIDATE_PAGE_SIZE, visibleCandidateCards.length])

  const pagedSelectedSlotCandidates = useMemo(() => {
    const start = (candidatePage - 1) * RITE_CANDIDATE_PAGE_SIZE
    return visibleCandidateCards.slice(start, start + RITE_CANDIDATE_PAGE_SIZE)
  }, [RITE_CANDIDATE_PAGE_SIZE, visibleCandidateCards, candidatePage])

  const selectedCandidate = useMemo(() => {
    if (!selectedSlot) return null
    return selectedSlot.candidates?.find((candidate) => candidate.id === slotSelections[selectedSlot.id]) || selectedSlot.candidates?.[0] || null
  }, [selectedSlot, slotSelections])

  const selectedCandidatePopItems = useMemo(() => {
    if (!selectedCandidate) return []
    if (selectedCandidate.popItems?.length > 0) return selectedCandidate.popItems
    if (selectedCandidate.choiceTexts?.length > 0) {
      return selectedCandidate.choiceTexts.map((item) => ({
        key: item.id,
        slotId: selectedSlot?.id || null,
        speakerKey: selectedSlot?.id || 'self',
        text: item.text,
      }))
    }
    return []
  }, [selectedCandidate, selectedSlot?.id])

  useEffect(() => {
    setCandidatePage(1)
    setConditionSelectorOpen(false)
    setCandidateConditionFilterText('')
    setCandidateCardFilterText('')
    setConditionPreviewExpanded(false)
  }, [activeSlotId])

  useEffect(() => {
    if (visibleConditionGroups.length === 0) {
      setSelectedConditionId(null)
      return
    }

    if (!selectedConditionId || !visibleConditionGroups.some((group) => group.id === selectedConditionId)) {
      const rememberedGroupId = activeSlotId ? slotConditionSelections[activeSlotId] : null
      const nextGroup = visibleConditionGroups.find((group) => group.id === rememberedGroupId) || visibleConditionGroups[0]
      setSelectedConditionId(nextGroup.id)
    }
  }, [activeSlotId, selectedConditionId, slotConditionSelections, visibleConditionGroups])

  useEffect(() => {
    if (!activeSlotId || !activeConditionGroup?.id) return
    setSlotConditionSelections((current) => {
      if (current[activeSlotId] === activeConditionGroup.id) return current
      return {
        ...current,
        [activeSlotId]: activeConditionGroup.id,
      }
    })
  }, [activeConditionGroup?.id, activeSlotId])

  useEffect(() => {
    if (!selectedSlot || !activeConditionGroup) return
    const currentCandidateId = slotSelections[selectedSlot.id]
    const groupHasSelected = activeConditionGroup.candidates.some((candidate) => candidate.id === currentCandidateId)
    if (!groupHasSelected) {
      const fallbackCandidate = activeConditionGroup.candidates[0] || null
      if (fallbackCandidate) {
        setSlotSelections((current) => ({
          ...current,
          [selectedSlot.id]: fallbackCandidate.id,
        }))
      }
    }
  }, [activeConditionGroup, selectedSlot, slotSelections])

  useEffect(() => {
    if (candidatePage > selectedSlotPageCount) {
      setCandidatePage(selectedSlotPageCount)
    }
  }, [candidatePage, selectedSlotPageCount])

  const slotSelectionState = useMemo(() => {
    return Object.fromEntries((model?.slots || []).map((slot) => {
      const candidate = slot.candidates?.find((entry) => entry.id === slotSelections[slot.id]) || slot.candidates?.[0] || null
      return [slot.id, {
        candidate,
        isEmpty: Boolean(candidate?.isEmpty),
      }]
    }))
  }, [model?.slots, slotSelections])

  const visibleSettlementHintsBySlot = useMemo(() => {
    return Object.fromEntries((model?.slots || []).map((slot) => [
      slot.id,
      (slot.settlementHints || []).filter((hint) => matchesSlotOccupancyCondition(hint.conditionRaw, slotSelectionState)),
    ]))
  }, [model?.slots, slotSelectionState])

  const visibleGlobalSettlementHints = useMemo(() => (
    (model?.globalSettlementHints || []).filter((hint) => matchesSlotOccupancyCondition(hint.conditionRaw, slotSelectionState))
  ), [model?.globalSettlementHints, slotSelectionState])

  // 结算条件/全局条件选中后，用其卡牌覆盖对应卡槽显示
  // 优先级：结算条件卡牌 > 候选卡牌 > 默认卡牌
  const slotOverrideCards = useMemo(() => {
    const overrides = {}
    for (const slot of (model?.slots || [])) {
      const hintId = settlementSelections[slot.id]
      if (!hintId) continue
      const hint = (slot.settlementHints || []).find((h) => h.id === hintId)
      if (hint?.cards?.length > 0) {
        overrides[slot.id] = hint.cards[0]
      }
    }
    // 全局条件也可能带卡牌，但无法对应到具体槽位，暂不处理
    return overrides
  }, [model?.slots, settlementSelections])

  useEffect(() => {
    if (!model?.slots?.length) return

    setSettlementSelections((current) => {
      let changed = false
      const next = { ...current }

      for (const slot of model.slots) {
        const visibleHints = visibleSettlementHintsBySlot[slot.id] || []
        const currentId = next[slot.id] || null
        // 当前选中项不在可见列表时，置为 null（不强制 fallback）
        const valid = currentId === null || visibleHints.some((hint) => hint.id === currentId)
        if (!valid) {
          next[slot.id] = null
          changed = true
        }
      }

      return changed ? next : current
    })
  }, [model?.slots, visibleSettlementHintsBySlot])

  useEffect(() => {
    // 当前选中项不在可见列表时，置为 null（不强制 fallback）
    if (globalSettlementSelection === null) return
    const valid = visibleGlobalSettlementHints.some((hint) => hint.id === globalSettlementSelection)
    if (!valid) {
      setGlobalSettlementSelection(null)
    }
  }, [globalSettlementSelection, visibleGlobalSettlementHints])

  const dialogueLines = useMemo(() => {
    return splitIntro(model?.intro).filter(Boolean)
  }, [model?.intro])

  const eventNodeHistory = useMemo(() => {
    if (type !== 'event' || !model?.eventFlow) return []

    const history = []
    let currentNode = model.eventFlow
    history.push(currentNode)

    for (const choiceTag of eventChoicePath) {
      const nextChoice = currentNode?.choices?.find((choice) => choice.tag === choiceTag)
      if (!nextChoice?.branch) break
      currentNode = nextChoice.branch
      history.push(currentNode)
    }

    return history
  }, [eventChoicePath, model?.eventFlow, type])

  const currentEventNode = eventNodeHistory[eventNodeHistory.length - 1] || null

  const eventVisualCard = useMemo(() => {
    if (type !== 'event') return null

    const candidates = [
      ...(currentEventNode?.relatedCards || []),
      ...(model?.eventFlow?.relatedCards || []),
      model?.fallbackCharacterCard || null,
    ].filter(Boolean)

    return candidates[0] || null
  }, [currentEventNode?.relatedCards, model?.eventFlow?.relatedCards, model?.fallbackCharacterCard, type])

  const eventNarrativeBlocks = useMemo(() => {
    if (type !== 'event') return []

    return eventNodeHistory.flatMap((node) => {
      const promptBlocks = (node.promptEntries || [])
        .map((entry) => normalizeTextContent(entry.text))
        .filter(Boolean)
      const optionBlock = normalizeTextContent(node.option?.text)
      return optionBlock ? [...promptBlocks, optionBlock] : promptBlocks
    })
  }, [eventNodeHistory, type])

  const hasEventNarrative = eventNarrativeBlocks.length > 0
  const eventResultActions = currentEventNode?.actions || []
  const eventResultEffects = currentEventNode?.effects || []

  const selectedHintIds = useMemo(() => {
    return new Set(Object.values(settlementSelections).filter(Boolean))
  }, [settlementSelections])
  const selectedGlobalHintIds = useMemo(() => new Set(globalSettlementSelection ? [globalSettlementSelection] : []), [globalSettlementSelection])
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
  const selectedHintSegments = useMemo(() => {
    const slotHintSegments = (model?.slots || [])
      .flatMap((slot) => slot.settlementHints || [])
      .filter((hint) => selectedHintIds.has(hint.id))
      .map((hint) => ({
        guid: hint.id.split(':').slice(-1)[0] || hint.id,
        phase: '结算条件',
        title: hint.label,
        text: hint.primaryText || '',
        conditions: hint.fullConditions?.length > 0
          ? hint.fullConditions
          : (hint.fullConditionText ? [hint.fullConditionText] : (hint.conditionText ? [hint.conditionText] : [])),
        options: [],
        actions: [],
        choiceActions: [],
        effects: hint.effects || [],
      }))

    const globalHintSegments = (model?.globalSettlementHints || [])
      .filter((hint) => selectedGlobalHintIds.has(hint.id))
      .map((hint) => ({
        guid: hint.id.split(':').slice(-1)[0] || hint.id,
        phase: '全局条件',
        title: hint.label,
        text: hint.primaryText || '',
        conditions: hint.fullConditions?.length > 0
          ? hint.fullConditions
          : (hint.fullConditionText ? [hint.fullConditionText] : (hint.conditionText ? [hint.conditionText] : [])),
        options: [],
        actions: [],
        choiceActions: [],
        effects: hint.effects || [],
      }))

    return [...slotHintSegments, ...globalHintSegments]
  }, [model?.globalSettlementHints, model?.slots, selectedGlobalHintIds, selectedHintIds])

  const availableSegments = useMemo(() => {
    if (type !== 'rite') return model?.segments || []
    const matchedSegments = (model?.segments || []).filter((segment) => (
      segment.guid && (selectedHintGuids.has(segment.guid) || selectedGlobalHintGuids.has(segment.guid))
    ))
    const matchedGuids = new Set(matchedSegments.map((segment) => segment.guid).filter(Boolean))
    const fallbackSegments = selectedHintSegments.filter((segment) => (
      segment.text && !matchedGuids.has(segment.guid)
    ))
    return [...fallbackSegments, ...matchedSegments]
  }, [model?.segments, selectedHintGuids, selectedGlobalHintGuids, selectedHintSegments, type])

  const visibleLines = dialogueLines.slice(0, revealedLineCount)
  const visibleSegments = availableSegments.slice(0, revealedSegmentCount)
  const executionSlotCards = useMemo(() => {
    return Object.fromEntries((model?.slots || []).map((slot) => [
      slot.id,
      resolveSelectedSlotCard(model, slot.id, slotSelections, settlementSelections, cardsById),
    ]))
  }, [cardsById, model, settlementSelections, slotSelections])
  const executionFlow = useMemo(() => {
    if (executionMode === 'waiting_round_end') {
      if (!model?.waitingRoundEnd) return []
      return {
        steps: [{
          id: 'waiting-round-end',
          phase: '超时结算',
          title: '等待回合结束',
          text: model.waitingRoundEnd.raw?.result_text || model.waitingRoundEnd.raw?.tips_text || '',
          effects: model.waitingRoundEnd.effects || [],
          actions: (model.waitingRoundEnd.actions || []).filter((action) => action?.targetType && action?.targetId),
          conditions: [],
          popItems: [],
          tips: [],
        }],
        conditionGroups: [],
        autoSelections: {},
        isComplete: true,
      }
    }

    return buildExecutionFlow(model, {
      branchSelections: executionConditionSelections,
      slotCards: executionSlotCards,
      cardsMap: cardsLite,
    })
  }, [cardsLite, executionConditionSelections, executionMode, executionSlotCards, model])
  const executionConditionGroups = executionFlow.conditionGroups || []
  const executionSteps = executionFlow.steps || []
  useEffect(() => {
    if (executionMode !== 'normal') return

    const nextEntries = Object.entries(executionFlow.autoSelections || {}).filter(([, optionId]) => Boolean(optionId))
    if (nextEntries.length === 0) return

    setExecutionConditionSelections((current) => {
      let changed = false
      const next = { ...current }

      nextEntries.forEach(([groupId, optionId]) => {
        if (next[groupId] === optionId) return
        next[groupId] = optionId
        changed = true
      })

      return changed ? next : current
    })
  }, [executionFlow.autoSelections, executionMode])
  useEffect(() => {
    if (!executionOpen) return
    setExecutionStepIndex(Math.max(0, executionSteps.length - 1))
  }, [executionOpen, executionSteps.length])
  const currentGateSegment = visibleSegments.find((segment) => segment.options?.length > 0)
  const canRevealLine = revealedLineCount < dialogueLines.length
  const canRevealSegment = !canRevealLine && !currentGateSegment && revealedSegmentCount < availableSegments.length
  const isFullscreenReader = FULLSCREEN_TYPES.has(type)
  const slotBackgroundMap = templateData?.slots || {}
  const templateSlotLayout = useMemo(
    () => buildTemplateSlotLayout(slotBackgroundMap, (model?.slots || []).map((slot) => slot.id)),
    [slotBackgroundMap, model?.slots]
  )

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

  async function handleOpenAction(action, offsetIndex = 0, options = {}) {
    if (!action?.targetType || !action?.targetId) return
    const { autoSelect = true } = options

    const targetNodeKey = await mountNodeOnCanvas(
      {
        id: action.targetId,
        type: action.targetType,
        name: action.text,
      },
      { x: 460 + offsetIndex * 60, y: 180 + offsetIndex * 50 },
      { autoSelect, expandRelations: false }
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

  async function handleOpenCard(card, offsetIndex = 0) {
    if (!card?.id) return
    await mountNodeOnCanvas(
      {
        id: String(card.id),
        type: 'card',
        name: card.name,
      },
      { x: 560 + offsetIndex * 32, y: 220 + offsetIndex * 24 },
      { autoSelect: false, expandRelations: false }
    )
  }

  function branchActions(segment, branch) {
    return (segment.choiceActions || []).filter((action) => action.branch === branch)
  }

  function resetFlow(nextSlotId = activeSlotId, nextSelections = slotSelections, nextSettlementSelections = settlementSelections, nextGlobalSelection = globalSettlementSelection) {
    const nextLines = buildDialogueLines(nextSlotId, nextSelections, nextSettlementSelections, nextGlobalSelection)
    setRevealedLineCount(type === 'rite' ? nextLines.length : (nextLines.length > 0 ? 1 : 0))
    setRevealedSegmentCount(type === 'rite' ? 9999 : 0)
    setExecutionStepIndex(0)
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
    setConditionFilterText('')
    setCandidatePage(1)
    setSelectedConditionId(slotConditionSelections[slotId] || null)
    setConditionSelectorOpen(false)
    setCandidateConditionFilterText('')
    setCandidateCardFilterText('')
    setConditionPreviewExpanded(false)
    resetFlow(slotId)
  }

  function handleChangeCandidate(candidateId) {
    if (!selectedSlot) return

    const nextSelections = {
      ...slotSelections,
      [selectedSlot.id]: candidateId,
    }

    setSlotSelections(nextSelections)
    setCandidatePage(1)
    const nextLines = buildDialogueLines(selectedSlot.id, nextSelections, settlementSelections, globalSettlementSelection)
    setRevealedLineCount(nextLines.length > 0 ? 1 : 0)
    setRevealedSegmentCount(0)
    setExecutionStepIndex(0)
  }

  function handleSelectExecutionCondition(groupId, optionId) {
    setExecutionConditionSelections((current) => {
      const next = { ...current }
      if (optionId) {
        next[groupId] = optionId
      } else {
        delete next[groupId]
      }
      return next
    })
    setExecutionStepIndex(0)
  }

  function handleSelectEventChoice(choiceTag, depth) {
    setEventChoicePath((current) => {
      const prefix = current.slice(0, depth)
      if (current[depth] === choiceTag) {
        return prefix
      }
      return [...prefix, choiceTag]
    })
  }

  function handleOpenExecution() {
    executedActionKeyRef.current = new Set()
    setExecutionMode('normal')
    setExecutionConditionSelections({})
    setExecutionStepIndex(0)
    setExecutionOpen(true)
  }

  function handleSelectConditionGroup(conditionId) {
    if (!selectedSlot) return
    const nextGroup = selectedSlotConditionGroups.find((group) => group.id === conditionId)
    if (!nextGroup) return

    setSelectedConditionId(conditionId)
    setConditionSelectorOpen(false)
    setCandidatePage(1)

    const fallbackCandidate = nextGroup.candidates[0] || null
    if (fallbackCandidate) {
      const nextSelections = {
        ...slotSelections,
        [selectedSlot.id]: fallbackCandidate.id,
      }
      setSlotSelections(nextSelections)
      resetFlow(selectedSlot.id, nextSelections, settlementSelections, globalSettlementSelection)
    }
  }

  function handleStepCondition(direction) {
    if (visibleConditionGroups.length <= 1) return
    const currentIndex = visibleConditionGroups.findIndex((group) => group.id === activeConditionGroup?.id)
    const safeIndex = currentIndex >= 0 ? currentIndex : 0
    const nextIndex = (safeIndex + direction + visibleConditionGroups.length) % visibleConditionGroups.length
    handleSelectConditionGroup(visibleConditionGroups[nextIndex].id)
  }

  function handleOpenWaitingRoundExecution() {
    executedActionKeyRef.current = new Set()
    setExecutionMode('waiting_round_end')
    setExecutionConditionSelections({})
    setExecutionStepIndex(0)
    setExecutionOpen(true)
  }

  function handleAdvanceExecution() {
    setExecutionStepIndex((current) => {
      if (current >= executionSteps.length - 1) return current
      return current + 1
    })
  }

  function handleManualReset() {
    const defaults = Object.fromEntries(
      (model.slots || []).map((slot) => [slot.id, slot.candidates?.[0]?.id || null])
    )
    const hintDefaults = buildDefaultSettlementSelections(model.slots || [])
    setSlotSelections(defaults)
    setSettlementSelections(hintDefaults)
    setGlobalSettlementSelection(pickDefaultHintId(model.globalSettlementHints || []))
    setCandidatePage(1)
    setActiveSlotId(model.slots?.[0]?.id || null)
    const nextLines = splitIntro(model.intro)
    setRevealedLineCount(type === 'rite' ? nextLines.length : (nextLines.length > 0 ? 1 : 0))
    setRevealedSegmentCount(type === 'rite' ? 9999 : 0)
    setAutoAdvance(false)
    setExecutionOpen(false)
    setExecutionMode('normal')
    setExecutionConditionSelections({})
    setExecutionStepIndex(0)
    executedActionKeyRef.current = new Set()
    setEventChoicePath([])
  }

  useEffect(() => {
    if (type !== 'event' || hasEventNarrative) return

    const firstRiteAction = (model?.eventFlow?.actions || []).find((action) => action.targetType === 'rite')
    if (!firstRiteAction || !data?.id) return
    if (autoMountedEventIdRef.current === data.id) return

    autoMountedEventIdRef.current = data.id
    void handleOpenAction(firstRiteAction, 0, { autoSelect: false })
  }, [data?.id, hasEventNarrative, model?.eventFlow?.actions, type])

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

  const currentExecutionStep = executionSteps[executionStepIndex] || null

  const executionSummaryEffects = useMemo(
    () => executionSteps.flatMap((step) => step.effects || []),
    [executionSteps]
  )
  const executionSummaryActions = useMemo(
    () => executionSteps.flatMap((step) => step.actions || []),
    [executionSteps]
  )
  const executionSummaryPops = useMemo(
    () => executionSteps.flatMap((step) => step.popItems || []),
    [executionSteps]
  )

  useEffect(() => {
    let cancelled = false

    async function loadExecutionTargetNames() {
      const next = {}
      let contentNameMap = {}
      const actionTargets = executionSteps
        .flatMap((step) => step.actions || [])
        .filter((action) => action?.targetType && action?.targetId && action.targetType !== 'card')

      try {
        contentNameMap = await window.electronAPI.configGetContentNameMap()
      } catch {
        contentNameMap = {}
      }

      for (const action of actionTargets) {
        const key = `${action.targetType}:${action.targetId}`
        if (next[key]) continue
        const cachedTarget = contentNameMap?.[key]

        if (cachedTarget) {
          next[key] = {
            name: cachedTarget.name || cachedTarget.title || String(action.targetId),
            image: cachedTarget.image || cachedTarget.icon || null,
          }
          continue
        }

        try {
          const result = await window.electronAPI.configReadCache(action.targetType, String(action.targetId))
          next[key] = {
            name: result?.name || result?.title || String(action.targetId),
            image: resolveExecutionTargetImage(action.targetType, result, cardsById),
          }
        } catch {
          next[key] = {
            name: String(action.targetId),
            image: null,
          }
        }
      }

      if (!cancelled) {
        setExecutionTargetNameMap((current) => (shallowEqualObject(current, next) ? current : next))
      }
    }

    loadExecutionTargetNames()
    return () => { cancelled = true }
  }, [cardsById, executionSteps])

  useEffect(() => {
    if (!executionOpen) return
    const actions = (currentExecutionStep?.actions || []).filter((action) => (
      AUTO_FOLLOWUP_TARGET_TYPES.has(action.targetType)
    ))
    if (actions.length === 0) return

    actions.forEach((action, index) => {
      const actionKey = `${currentExecutionStep.id}:${action.targetType}:${action.targetId}:${index}`
      if (executedActionKeyRef.current.has(actionKey)) return
      executedActionKeyRef.current.add(actionKey)
      void handleOpenAction(action, index, { autoSelect: false })
    })
  }, [currentExecutionStep, executionOpen])

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
        <div style={storyHeaderActionsStyle}>
          {type === 'rite' && (
            <button
              type="button"
              onClick={() => setHideReaderUi((value) => !value)}
              style={secondaryButtonStyle}
            >
              {hideReaderUi ? '显示内容' : '显示背景图'}
            </button>
          )}
          {data?._source_path && (
            <button type="button" onClick={handleViewRaw} style={secondaryButtonStyle}>查看原始文件</button>
          )}
          <button type="button" onClick={onClose} style={closeButtonStyle}>关闭</button>
        </div>
      </div>
    </div>
  )

  const eventContent = type === 'event' ? (
    <div style={eventReaderShellStyle}>
      {hasEventNarrative ? (
        <EventBackdrop>
          <div style={eventReaderGridStyle}>
            <div style={eventBoardStageStyle}>
              <div style={eventBoardContentStyle} ref={readerBodyRef}>
                {eventNarrativeBlocks.map((text, index) => (
                  <div key={`${index}:${text.slice(0, 24)}`} style={eventParagraphStyle}>
                    {text}
                  </div>
                ))}

                {eventResultEffects.length > 0 && (
                  <div style={eventResultBlockStyle}>
                    <div style={sectionTitleStyle}>触发结果</div>
                    <EffectSummary effects={eventResultEffects} onOpenCard={handleOpenCard} />
                  </div>
                )}

                {eventResultActions.length > 0 && (
                  <div style={eventResultBlockStyle}>
                    <div style={sectionTitleStyle}>后续触发</div>
                    <div style={eventActionRowStyle}>
                      {eventResultActions.map((action, actionIndex) => (
                        <button
                          key={`${action.key}:${action.value}:${actionIndex}`}
                          type="button"
                          style={actionButtonStyle}
                          onClick={() => handleOpenAction(action, actionIndex)}
                        >
                          打开{action.targetType === 'rite' ? '仪式' : action.targetType === 'event' ? '幕后' : action.targetType === 'loot' ? '掉落池' : '结局'} {action.targetId}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {eventNodeHistory.map((node, depth) => {
                const selectedChoice = eventChoicePath[depth] || null
                const activeChoices = node.choices || []
                if (activeChoices.length === 0) return null

                return (
                  <div key={`${node.id}:choices`} style={eventChoicesWrapStyle}>
                    {activeChoices.map((choice) => (
                      <EventChoiceCard
                        key={choice.id}
                        option={choice}
                        active={selectedChoice === choice.tag}
                        onSelect={() => handleSelectEventChoice(choice.tag, depth)}
                      />
                    ))}
                  </div>
                )
              })}
            </div>

            <div style={eventReaderVisualStageStyle}>
              {model.image ? (
                <PreviewImage pic={model.image} maxHeight={260} />
              ) : (
                <div style={eventVisualSpacerStyle} />
              )}

              <div style={eventPortraitDockStyle}>
                <EventSideFigure card={eventVisualCard} />
              </div>
            </div>
          </div>
        </EventBackdrop>
      ) : (
        <div style={eventTriggerShellStyle}>
          <div style={eventTriggerDetailStyle}>
            <div style={sectionTitleStyle}>事件详情</div>
            <div style={{ ...smallLineStyle, marginTop: 10 }}>
              这个事件没有可直接阅读的正文，当前作为流程触发器处理。
            </div>
            {model.meta.length > 0 && (
              <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
                {model.meta.map((item) => (
                  <div key={item} style={eventTriggerMetaStyle}>{item}</div>
                ))}
              </div>
            )}
            {eventResultEffects.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={sectionTitleStyle}>触发结果</div>
                <EffectSummary effects={eventResultEffects} onOpenCard={handleOpenCard} />
              </div>
            )}
            {eventResultActions.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={sectionTitleStyle}>后续触发</div>
                <div style={{ ...smallLineStyle, marginTop: 8 }}>
                  已自动将相关后续节点带到画布。
                </div>
                <div style={{ ...eventActionRowStyle, marginTop: 12 }}>
                  {eventResultActions.map((action, actionIndex) => (
                    <button
                      key={`${action.key}:${action.value}:${actionIndex}`}
                      type="button"
                      style={actionButtonStyle}
                      onClick={() => handleOpenAction(action, actionIndex)}
                    >
                    打开{action.targetType === 'rite' ? '仪式' : action.targetType === 'event' ? '幕后' : action.targetType === 'loot' ? '掉落池' : '结局'} {action.targetId}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  ) : null

  const content = type === 'event' ? eventContent : (
    <div style={{
      height: '100%',
      minHeight: 0,
      display: 'grid',
      color: '#f1e8d5',
      overflow: 'hidden',
      backgroundImage: type === 'rite' && templateBgUrl ? `url("${templateBgUrl}")` : 'none',
      backgroundRepeat: 'no-repeat',
      backgroundSize: type === 'rite' && hideReaderUi ? '100% auto' : 'cover',
      backgroundPosition: type === 'rite' && hideReaderUi ? 'top center' : 'center',
      backgroundColor: '#080604',
      borderRadius: 28,
    }}>
      <div style={{
        height: '100%',
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: type === 'rite'
          ? 'minmax(0, 2fr) minmax(360px, 1fr)'
          : 'minmax(0, 1fr)',
        gap: 22,
        overflow: 'hidden',
      }}>
        {type === 'rite' ? (
          hideReaderUi ? (
            <div style={riteHiddenBackdropStyle} />
          ) : (
          <>
            <div style={{
              height: '100%',
              minHeight: 0,
              display: 'grid',
              gridTemplateRows: 'auto minmax(0, 1fr)',
              gap: 18,
              overflow: 'hidden',
            }}>
              {model.slots.length > 0 && (
                <div style={ritePreparationPanelStyle}>
                  <div>
                    <div style={sectionTitleStyle}>卡牌槽位</div>
                    <div style={{ ...smallLineStyle, marginTop: 8 }}>
                      固定槽位会直接显示指定卡牌，条件槽位可在下方分页浏览满足条件的卡牌。
                    </div>
                  </div>

                  <div style={riteSlotScrollerStyle}>
                    {model.slots.map((slot) => {
                      const currentCandidate = slot.candidates?.find((candidate) => candidate.id === slotSelections[slot.id]) || slot.candidates?.[0] || null
                      const overrideCard = slotOverrideCards[slot.id] || null
                      const displayCandidate = overrideCard
                        ? { ...currentCandidate, cards: [overrideCard], label: overrideCard.name || currentCandidate?.label }
                        : currentCandidate
                      const activeTags = (slot.settlementHints || [])
                        .filter((hint) => settlementSelections[slot.id] === hint.id)
                        .map((hint) => ({
                          id: hint.id,
                          label: hint.label,
                          onRemove: () => {
                            const next = { ...settlementSelections, [slot.id]: null }
                            setSettlementSelections(next)
                            resetFlow(activeSlotId, slotSelections, next, globalSettlementSelection)
                          },
                        }))
                      return (
                        <SlotButton
                          key={slot.id}
                          slot={slot}
                          slotBgKey={slotBackgroundMap?.[slot.id]?.slot_bg || templateData?.nomal_slot_bg || READER_CHROME.assets.slotFrame.asset}
                          active={activeSlotId === slot.id}
                          candidate={displayCandidate}
                          tags={activeTags}
                          onClick={() => handleSelectSlot(slot.id)}
                        />
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={candidateStageStyle}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <div style={sectionTitleStyle}>卡牌候选</div>
                      <div style={{ ...smallLineStyle, marginTop: 8 }}>
                        当前槽位：{selectedSlot?.title || '未选择槽位'}
                      </div>
                    </div>
                    <div style={candidateToolbarStyle}>
                      <div style={candidateToolbarGroupStyle}>
                        <button
                          type="button"
                          style={secondaryButtonStyle}
                          onClick={() => handleStepCondition(-1)}
                          disabled={visibleConditionGroups.length <= 1}
                        >
                          上一个条件
                        </button>
                        <button
                          type="button"
                          style={activeToggleButtonStyle}
                          onClick={() => setConditionSelectorOpen(true)}
                          title={activeConditionGroup?.label || '默认条件'}
                        >
                          <span style={conditionSummaryTextStyle}>
                            {truncateDisplayText(activeConditionGroup?.label || '默认条件', CONDITION_BUTTON_MAX_LENGTH)}
                          </span>
                        </button>
                        <button
                          type="button"
                          style={secondaryButtonStyle}
                          onClick={() => handleStepCondition(1)}
                          disabled={visibleConditionGroups.length <= 1}
                        >
                          下一个条件
                        </button>
                      </div>
                      <div style={{ ...candidateToolbarGroupStyle, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                        <input
                          type="text"
                          value={candidateCardFilterText}
                          onChange={(event) => setCandidateCardFilterText(event.target.value)}
                          placeholder="搜索卡牌"
                          style={candidateSearchInputStyle}
                        />
                        <button
                          type="button"
                          style={secondaryButtonStyle}
                          onClick={() => setCandidatePage((page) => Math.max(1, page - 1))}
                          disabled={candidatePage === 1}
                        >
                          上一页
                        </button>
                        <span style={{ ...smallLineStyle, whiteSpace: 'nowrap', flexShrink: 0 }}>{candidatePage} / {selectedSlotPageCount}</span>
                        <button
                          type="button"
                          style={secondaryButtonStyle}
                          onClick={() => setCandidatePage((page) => Math.min(selectedSlotPageCount, page + 1))}
                          disabled={candidatePage === selectedSlotPageCount}
                        >
                          下一页
                        </button>
                      </div>
                    </div>
                  </div>
                  {activeConditionGroup?.label && (
                    <div style={{ marginTop: 12, position: 'relative', zIndex: 1 }}>
                      <div
                        style={{
                          ...translucentTextBlockStyle,
                          marginTop: 0,
                          overflow: conditionPreviewExpanded ? 'auto' : 'hidden',
                          whiteSpace: conditionPreviewExpanded ? 'normal' : 'nowrap',
                          textOverflow: conditionPreviewExpanded ? 'clip' : 'ellipsis',
                          maxHeight: conditionPreviewExpanded ? 144 : undefined,
                        }}
                        title={activeConditionGroup.label}
                        onMouseEnter={() => setConditionPreviewExpanded(true)}
                        onMouseLeave={() => setConditionPreviewExpanded(false)}
                      >
                        {conditionPreviewExpanded
                          ? activeConditionGroup.label
                          : truncateDisplayText(activeConditionGroup.label, CONDITION_PREVIEW_MAX_LENGTH)}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{
                  marginTop: 16,
                  minHeight: 0,
                  overflowY: 'auto',
                  paddingRight: 4,
                  display: 'grid',
                  gap: 18,
                  alignContent: 'start',
                }}>
                  {activeConditionCandidates.length > 0 ? (
                    <>
                      <div style={riteCandidateGridStyle}>
                        {pagedSelectedSlotCandidates.map((candidate) => (
                          <CandidateHandItem
                            key={candidate.id}
                            candidate={candidate}
                            active={slotSelections[selectedSlot.id] === candidate.id}
                            onSelect={() => handleChangeCandidate(candidate.id)}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={emptyCandidateStyle}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#f5e5c4' }}>
                        当前槽位暂无可选卡牌
                      </div>
                      <div style={{ ...smallLineStyle, marginTop: 10, textAlign: 'center' }}>
                        这个槽位没有找到可直接展示的候选卡牌。
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{
              height: '100%',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}>
              <div style={ritePreparationInfoPanelStyle}>
                <div style={{
                  minHeight: 0,
                  overflowY: 'auto',
                  padding: '24px 24px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                  alignItems: 'stretch',
                }} ref={readerBodyRef}>
                  {model.image && !hideReaderUi && (
                    <PreviewImage pic={model.image} maxHeight={180} />
                  )}

                  {model.tipsText && !hideReaderUi && (
                    <div>
                      <div style={sectionTitleStyle}>准备提示</div>
                      <div style={translucentTextBlockStyle}>{model.tipsText}</div>
                    </div>
                  )}

                  {model.tags?.length > 0 && !hideReaderUi && (
                    <div>
                      <div style={sectionTitleStyle}>标签提示</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                        {model.tags.map((tag) => (
                          <span key={tag} style={effectChipStyle}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {model.intro && !hideReaderUi && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={sectionTitleStyle}>仪式正文</div>
                      <div style={translucentTextBlockStyle}>
                        <div style={{ fontSize: 16, lineHeight: 1.9, color: '#f7edd8', whiteSpace: 'pre-wrap' }}>
                          {model.intro}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedCandidatePopItems.length > 0 && !hideReaderUi && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={sectionTitleStyle}>当前条件对白</div>
                      <div style={translucentTextBlockStyle}>
                        <div style={{ display: 'grid', gap: 12 }}>
                          {selectedCandidatePopItems.map((pop, index) => (
                            <StoryPopLine
                              key={`${pop.key || 'pop'}:${index}`}
                              pop={pop}
                              card={selectedCandidate?.cards?.[0] || null}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={ritePreparationFooterStyle}>
                  {type === 'rite' && executionSteps.length > 0 && (
                    <button
                      type="button"
                      style={primaryButtonStyle}
                      onClick={handleOpenExecution}
                    >
                      进入结算
                    </button>
                  )}
                  {type === 'rite' && model.waitingRoundEnd && (
                    <button
                      type="button"
                      style={actionButtonStyle}
                      onClick={handleOpenWaitingRoundExecution}
                    >
                      超时结算
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
          )
        ) : (
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
            border: '1px solid rgba(244, 232, 206, 0.2)',
            boxShadow: '0 16px 34px rgba(0, 0, 0, 0.12)',
            backgroundColor: 'rgba(22, 17, 13, 0.12)',
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
                        background: 'rgba(18, 14, 11, 0.24)',
                        border: '1px solid rgba(244, 232, 206, 0.18)',
                        boxShadow: '0 10px 22px rgba(0, 0, 0, 0.1)',
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

                      <EffectSummary effects={segment.effects} onOpenCard={handleOpenCard} />

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
                              打开{action.targetType === 'rite' ? '仪式' : action.targetType === 'event' ? '幕后' : action.targetType === 'loot' ? '掉落池' : '结局'} {action.targetId}
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
              {type === 'rite' && executionSteps.length > 0 && (
                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={handleOpenExecution}
                >
                  进入结算
                </button>
              )}
              {!canRevealLine && !canRevealSegment && availableSegments.length > 0 && (
                <span style={smallLineStyle}>当前已推进到可选分支或末尾。</span>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  )

  if (!isFullscreenReader) return content

  return (
    <div style={overlayShellStyle}>
      <div style={overlayCardStyle}>
        <div style={overlayHeaderStyle}>
          <div style={overlayHeaderLeftStyle}>{headerBlock}</div>
        </div>
        <div style={{ height: '100%', minHeight: 0, overflow: 'hidden', padding: 24 }}>
          {content}
        </div>
      </div>
      {executionOpen && type === 'rite' && (
        <ExecutionModal
          open={executionOpen}
          model={model}
          settlementBgUrl={settlementBgUrl}
          settlementDiceBgUrl={settlementDiceBgUrl}
          executionSteps={executionSteps}
          executionSummaryEffects={executionSummaryEffects}
          executionSummaryActions={executionSummaryActions}
          executionSummaryPops={executionSummaryPops}
          executionTargetNameMap={executionTargetNameMap}
          executionSlotCards={executionSlotCards}
          executionConditionGroups={executionConditionGroups}
          executionConditionSelections={executionConditionSelections}
          onSelectCondition={handleSelectExecutionCondition}
          onOpenCard={handleOpenCard}
          onOpenAction={handleOpenAction}
          onClose={() => {
            setExecutionOpen(false)
            setExecutionMode('normal')
            setExecutionConditionSelections({})
          }}
        />
      )}
      {conditionSelectorOpen && type === 'rite' && (
        <div style={selectionOverlayStyle} onClick={() => setConditionSelectorOpen(false)}>
          <div style={selectionDialogStyle} onClick={(event) => event.stopPropagation()}>
            <div style={selectionDialogHeaderStyle}>
              <div>
                <div style={sectionTitleStyle}>条件选择</div>
                <div style={{ ...smallLineStyle, marginTop: 6 }}>
                  当前槽位：{selectedSlot?.title || '未选择槽位'}
                </div>
              </div>
              <button
                type="button"
                style={closeButtonStyle}
                onClick={() => setConditionSelectorOpen(false)}
              >
                关闭
              </button>
            </div>
            <div style={selectionDialogSearchWrapStyle}>
              <input
                type="text"
                value={candidateConditionFilterText}
                onChange={(event) => setCandidateConditionFilterText(event.target.value)}
                placeholder="搜索条件"
                style={readerFilterInputStyle}
              />
            </div>
            <div style={selectionDialogBodyStyle}>
              {visibleConditionGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  style={group.id === activeConditionGroup?.id ? selectionDialogItemActiveStyle : selectionDialogItemStyle}
                  title={group.label}
                  onClick={() => handleSelectConditionGroup(group.id)}
                >
                  <div style={selectionDialogItemTitleStyle}>
                    {group.label}
                  </div>
                  <div style={selectionDialogItemMetaStyle}>
                    候选卡牌：{group.candidates.length}
                  </div>
                </button>
              ))}
              {visibleConditionGroups.length === 0 && (
                <div style={selectionDialogEmptyStyle}>
                  没有匹配当前搜索的条件。
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {rawContent !== null && (
        <RawFileView content={rawContent} onClose={() => setRawContent(null)} />
      )}
    </div>
  )
}

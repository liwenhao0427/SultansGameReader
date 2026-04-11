import { useEffect, useMemo, useRef, useState } from 'react'
import useConfigStore from '../../stores/useConfigStore'
import { useResolvedImage } from '../../services/imageResolver'
import { adaptStoryData } from '../../services/storyAdapter'
import { READER_CHROME } from '../../readerChromeConfig'
import { CARD_RENDER_CONFIG, getCardFrameHeight, getCardRarityFrameAsset, READER_RESOURCE_ASSETS, RITE_TEMPLATE_DEFAULTS } from '../../resourceConfig'
import { linkNodesOnCanvas, mountNodeOnCanvas } from '../../services/graphNavigation'
import RawFileView from '../RawFileView'

const FULLSCREEN_TYPES = new Set(['rite', 'event', 'dt', 'over', 'after_story'])

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

  return normalized
    .split(/(?<=[。！？\n])/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
}

function CardPortrait({ card, compact = false, showName = true }) {
  const { url } = useResolvedImage(card?.image)
  const { url: rareFrameUrl } = useResolvedImage(getCardRarityFrameAsset(card?.rare))
  const width = compact ? 54 : 66
  const height = getCardFrameHeight(width)
  const artInset = compact ? '1px 2px 9px' : '4px 5px 20px'

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

function EffectSummary({ effects, compact = false }) {
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
          {effect.label}
          {effect.cards?.length > 0 && (
            <span style={{ opacity: 0.92 }}>：{effect.cards.map((card) => card.name).join(' / ')}</span>
          )}
        </div>
      ))}
    </div>
  )
}

function SlotButton({ slot, active, candidate, tags, onClick, slotBgKey, bubbleText }) {
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
        {bubbleText && (
          <div style={slotBubbleStyle}>
            {bubbleText}
          </div>
        )}
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
            <div style={{ position: 'absolute', inset: '3px 4px 7px' }}>
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

// 执行弹窗中的槽位展示（和SlotButton样式一致，无点击交互）
function ExecutionSlot({ slot, previewCard, slotCaption, slotBgKey }) {
  const { url: slotBgUrl } = useResolvedImage(slotBgKey)

  return (
    <div style={{
      width: READER_CHROME.assets.slotFrame.width,
      minHeight: READER_CHROME.assets.slotFrame.minHeight,
      borderRadius: 22,
      overflow: 'hidden',
      border: '1px solid rgba(219, 207, 181, 0.18)',
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
        <div style={{ position: 'absolute', inset: '3px 4px 7px' }}>
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
        height: 184,
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
        boxSizing: 'border-box',
      }}
    >
      <div style={{
        height: '100%',
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
          <div
            title={candidate.label}
            style={{
              fontSize: 16,
              fontWeight: 800,
              lineHeight: 1.3,
              color: '#fff2d7',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
            }}
          >
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
            <span
              title={candidate.label}
              style={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 3,
                overflow: 'hidden',
              }}
            >
              {candidate.label}
            </span>
          </div>
        )}
      </div>
    </button>
  )
}

function SettlementHintItem({ hint, active, onToggle }) {
  const conditionText = hint.conditionText || '无额外条件'

  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: '100%',
        padding: '10px 12px',
        borderRadius: 18,
        border: active ? '1px solid rgba(143, 191, 119, 0.42)' : '1px solid rgba(212, 184, 126, 0.14)',
        background: active ? 'rgba(100, 140, 83, 0.12)' : 'rgba(22, 18, 14, 0.94)',
        color: '#f1e8d5',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'block',
      }}
    >
      <div
        title={conditionText}
        style={{
          fontSize: 14,
          lineHeight: 1.75,
          color: active ? '#fff3dd' : '#e5d4b1',
          whiteSpace: 'pre-wrap',
        }}
      >
        {conditionText}
      </div>
    </button>
  )
}

function SettlementHintGroup({
  title,
  description,
  hints,
  selectedCount,
  filterText,
  onFilterChange,
  selectedHintId,
  onToggle,
}) {
  if (!hints.length) return null

  return (
    <div style={settlementPanelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <div style={sectionTitleStyle}>{title}</div>
          <div style={{ ...smallLineStyle, marginTop: 6 }}>
            {description}
          </div>
        </div>
        <div style={settlementCountStyle}>
          已选 {selectedCount}
        </div>
      </div>
      <input
        type="text"
        value={filterText}
        onChange={(event) => onFilterChange(event.target.value)}
        placeholder="筛选条件..."
        style={{ ...readerFilterInputStyle, marginTop: 14 }}
      />
      <div style={{
        marginTop: 14,
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 10,
      }}>
        {hints.map((hint) => (
          <SettlementHintItem
            key={hint.id}
            hint={hint}
            active={selectedHintId === hint.id}
            onToggle={() => onToggle(hint.id)}
          />
        ))}
      </div>
    </div>
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
  const [conditionFilterText, setConditionFilterText] = useState('')
  const [slotBubbleTexts, setSlotBubbleTexts] = useState({})
  const [executionOpen, setExecutionOpen] = useState(false)
  const [executionStepIndex, setExecutionStepIndex] = useState(0)
  const [executionAutoAdvance, setExecutionAutoAdvance] = useState(false)
  const [bgPreviewOpen, setBgPreviewOpen] = useState(false)
  const [eventChoicePath, setEventChoicePath] = useState([])
  const executionBodyRef = useRef(null)
  const readerBodyRef = useRef(null)
  const bubbleTimersRef = useRef({})
  const autoMountedEventIdRef = useRef(null)
  const { url: templateBgUrl } = useResolvedImage(templateData?.bg || READER_RESOURCE_ASSETS.defaultRiteBackground)
  const { url: templateFgUrl } = useResolvedImage(templateData?.fg || null)

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
    setSlotBubbleTexts({})
    setActiveSlotId(firstSlotId)
    setRevealedLineCount(initialLines.length > 0 ? 1 : 0)
    setRevealedSegmentCount(0)
    setExecutionOpen(false)
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

  const selectedCandidate = useMemo(() => {
    if (!selectedSlot) return null
    return selectedSlot.candidates?.find((candidate) => candidate.id === slotSelections[selectedSlot.id]) || selectedSlot.candidates?.[0] || null
  }, [selectedSlot, slotSelections])

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

  const selectedSettlementHints = useMemo(() => {
    if (!selectedSlot) return []
    const selectedId = settlementSelections[selectedSlot.id]
    return (visibleSettlementHintsBySlot[selectedSlot.id] || []).filter((hint) => hint.id === selectedId)
  }, [selectedSlot, settlementSelections, visibleSettlementHintsBySlot])

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
        conditions: hint.conditionText ? [hint.conditionText] : [],
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
        conditions: hint.conditionText ? [hint.conditionText] : [],
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
  const executionSteps = useMemo(() => {
    const introSteps = dialogueLines.map((line, index) => ({
      id: `line:${index}`,
      phase: '仪式正文',
      title: '',
      text: line,
      effects: [],
    }))

    const segmentSteps = availableSegments.map((segment, index) => ({
      id: `segment:${segment.guid || index}`,
      phase: segment.phase,
      title: segment.title,
      text: segment.text,
      effects: segment.effects || [],
      conditions: segment.conditions || [],
    }))

    return [...introSteps, ...segmentSteps]
  }, [availableSegments, dialogueLines])
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

  function branchActions(segment, branch) {
    return (segment.choiceActions || []).filter((action) => action.branch === branch)
  }

  function resetFlow(nextSlotId = activeSlotId, nextSelections = slotSelections, nextSettlementSelections = settlementSelections, nextGlobalSelection = globalSettlementSelection) {
    const nextLines = buildDialogueLines(nextSlotId, nextSelections, nextSettlementSelections, nextGlobalSelection)
    setRevealedLineCount(nextLines.length > 0 ? 1 : 0)
    setRevealedSegmentCount(0)
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
    resetFlow(slotId)
  }

  function handleChangeCandidate(candidateId) {
    if (!selectedSlot) return

    const nextSelections = {
      ...slotSelections,
      [selectedSlot.id]: candidateId,
    }

    setSlotSelections(nextSelections)
    const nextCandidate = selectedSlot.candidates?.find((candidate) => candidate.id === candidateId) || null
    if (nextCandidate?.bubbleText) {
      const bubbleText = nextCandidate.bubbleText
      setSlotBubbleTexts((current) => ({ ...current, [selectedSlot.id]: bubbleText }))
      if (bubbleTimersRef.current[selectedSlot.id]) {
        window.clearTimeout(bubbleTimersRef.current[selectedSlot.id])
      }
      bubbleTimersRef.current[selectedSlot.id] = window.setTimeout(() => {
        setSlotBubbleTexts((current) => {
          const next = { ...current }
          delete next[selectedSlot.id]
          return next
        })
        delete bubbleTimersRef.current[selectedSlot.id]
      }, 2200)
    }
    const nextLines = buildDialogueLines(selectedSlot.id, nextSelections, settlementSelections, globalSettlementSelection)
    setRevealedLineCount(nextLines.length > 0 ? 1 : 0)
    setRevealedSegmentCount(0)
    setExecutionStepIndex(0)
  }

  function handleSelectSettlementHint(hintId) {
    if (!selectedSlot) return

    const slotId = selectedSlot.id
    // 再次点击已选中的项则取消选中
    const nextId = settlementSelections[slotId] === hintId ? null : hintId
    const nextSettlementSelections = {
      ...settlementSelections,
      [slotId]: nextId,
    }

    setSettlementSelections(nextSettlementSelections)
    resetFlow(slotId, slotSelections, nextSettlementSelections, globalSettlementSelection)
  }

  function handleSelectGlobalSettlementHint(hintId) {
    // 再次点击已选中的项则取消选中
    const nextId = globalSettlementSelection === hintId ? null : hintId
    setGlobalSettlementSelection(nextId)
    resetFlow(activeSlotId, slotSelections, settlementSelections, nextId)
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
    setExecutionStepIndex(0)
    setExecutionAutoAdvance(false)
    setExecutionOpen(true)
  }

  function handleAdvanceExecution() {
    setExecutionStepIndex((current) => {
      if (current >= executionSteps.length - 1) {
        setExecutionAutoAdvance(false)
        return current
      }
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
    setConditionFilterText('')
    setSlotBubbleTexts({})
    setActiveSlotId(model.slots?.[0]?.id || null)
    const nextLines = splitIntro(model.intro)
    setRevealedLineCount(nextLines.length > 0 ? 1 : 0)
    setRevealedSegmentCount(0)
    setAutoAdvance(false)
    setExecutionOpen(false)
    setExecutionStepIndex(0)
    setExecutionAutoAdvance(false)
    setEventChoicePath([])
  }

  useEffect(() => () => {
    Object.values(bubbleTimersRef.current).forEach((timerId) => window.clearTimeout(timerId))
    bubbleTimersRef.current = {}
  }, [])

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
    if (type !== 'event' || !readerBodyRef.current) return

    const frame = requestAnimationFrame(() => {
      const element = readerBodyRef.current
      if (!element) return
      element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
    })

    return () => cancelAnimationFrame(frame)
  }, [eventChoicePath, type])

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

  // 执行弹窗自动推进
  useEffect(() => {
    if (!executionAutoAdvance || !executionOpen) return
    if (executionStepIndex >= executionSteps.length - 1) {
      setExecutionAutoAdvance(false)
      return
    }
    const timer = window.setInterval(() => {
      handleAdvanceExecution()
    }, 1800)
    return () => window.clearInterval(timer)
  }, [executionAutoAdvance, executionOpen, executionStepIndex, executionSteps.length])

  // 执行弹窗正文区域自动滚动到底部
  useEffect(() => {
    if (!executionBodyRef.current || !executionOpen) return
    const frame = requestAnimationFrame(() => {
      if (executionBodyRef.current) {
        executionBodyRef.current.scrollTo({ top: executionBodyRef.current.scrollHeight, behavior: 'smooth' })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [executionStepIndex, executionOpen])

  const currentExecutionStep = executionSteps[executionStepIndex] || null

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
                    <EffectSummary effects={eventResultEffects} />
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
                          打开{action.targetType === 'rite' ? '仪式' : action.targetType === 'event' ? '事件' : '结局'} {action.targetId}
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
                <EffectSummary effects={eventResultEffects} />
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
                      打开{action.targetType === 'rite' ? '仪式' : action.targetType === 'event' ? '事件' : '结局'} {action.targetId}
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
                // 结算条件有卡牌时，构造一个覆盖候选用于显示
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
                      // x 按钮：直接取消选中（置 null）
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
                    bubbleText={slotBubbleTexts[slot.id]}
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

          <div style={{
            marginTop: 16,
            minHeight: 0,
            overflowY: 'auto',
            paddingRight: 4,
            display: 'grid',
            gap: 18,
            alignContent: 'start',
          }}>
            {selectedSlot?.candidates?.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 14,
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
                    <span title={selectedSlot.conditions.join('；')}>
                      条件：{selectedSlot.conditions.join('；')}
                    </span>
                  </div>
                )}
              </div>
            )}

            <SettlementHintGroup
              title="结算条件"
              description="这里改为单选结算分支，默认采用最后一项优先级最高的结算。"
              hints={(selectedSlot?.settlementHints || [])
                .filter((hint) => matchesSlotOccupancyCondition(hint.conditionRaw, slotSelectionState))
                .filter((hint) => {
                  const keyword = conditionFilterText.trim().toLowerCase()
                  if (!keyword) return true
                  return [hint.label, hint.conditionText, hint.primaryText].filter(Boolean).join(' ').toLowerCase().includes(keyword)
                })}
              selectedCount={selectedSettlementHints.length > 0 ? 1 : 0}
              filterText={conditionFilterText}
              onFilterChange={setConditionFilterText}
              selectedHintId={settlementSelections[selectedSlot?.id]}
              onToggle={handleSelectSettlementHint}
            />

            <SettlementHintGroup
              title="全局条件"
              description="这些分支同样只允许选择一个，默认采用最后一项。"
              hints={visibleGlobalSettlementHints
                .filter((hint) => {
                  const keyword = conditionFilterText.trim().toLowerCase()
                  if (!keyword) return true
                  return [hint.label, hint.conditionText, hint.primaryText].filter(Boolean).join(' ').toLowerCase().includes(keyword)
                })}
              selectedCount={globalSettlementSelection ? 1 : 0}
              filterText={conditionFilterText}
              onFilterChange={setConditionFilterText}
              selectedHintId={globalSettlementSelection}
              onToggle={handleSelectGlobalSettlementHint}
            />
          </div>
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

                      <EffectSummary effects={segment.effects} />

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
              {type === 'rite' && executionSteps.length > 0 && (
                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={handleOpenExecution}
                >
                  执行仪式
                </button>
              )}
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
      {executionOpen && type === 'rite' && (
        <div style={executionOverlayStyle}>
          <div style={executionModalStyle}>
            <div style={executionStageStyle}>
              {/* 顶部标题条：仅保留背景色 */}
              <div style={executionToolbarStyle} />

              <div style={executionBodyStyle}>
                <div style={{
                  ...executionCanvasStyle,
                  position: 'relative',
                  background: templateBgUrl
                    ? 'rgba(19, 15, 11, 0.96)'
                    : 'linear-gradient(180deg, rgba(244, 236, 220, 0.98), rgba(221, 206, 180, 0.96))',
                }}>
                  {templateBgUrl && (
                    <TemplateBackgroundLayer pic={templateBgUrl} titleX={templateData?.title_pos?.x} />
                  )}

                  {bgPreviewOpen && templateBgUrl && (
                    <div style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      right: 8,
                      zIndex: 10,
                      borderRadius: 10,
                      overflow: 'hidden',
                      border: '1px solid rgba(212,184,126,0.3)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      background: 'rgba(12, 10, 8, 0.92)',
                    }}>
                      <img
                        src={templateBgUrl}
                        alt="背景全图"
                        style={{ width: '100%', display: 'block', maxHeight: 160, objectFit: 'cover', objectPosition: 'left top' }}
                      />
                      {templateData?.title_pos?.x && (
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: `${Math.min(100, ((Number(templateData.title_pos.x) * 0.75) / 2732) * 100)}%`,
                          height: '100%',
                          border: '2px solid rgba(212, 184, 126, 0.9)',
                          boxSizing: 'border-box',
                          pointerEvents: 'none',
                        }}>
                          <span style={{
                            position: 'absolute',
                            bottom: 4,
                            left: 6,
                            fontSize: 10,
                            color: '#f3e3c1',
                            background: 'rgba(0,0,0,0.6)',
                            padding: '1px 5px',
                            borderRadius: 3,
                          }}>
                            实际使用区域：x &lt; {Math.round(Number(templateData.title_pos.x) * 0.75)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {templateFgUrl && (
                    <img
                      src={templateFgUrl}
                      alt=""
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        pointerEvents: 'none',
                        opacity: 0.96,
                      }}
                    />
                  )}
                  {(model.slots || []).map((slot) => {
                    const candidate = slot.candidates?.find((entry) => entry.id === slotSelections[slot.id]) || slot.candidates?.[0] || null
                    const overrideCard = slotOverrideCards[slot.id] || null
                    const previewCard = overrideCard || candidate?.cards?.[0] || slot.defaultCards?.[0] || null
                    const slotCaption = overrideCard?.name || candidate?.label || slot.defaultCards?.[0]?.name || slot.title
                    const slotBgKey = slotBackgroundMap?.[slot.id]?.slot_bg || templateData?.nomal_slot_bg || READER_CHROME.assets.slotFrame.asset
                    const layout = templateSlotLayout[slot.id] || {}

                    return (
                      <div
                        key={`execution-${slot.id}`}
                        style={{ position: 'absolute', ...layout }}
                      >
                        <ExecutionSlot
                          slot={slot}
                          previewCard={previewCard}
                          slotCaption={slotCaption}
                          slotBgKey={slotBgKey}
                        />
                      </div>
                    )
                  })}
                </div>

                {/* 右侧正文面板：追加显示所有已推进步骤 */}
                <div style={executionDialoguePanelStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <div style={sectionTitleStyle}>仪式正文</div>
                      <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700, color: '#f8ebd1' }}>{model.title}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                      {templateBgUrl && (
                        <button
                          type="button"
                          style={secondaryButtonStyle}
                          onClick={() => setBgPreviewOpen((v) => !v)}
                        >
                          {bgPreviewOpen ? '关闭预览' : '预览背景'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setExecutionOpen(false); setExecutionAutoAdvance(false) }}
                        style={executionCloseButtonStyle}
                      >
                        关闭
                      </button>
                    </div>
                  </div>

                  {/* 正文区：固定高度，可滚动，追加显示 */}
                  <div style={executionDialogueBoxStyle} ref={executionBodyRef}>
                    {executionSteps.slice(0, executionStepIndex + 1).map((step, index) => (
                      <div key={step.id} style={{ marginBottom: index < executionStepIndex ? 16 : 0 }}>
                        {step.conditions?.length > 0 && (
                          <div style={{ marginBottom: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {step.conditions.map((cond, ci) => (
                              <span key={ci} style={executionCondTagStyle}>{cond}</span>
                            ))}
                          </div>
                        )}
                        {step.text ? (
                          <div style={{ fontSize: 17, lineHeight: 1.95, color: '#f7edd8', whiteSpace: 'pre-wrap' }}>
                            {step.text}
                          </div>
                        ) : null}
                        <EffectSummary effects={step.effects} />
                      </div>
                    ))}
                  </div>

                  <div style={executionFooterStyle}>
                    <div style={smallLineStyle}>
                      步骤 {Math.min(executionStepIndex + 1, Math.max(executionSteps.length, 1))} / {Math.max(executionSteps.length, 1)}
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <button
                        type="button"
                        style={executionAutoAdvance ? activeToggleButtonStyle : secondaryButtonStyle}
                        onClick={() => setExecutionAutoAdvance((v) => !v)}
                      >
                        {executionAutoAdvance ? '停止自动' : '自动下一步'}
                      </button>
                      {executionStepIndex < executionSteps.length - 1 ? (
                        <button type="button" style={primaryButtonStyle} onClick={handleAdvanceExecution}>
                          推进下一步
                        </button>
                      ) : (
                        <button type="button" style={primaryButtonStyle} onClick={() => { setExecutionOpen(false); setExecutionAutoAdvance(false) }}>
                          执行完成
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
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

const imageFallbackStyle = {
  color: 'rgba(241, 232, 213, 0.58)',
  fontSize: 14,
}

const eventFallbackBoardStyle = {
  backgroundImage: 'linear-gradient(180deg, rgba(51, 39, 25, 0.92), rgba(17, 13, 10, 0.98))',
}

const eventReaderShellStyle = {
  height: '100%',
  minHeight: 0,
}

const eventBackdropShellStyle = {
  position: 'relative',
  height: '100%',
  minHeight: 0,
  borderRadius: 32,
  overflow: 'hidden',
  background: 'radial-gradient(circle at top, rgba(67, 48, 27, 0.28), rgba(8, 6, 5, 0.96))',
  border: '1px solid rgba(212, 184, 126, 0.12)',
}

const eventBackdropEdgeStyle = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  opacity: 0.96,
}

const eventBackdropHalfStyle = {
  backgroundRepeat: 'no-repeat',
  backgroundSize: '100% 100%',
  backgroundPosition: 'center',
}

const eventBackdropCenterStyle = {
  position: 'relative',
  zIndex: 1,
  height: '100%',
  minHeight: 0,
  padding: '28px 30px',
}

const eventReaderGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 320px',
  gap: 24,
  height: '100%',
  minHeight: 0,
}

const eventBoardStageStyle = {
  minHeight: 0,
  display: 'grid',
  alignContent: 'start',
  gridTemplateRows: 'minmax(0, 1fr) auto',
  gap: 18,
  padding: '48px 0 28px 56px',
}

const eventBoardContentStyle = {
  minHeight: 0,
  overflowY: 'auto',
  padding: '42px 56px 28px 28px',
  display: 'grid',
  alignContent: 'start',
  gap: 18,
}

const eventReaderVisualStageStyle = {
  minHeight: 0,
  display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr) auto',
  gap: 10,
  alignItems: 'end',
}

const eventVisualSpacerStyle = {
  minHeight: 0,
}

const eventPortraitDockStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'flex-end',
  minHeight: 420,
  paddingRight: 12,
}

const eventFigureWrapStyle = {
  width: '100%',
  height: '100%',
  minHeight: 420,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'flex-end',
  overflow: 'hidden',
}

const eventFigureImageStyle = {
  maxWidth: '120%',
  maxHeight: '96%',
  objectFit: 'contain',
  objectPosition: 'right bottom',
  filter: 'drop-shadow(0 24px 34px rgba(0, 0, 0, 0.34))',
}

const eventFigureFallbackStyle = {
  color: '#cdb28a',
  fontSize: 16,
}

const eventParagraphStyle = {
  padding: '0',
  borderRadius: 0,
  background: 'transparent',
  color: '#f4ead6',
  fontSize: 17,
  lineHeight: 2,
  whiteSpace: 'pre-wrap',
  textShadow: '0 1px 6px rgba(0, 0, 0, 0.24)',
}

const eventChoicesWrapStyle = {
  display: 'grid',
  gap: 10,
  paddingRight: 56,
}

const eventChoiceButtonStyle = {
  width: '100%',
  padding: '14px 18px',
  borderRadius: 14,
  border: '1px solid rgba(212, 184, 126, 0.2)',
  background: 'linear-gradient(180deg, rgba(52, 44, 30, 0.86), rgba(23, 18, 13, 0.94))',
  color: '#efe2c7',
  fontSize: 16,
  lineHeight: 1.6,
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'all 160ms ease',
}

const eventChoiceButtonActiveStyle = {
  border: '1px solid rgba(239, 215, 169, 0.52)',
  background: 'linear-gradient(180deg, rgba(95, 73, 43, 0.96), rgba(42, 31, 19, 0.96))',
  boxShadow: '0 10px 24px rgba(0, 0, 0, 0.22)',
}

const eventActionRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

const eventResultBlockStyle = {
  display: 'grid',
  gap: 10,
  marginTop: 10,
}

const eventTriggerShellStyle = {
  height: '100%',
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'stretch',
}

const eventTriggerDetailStyle = {
  width: 'min(460px, 100%)',
  borderRadius: 28,
  border: '1px solid rgba(212, 184, 126, 0.14)',
  background: 'rgba(21, 16, 12, 0.94)',
  boxShadow: '0 24px 56px rgba(0, 0, 0, 0.28)',
  padding: '26px 24px',
  overflowY: 'auto',
}

const eventTriggerMetaStyle = {
  padding: '10px 12px',
  borderRadius: 14,
  background: 'rgba(41, 31, 20, 0.82)',
  color: '#e5d2ae',
  fontSize: 13,
  lineHeight: 1.7,
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

const slotBubbleStyle = {
  maxWidth: 180,
  padding: '8px 10px',
  borderRadius: 14,
  background: 'rgba(246, 237, 214, 0.96)',
  color: '#4a3018',
  fontSize: 12,
  lineHeight: 1.55,
  boxShadow: '0 12px 26px rgba(0, 0, 0, 0.24)',
  border: '1px solid rgba(188, 154, 98, 0.28)',
  marginBottom: 4,
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

const effectChipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '5px 10px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.16)',
  background: 'rgba(45, 34, 23, 0.74)',
  color: '#ead7b2',
  fontSize: 12,
  lineHeight: 1.5,
}

const executionOverlayStyle = {
  position: 'fixed',
  inset: 0,
  padding: 28,
  background: 'rgba(7, 6, 5, 0.68)',
  backdropFilter: 'blur(8px)',
  zIndex: 70,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const executionModalStyle = {
  width: 'min(1380px, 100%)',
  height: 'calc(100vh - 56px)',
  borderRadius: 28,
  overflow: 'hidden',
  border: '1px solid rgba(212, 184, 126, 0.18)',
  background: 'linear-gradient(180deg, rgba(39, 28, 18, 0.98), rgba(18, 13, 10, 0.98))',
  boxShadow: '0 36px 82px rgba(0, 0, 0, 0.34)',
  display: 'grid',
  gridTemplateRows: '1fr',
}

const executionStageStyle = {
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  minHeight: 0,
  overflow: 'hidden',
}

const executionToolbarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  padding: '22px 24px 18px',
  background: 'linear-gradient(180deg, rgba(250, 244, 231, 0.98), rgba(227, 212, 186, 0.95))',
}

const executionBodyStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(520px, 1.2fr) minmax(340px, 0.86fr)',
  gap: 18,
  padding: 18,
  minHeight: 0,
  overflow: 'hidden',
}

const executionCanvasStyle = {
  position: 'relative',
  borderRadius: 24,
  overflow: 'hidden',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  border: '1px solid rgba(212, 184, 126, 0.16)',
}

const executionDialoguePanelStyle = {
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr) auto',
  gap: 14,
  minHeight: 0,
  padding: '12px 8px 8px 0',
}

const executionDialogueBoxStyle = {
  minHeight: 0,
  borderRadius: 24,
  background: 'rgba(23, 18, 13, 0.96)',
  border: '1px solid rgba(212, 184, 126, 0.14)',
  padding: '22px 20px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const executionFooterStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
}

const executionSlotCardStyle = {
  minWidth: 112,
  padding: '10px 10px 12px',
  borderRadius: 22,
  background: 'rgba(14, 12, 10, 0.82)',
  border: '1px solid rgba(212, 184, 126, 0.16)',
  boxShadow: '0 14px 30px rgba(0, 0, 0, 0.26)',
  display: 'grid',
  justifyItems: 'center',
  gap: 8,
}

const executionSlotLabelStyle = {
  padding: '3px 8px',
  borderRadius: 999,
  background: 'rgba(241, 230, 203, 0.12)',
  color: '#f0dec1',
  fontSize: 11,
  letterSpacing: '0.12em',
}

const executionSlotNameStyle = {
  maxWidth: 112,
  fontSize: 12,
  lineHeight: 1.35,
  color: '#fff1d6',
  fontWeight: 700,
  textAlign: 'center',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const executionEmptySlotStyle = {
  width: 96,
  height: 132,
  borderRadius: 18,
  border: '1px dashed rgba(228, 208, 170, 0.28)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#dcc8a3',
  fontSize: 14,
}

const executionStepTitleStyle = {
  marginTop: 8,
  fontSize: 24,
  lineHeight: 1.3,
  color: '#f8ebd1',
  fontWeight: 800,
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  overflow: 'hidden',
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

const readerFilterInputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 14,
  border: '1px solid rgba(212, 184, 126, 0.14)',
  background: 'rgba(212, 184, 126, 0.05)',
  color: '#f1e8d5',
  outline: 'none',
  fontSize: 13,
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

// 执行弹窗关闭按钮：深色背景上需要更高对比度
const executionCloseButtonStyle = {
  padding: '10px 16px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.5)',
  backgroundColor: 'rgba(212, 184, 126, 0.18)',
  color: '#ffe8a0',
  cursor: 'pointer',
  fontWeight: 600,
  flexShrink: 0,
}

// 执行弹窗条件标签
const executionCondTagStyle = {
  display: 'inline-block',
  padding: '3px 8px',
  borderRadius: 999,
  background: 'rgba(212, 184, 126, 0.12)',
  border: '1px solid rgba(212, 184, 126, 0.2)',
  color: '#dcc8a3',
  fontSize: 12,
}

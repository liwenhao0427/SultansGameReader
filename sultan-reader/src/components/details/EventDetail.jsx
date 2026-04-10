import { useState } from 'react'
import { useResolvedImage } from '../../services/imageResolver'
import { parseConditionObject } from '../../services/conditionParser'
import { getCardRarityFrameAsset } from '../../resourceConfig'
import useConfigStore from '../../stores/useConfigStore'

// 主角固定卡牌 id
const PROTAGONIST_CARD_ID = '2000001'

/** 背景板：note_bg_new 镜像拼合 */
function NoteBg({ children }) {
  const { url } = useResolvedImage('note_bg_new')
  if (!url) return <div style={noteFallbackStyle}>{children}</div>
  return (
    <div style={noteShellStyle}>
      <div style={{ ...noteHalfStyle, backgroundImage: `url("${url}")` }} />
      <div style={{ ...noteHalfStyle, backgroundImage: `url("${url}")`, transform: 'scaleX(-1)' }} />
      <div style={noteContentStyle}>{children}</div>
    </div>
  )
}

/** 卡牌立绘（带稀有度背景框） */
function CardPortrait({ pic, rare, size = 80 }) {
  const { url } = useResolvedImage(pic || null)
  const { url: frameUrl } = useResolvedImage(rare ? getCardRarityFrameAsset(rare) : null)
  return (
    <div style={{
      width: size,
      height: Math.round(size * 1.42),
      borderRadius: 12,
      overflow: 'hidden',
      flexShrink: 0,
      position: 'relative',
      backgroundImage: frameUrl ? `url("${frameUrl}")` : 'none',
      backgroundSize: '100% 100%',
      background: frameUrl ? undefined : 'rgba(18,15,11,0.8)',
    }}>
      {url && (
        <img src={url} alt="" style={{
          position: 'absolute',
          inset: `${Math.round(size * 0.05)}px ${Math.round(size * 0.07)}px ${Math.round(size * 0.18)}px`,
          objectFit: 'cover',
          width: `calc(100% - ${Math.round(size * 0.14)}px)`,
          height: `calc(100% - ${Math.round(size * 0.23)}px)`,
        }} />
      )}
    </div>
  )
}

/** 主角立绘（右下角固定） */
function ProtagonistPortrait() {
  const cardsById = useConfigStore((s) => s.cardsById)
  const card = cardsById?.[PROTAGONIST_CARD_ID]
  const pic = Array.isArray(card?.resource) ? card.resource[0] : card?.resource
  const { url } = useResolvedImage(pic || null)
  if (!url) return null
  return (
    <img src={url} alt="" style={{
      position: 'absolute',
      right: -10,
      bottom: -10,
      height: '85%',
      objectFit: 'contain',
      pointerEvents: 'none',
      opacity: 0.92,
      filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.6))',
    }} />
  )
}

/** 解析 action 中的交互内容 */
function parseInteraction(action) {
  if (!action) return null
  if (action.option) {
    const opt = action.option
    const cases = {}
    for (const [k, v] of Object.entries(action)) {
      if (k.startsWith('case:')) cases[k.slice(5)] = v
    }
    return { type: 'option', text: opt.text, icon: opt.icon, items: opt.items || [], cases }
  }
  if (action.prompt) {
    return { type: 'prompt', text: action.prompt.text, icon: action.prompt.icon }
  }
  if (action.confirm) {
    const c = action.confirm
    return { type: 'confirm', text: c.text, icon: Array.isArray(c.icon) ? c.icon.find(Boolean) : c.icon }
  }
  return null
}

function summarizeActionResults(action = {}) {
  const rows = []

  for (const [key, value] of Object.entries(action)) {
    if (key.endsWith('__c') || key.endsWith('__ca') || key.endsWith('__ci')) continue
    if (key === 'prompt' || key === 'option' || key === 'confirm' || key.startsWith('case:')) continue
    if (key === 'success' || key === 'failed') {
      for (const [branchKey, branchValue] of Object.entries(value || {})) {
        if (branchKey.endsWith('__c') || branchKey.endsWith('__ca') || branchKey.endsWith('__ci')) continue
        const items = Array.isArray(branchValue) ? branchValue : [branchValue]
        items.filter(Boolean).forEach((item) => {
          rows.push(`${key} -> ${branchKey}: ${item}`)
        })
      }
      continue
    }

    if (value == null || typeof value === 'object') continue
    rows.push(`${key}: ${value}`)
  }

  return rows
}

/** 单个 settlement 的视觉小说展示 */
function SettlementCard({ item, cardsById }) {
  const action = item.action || {}
  const interaction = parseInteraction(action)
  const [selectedOption, setSelectedOption] = useState(null)

  let displayText = item.tips_text || item.result_text || ''
  let displayIcon = null
  if (interaction) {
    displayText = interaction.text || displayText
    displayIcon = interaction.icon || null
  }

  let casePrompt = null
  if (selectedOption && interaction?.cases?.[selectedOption]) {
    casePrompt = interaction.cases[selectedOption].prompt || null
  }
  const resultLines = summarizeActionResults(
    selectedOption && interaction?.cases?.[selectedOption]
      ? interaction.cases[selectedOption]
      : action
  )

  const iconCardId = displayIcon ? displayIcon.replace('cards/', '') : null
  const iconCard = iconCardId ? cardsById?.[iconCardId] : null
  const iconPic = iconCard
    ? (Array.isArray(iconCard.resource) ? iconCard.resource[0] : iconCard.resource)
    : displayIcon

  const caseIconCardId = casePrompt?.icon ? casePrompt.icon.replace('cards/', '') : null
  const caseIconCard = caseIconCardId ? cardsById?.[caseIconCardId] : null
  const caseIconPic = caseIconCard
    ? (Array.isArray(caseIconCard.resource) ? caseIconCard.resource[0] : caseIconCard.resource)
    : casePrompt?.icon

  if (!displayText && !displayIcon && !interaction) return null

  return (
    <NoteBg>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', minHeight: 100 }}>
        {iconPic && <CardPortrait pic={iconPic} rare={iconCard?.rare} size={72} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          {displayText && <div style={noteTextStyle}>{displayText}</div>}
          {interaction?.type === 'option' && interaction.items?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              {interaction.items.map((opt) => (
                <button
                  key={opt.tag}
                  type="button"
                  onClick={() => setSelectedOption(selectedOption === opt.tag ? null : opt.tag)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 20px',
                    marginBottom: 8,
                    borderRadius: 6,
                    border: selectedOption === opt.tag
                      ? '1px solid rgba(212,184,126,0.6)'
                      : '1px solid rgba(212,184,126,0.2)',
                    background: selectedOption === opt.tag
                      ? 'rgba(212,184,126,0.18)'
                      : 'rgba(212,184,126,0.06)',
                    color: '#f1e8d5',
                    fontSize: 15,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  {opt.text}
                </button>
              ))}
            </div>
          )}
          {casePrompt && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(212,184,126,0.08)', border: '1px solid rgba(212,184,126,0.16)' }}>
              {caseIconPic && <div style={{ marginBottom: 8 }}><CardPortrait pic={caseIconPic} rare={caseIconCard?.rare} size={56} /></div>}
              <div style={{ ...noteTextStyle, fontSize: 14 }}>{casePrompt.text}</div>
            </div>
          )}
          {resultLines.length > 0 && (
            <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
              <div style={resultTitleStyle}>触发结果</div>
              {resultLines.map((line) => (
                <div key={line} style={resultLineStyle}>{line}</div>
              ))}
            </div>
          )}
        </div>
      </div>
      <ProtagonistPortrait />
    </NoteBg>
  )
}

export default function EventDetail({ data }) {
  const cardsById = useConfigStore((s) => s.cardsById)
  if (!data) return null

  const conditions = parseConditionObject(data.condition)
  const settlements = Array.isArray(data.settlement) ? data.settlement : []
  const meaningful = settlements.filter((s) => {
    const a = s.action || {}
    return s.tips_text || s.result_text || a.prompt || a.option || a.confirm
  })

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ color: '#fff0d3', fontSize: 20, fontWeight: 700 }}>
        {data.text || `事件 ${data.id}`}
      </div>
      {conditions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {conditions.map((c, i) => (
            <span key={i} style={condTagStyle}>{c}</span>
          ))}
        </div>
      )}
      {meaningful.length === 0 && (
        <div style={{ color: 'rgba(241,232,213,0.5)', fontSize: 13 }}>
          此事件仅作为触发器，无正文内容。
        </div>
      )}
      {meaningful.map((item, i) => (
        <SettlementCard key={i} item={item} cardsById={cardsById} />
      ))}
    </div>
  )
}

const noteShellStyle = {
  position: 'relative',
  display: 'flex',
  borderRadius: 8,
  overflow: 'hidden',
  minHeight: 140,
}

const noteHalfStyle = {
  flex: 1,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
}

const noteFallbackStyle = {
  position: 'relative',
  borderRadius: 8,
  background: 'rgba(18,14,10,0.96)',
  border: '1px solid rgba(212,184,126,0.18)',
  padding: '18px 20px',
  minHeight: 140,
}

const noteContentStyle = {
  position: 'absolute',
  inset: 0,
  padding: '18px 20px 18px 18px',
  background: 'rgba(8,6,4,0.72)',
  overflow: 'hidden',
}

const noteTextStyle = {
  color: '#f1e8d5',
  fontSize: 15,
  lineHeight: 1.9,
  whiteSpace: 'pre-wrap',
}

const condTagStyle = {
  padding: '3px 8px',
  borderRadius: 999,
  background: 'rgba(212,184,126,0.1)',
  border: '1px solid rgba(212,184,126,0.18)',
  color: '#dcc8a3',
  fontSize: 12,
}

const resultTitleStyle = {
  color: '#e7c88d',
  fontSize: 12,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
}

const resultLineStyle = {
  color: '#d9c4a0',
  fontSize: 12,
  lineHeight: 1.7,
}

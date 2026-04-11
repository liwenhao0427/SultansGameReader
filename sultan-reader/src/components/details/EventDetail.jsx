import { useEffect, useMemo, useRef, useState } from 'react'
import { useResolvedImage } from '../../services/imageResolver'
import { adaptStoryData } from '../../services/storyAdapter'
import useConfigStore from '../../stores/useConfigStore'
import useCanvasStore from '../../stores/useCanvasStore'
import { linkNodesOnCanvas, mountNodeOnCanvas } from '../../services/graphNavigation'

function normalizeTextContent(text) {
  if (text == null) return ''
  if (typeof text === 'string') return text
  if (Array.isArray(text)) return text.map((item) => normalizeTextContent(item)).filter(Boolean).join('\n\n')
  if (typeof text === 'object') {
    if (typeof text.text === 'string') return text.text
    if (typeof text.result_text === 'string') return text.result_text
    if (typeof text.tips_text === 'string') return text.tips_text
  }
  return String(text)
}

function NoteBg({ children }) {
  const { url } = useResolvedImage('note_bg_new')

  return (
    <div style={noteShellStyle}>
      <div style={{ ...noteHalfStyle, backgroundImage: url ? `url("${url}")` : noteFallbackStyle.backgroundImage }} />
      <div style={{ ...noteHalfStyle, backgroundImage: url ? `url("${url}")` : noteFallbackStyle.backgroundImage, transform: 'scaleX(-1)' }} />
      <div style={noteContentStyle}>
        {children}
      </div>
    </div>
  )
}

function EventChoiceButton({ option, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        ...choiceButtonStyle,
        ...(active ? choiceButtonActiveStyle : null),
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
    <div style={figureWrapStyle}>
      {loading && <div style={figureFallbackStyle}>载入中…</div>}
      {!loading && url && <img src={url} alt={card.name || ''} style={figureImageStyle} />}
      {!loading && !url && <div style={figureFallbackStyle}>{card.name || '角色'}</div>}
    </div>
  )
}

export default function EventDetail({ data }) {
  const cardsLite = useConfigStore((s) => s.cardsLite)
  const cardsById = useConfigStore((s) => s.cardsById)
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const model = useMemo(() => adaptStoryData('event', data, cardsLite, cardsById), [cardsLite, cardsById, data])
  const [choicePath, setChoicePath] = useState([])
  const autoMountedEventIdRef = useRef(null)

  useEffect(() => {
    setChoicePath([])
    autoMountedEventIdRef.current = null
  }, [data?.id])

  const eventNodeHistory = useMemo(() => {
    if (!model?.eventFlow) return []

    const history = []
    let currentNode = model.eventFlow
    history.push(currentNode)

    for (const choiceTag of choicePath) {
      const nextChoice = currentNode?.choices?.find((choice) => choice.tag === choiceTag)
      if (!nextChoice?.branch) break
      currentNode = nextChoice.branch
      history.push(currentNode)
    }

    return history
  }, [choicePath, model?.eventFlow])

  const currentEventNode = eventNodeHistory[eventNodeHistory.length - 1] || model?.eventFlow || null

  const narrativeBlocks = useMemo(() => (
    eventNodeHistory.flatMap((node) => {
      const promptBlocks = (node?.promptEntries || []).map((entry) => normalizeTextContent(entry.text)).filter(Boolean)
      const optionBlock = normalizeTextContent(node?.option?.text)
      return optionBlock ? [...promptBlocks, optionBlock] : promptBlocks
    })
  ), [eventNodeHistory])

  const visualCard = useMemo(() => {
    const candidates = [
      ...(currentEventNode?.relatedCards || []),
      ...(model?.eventFlow?.relatedCards || []),
      model?.fallbackCharacterCard || null,
    ].filter(Boolean)
    return candidates[0] || null
  }, [currentEventNode?.relatedCards, model?.eventFlow?.relatedCards, model?.fallbackCharacterCard])

  const followupActions = useMemo(() => (
    (currentEventNode?.actions || []).filter((action) => action.targetType === 'rite' || action.targetType === 'over' || action.targetType === 'event')
  ), [currentEventNode?.actions])

  const followupRites = useMemo(() => (
    followupActions.filter((action) => action.targetType === 'rite')
  ), [followupActions])

  useEffect(() => {
    if (!data?.id || followupRites.length === 0) return
    if (autoMountedEventIdRef.current === data.id) return

    autoMountedEventIdRef.current = data.id
    followupRites.forEach((action, index) => {
      void mountNodeOnCanvas(
        { id: action.targetId, type: action.targetType, name: action.text },
        { x: 460 + index * 60, y: 180 + index * 50 },
        { autoSelect: false, expandRelations: false }
      ).then((targetNodeKey) => {
        if (!targetNodeKey || !selectedNodeId) return
        linkNodesOnCanvas(selectedNodeId, action.targetType, action.targetId, action.branch === 'success' ? 'success' : action.branch === 'failed' ? 'failed' : 'default', action.text)
      })
    })
  }, [data?.id, followupRites, selectedNodeId])

  function handleSelectChoice(choiceTag, depth) {
    setChoicePath((current) => {
      const prefix = current.slice(0, depth)
      if (current[depth] === choiceTag) return prefix
      return [...prefix, choiceTag]
    })
  }

  async function handleOpenAction(action, offsetIndex = 0) {
    if (!action?.targetType || !action?.targetId) return

    const targetNodeKey = await mountNodeOnCanvas(
      { id: action.targetId, type: action.targetType, name: action.text },
      { x: 460 + offsetIndex * 60, y: 180 + offsetIndex * 50 },
      { autoSelect: true, expandRelations: false }
    )

    if (targetNodeKey && selectedNodeId) {
      linkNodesOnCanvas(selectedNodeId, action.targetType, action.targetId, action.branch === 'success' ? 'success' : action.branch === 'failed' ? 'failed' : 'default', action.text)
    }
  }

  if (!model) return null

  const hasNarrative = narrativeBlocks.length > 0

  return (
    <div style={wrapStyle}>
      <div style={titleStyle}>{model.title}</div>

      {model.meta.length > 0 && (
        <div style={metaWrapStyle}>
          {model.meta.map((item) => (
            <span key={item} style={metaChipStyle}>{item}</span>
          ))}
        </div>
      )}

      {hasNarrative ? (
        <NoteBg>
          <div style={readerGridStyle}>
            <div style={readerTextStageStyle}>
              <div style={readerScrollStyle}>
                {narrativeBlocks.map((text, index) => (
                  <div key={`${index}:${text.slice(0, 24)}`} style={paragraphStyle}>{text}</div>
                ))}

                {currentEventNode?.effects?.length > 0 && (
                  <div style={sectionBlockStyle}>
                    <div style={sectionTitleStyle}>触发结果</div>
                    <div style={effectWrapStyle}>
                      {currentEventNode.effects.map((effect, index) => (
                        <span key={`${effect.type}-${index}`} style={effectChipStyle}>{effect.label}</span>
                      ))}
                    </div>
                  </div>
                )}

                {followupActions.length > 0 && (
                  <div style={sectionBlockStyle}>
                    <div style={sectionTitleStyle}>后续节点</div>
                    <div style={actionWrapStyle}>
                      {followupActions.map((action, index) => (
                        <button key={`${action.targetType}:${action.targetId}:${index}`} type="button" style={actionButtonStyle} onClick={() => handleOpenAction(action, index)}>
                          打开{action.targetType === 'rite' ? '仪式' : action.targetType === 'event' ? '幕后' : '结局'} {action.targetId}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {eventNodeHistory.map((node, depth) => {
                const activeChoices = node.choices || []
                if (activeChoices.length === 0) return null
                const selectedChoice = choicePath[depth] || null

                return (
                  <div key={`${node.id}:choices`} style={choiceWrapStyle}>
                    {activeChoices.map((choice) => (
                      <EventChoiceButton
                        key={choice.id}
                        option={choice}
                        active={selectedChoice === choice.tag}
                        onSelect={() => handleSelectChoice(choice.tag, depth)}
                      />
                    ))}
                  </div>
                )
              })}
            </div>

            <div style={figureStageStyle}>
              <EventSideFigure card={visualCard} />
            </div>
          </div>
        </NoteBg>
      ) : (
        <div style={triggerWrapStyle}>
          <div style={triggerTextStyle}>此事件仅作为触发器，无正文内容。</div>
          {currentEventNode?.effects?.length > 0 && (
            <div style={sectionBlockStyle}>
              <div style={sectionTitleStyle}>触发结果</div>
              <div style={effectWrapStyle}>
                {currentEventNode.effects.map((effect, index) => (
                  <span key={`${effect.type}-${index}`} style={effectChipStyle}>{effect.label}</span>
                ))}
              </div>
            </div>
          )}
          {followupActions.length > 0 && (
            <div style={sectionBlockStyle}>
              <div style={sectionTitleStyle}>后续节点</div>
              <div style={smallTextStyle}>点击事件时已自动将对应仪式加入画布。</div>
              <div style={actionWrapStyle}>
                {followupActions.map((action, index) => (
                  <button key={`${action.targetType}:${action.targetId}:${index}`} type="button" style={actionButtonStyle} onClick={() => handleOpenAction(action, index)}>
                    打开{action.targetType === 'rite' ? '仪式' : action.targetType === 'event' ? '幕后' : '结局'} {action.targetId}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {model.segments.length > 0 && (
        <div style={segmentListStyle}>
          {model.segments.map((segment, index) => {
            const blockText = [segment.title, segment.text].filter(Boolean).join('\n')
            const hasSameText = blockText && narrativeBlocks.some((item) => item.includes(blockText) || blockText.includes(item))
            if (hasSameText && (!segment.effects || segment.effects.length === 0) && (!segment.actions || segment.actions.length === 0)) {
              return null
            }

            return (
              <div key={`${segment.phase}-${index}`} style={segmentCardStyle}>
                <div style={sectionTitleStyle}>{segment.phase}</div>
                {segment.title && <div style={segmentTitleStyle}>{segment.title}</div>}
                {segment.conditions?.length > 0 && (
                  <div style={metaWrapStyle}>
                    {segment.conditions.map((item) => (
                      <span key={item} style={metaChipStyle}>{item}</span>
                    ))}
                  </div>
                )}
                {segment.text && <div style={segmentTextStyle}>{segment.text}</div>}
                {segment.effects?.length > 0 && (
                  <div style={effectWrapStyle}>
                    {segment.effects.map((effect, effectIndex) => (
                      <span key={`${effect.type}-${effectIndex}`} style={effectChipStyle}>{effect.label}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const wrapStyle = {
  display: 'grid',
  gap: 14,
}

const titleStyle = {
  color: '#fff0d3',
  fontSize: 20,
  fontWeight: 700,
}

const metaWrapStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

const metaChipStyle = {
  padding: '4px 10px',
  borderRadius: 999,
  border: '1px solid rgba(92, 62, 31, 0.12)',
  backgroundColor: 'rgba(126, 93, 53, 0.12)',
  color: '#dcc9a6',
  fontSize: 11,
  lineHeight: 1.4,
}

const noteFallbackStyle = {
  backgroundImage: 'linear-gradient(180deg, rgba(51, 39, 25, 0.92), rgba(17, 13, 10, 0.98))',
}

const noteShellStyle = {
  position: 'relative',
  display: 'flex',
  minHeight: 360,
  borderRadius: 16,
  overflow: 'hidden',
}

const noteHalfStyle = {
  flex: 1,
  backgroundSize: '100% 100%',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
}

const noteContentStyle = {
  position: 'absolute',
  inset: 0,
  padding: '16px 16px 18px',
  background: 'rgba(8, 6, 4, 0.62)',
}

const readerGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 160px',
  gap: 12,
  minHeight: 326,
}

const readerTextStageStyle = {
  minHeight: 0,
  display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr) auto',
  gap: 12,
}

const readerScrollStyle = {
  minHeight: 0,
  overflowY: 'auto',
  padding: '10px 10px 6px 8px',
  display: 'grid',
  alignContent: 'start',
  gap: 14,
}

const paragraphStyle = {
  color: '#f4ead6',
  fontSize: 15,
  lineHeight: 1.95,
  whiteSpace: 'pre-wrap',
  textShadow: '0 1px 6px rgba(0, 0, 0, 0.24)',
}

const choiceWrapStyle = {
  display: 'grid',
  gap: 8,
}

const choiceButtonStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid rgba(212, 184, 126, 0.2)',
  background: 'linear-gradient(180deg, rgba(52, 44, 30, 0.86), rgba(23, 18, 13, 0.94))',
  color: '#efe2c7',
  fontSize: 14,
  lineHeight: 1.6,
  textAlign: 'center',
  cursor: 'pointer',
}

const choiceButtonActiveStyle = {
  border: '1px solid rgba(239, 215, 169, 0.52)',
  background: 'linear-gradient(180deg, rgba(95, 73, 43, 0.96), rgba(42, 31, 19, 0.96))',
}

const figureStageStyle = {
  minHeight: 0,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'flex-end',
  overflow: 'hidden',
}

const figureWrapStyle = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'flex-end',
}

const figureImageStyle = {
  maxWidth: '170%',
  maxHeight: '96%',
  objectFit: 'contain',
  objectPosition: 'right bottom',
  filter: 'drop-shadow(0 16px 26px rgba(0, 0, 0, 0.34))',
}

const figureFallbackStyle = {
  color: '#cdb28a',
  fontSize: 14,
}

const sectionBlockStyle = {
  display: 'grid',
  gap: 8,
}

const sectionTitleStyle = {
  fontSize: 12,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: '#d4b87e',
}

const effectWrapStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
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

const actionWrapStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

const actionButtonStyle = {
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.18)',
  background: 'rgba(212, 184, 126, 0.08)',
  color: '#f1e8d5',
  cursor: 'pointer',
}

const triggerWrapStyle = {
  display: 'grid',
  gap: 14,
  padding: '14px 0 4px',
}

const triggerTextStyle = {
  color: 'rgba(241,232,213,0.68)',
  fontSize: 14,
  lineHeight: 1.8,
}

const smallTextStyle = {
  color: 'rgba(241,232,213,0.68)',
  fontSize: 12,
  lineHeight: 1.7,
}

const segmentListStyle = {
  display: 'grid',
  gap: 12,
}

const segmentCardStyle = {
  padding: '14px 16px',
  borderRadius: 18,
  background: 'rgba(20, 16, 12, 0.92)',
  border: '1px solid rgba(212, 184, 126, 0.12)',
  display: 'grid',
  gap: 10,
}

const segmentTitleStyle = {
  fontSize: 16,
  fontWeight: 700,
  color: '#fff0d3',
}

const segmentTextStyle = {
  color: '#f1e8d5',
  fontSize: 14,
  lineHeight: 1.8,
  whiteSpace: 'pre-wrap',
}

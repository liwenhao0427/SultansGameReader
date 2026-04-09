import { useEffect, useMemo, useState } from 'react'
import useConfigStore from '../../stores/useConfigStore'
import { useResolvedImage } from '../../services/imageResolver'
import { adaptStoryData } from '../../services/storyAdapter'
import { READER_CHROME } from '../../readerChromeConfig'
import { linkNodesOnCanvas, mountNodeOnCanvas } from '../../services/graphNavigation'

function useChromeAsset(assetKey) {
  return useResolvedImage(READER_CHROME.assets[assetKey]?.asset)
}

function splitIntro(text) {
  if (!text) return []

  return text
    .split(/(?<=[。！？\n])/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
}

function CardPortrait({ card, compact = false }) {
  const { url } = useResolvedImage(card?.image)

  return (
    <div style={{
      width: compact ? 72 : 94,
      height: compact ? 108 : 142,
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid rgba(233, 219, 183, 0.22)',
      boxShadow: '0 14px 26px rgba(0, 0, 0, 0.26)',
      backgroundColor: 'rgba(18, 15, 11, 0.92)',
      position: 'relative',
      flexShrink: 0,
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
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: compact ? '6px 6px 7px' : '8px 8px 9px',
        backgroundImage: 'linear-gradient(180deg, transparent, rgba(4, 3, 2, 0.92))',
        color: '#fff7e6',
        fontSize: compact ? 10 : 11,
        lineHeight: 1.4,
      }}>
        {card?.name}
      </div>
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

function SlotButton({ slot, active, candidateLabel, onClick, slotBgUrl }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: READER_CHROME.assets.slotFrame.width + 26,
        minHeight: READER_CHROME.assets.slotFrame.minHeight + 22,
        padding: 10,
        borderRadius: 26,
        border: active
          ? '1px solid rgba(239, 215, 169, 0.54)'
          : '1px solid rgba(219, 207, 181, 0.18)',
        backgroundColor: active ? 'rgba(225, 192, 130, 0.16)' : 'rgba(31, 24, 18, 0.88)',
        boxShadow: active
          ? '0 0 0 3px rgba(212, 184, 126, 0.14), 0 18px 30px rgba(0,0,0,0.22)'
          : '0 14px 24px rgba(0,0,0,0.2)',
        cursor: 'pointer',
        display: 'grid',
        gap: 8,
        justifyItems: 'center',
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff1d4',
        fontWeight: 800,
        fontSize: 16,
      }}>
        {slot.title}
      </div>
      <div style={{
        fontSize: 11,
        color: '#dcc7a1',
        lineHeight: 1.5,
        textAlign: 'center',
      }}>
        {candidateLabel || '点击选择'}
      </div>
    </button>
  )
}

function CandidateHandItem({ candidate, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        minWidth: 184,
        maxWidth: 270,
        padding: 14,
        borderRadius: 24,
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
      {candidate.cards.length > 0 ? (
        candidate.cards.length === 1 ? (
          <CardPortrait card={candidate.cards[0]} />
        ) : (
          <CardStack cards={candidate.cards} />
        )
      ) : (
        <div style={{
          minHeight: 142,
          borderRadius: 18,
          border: '1px dashed rgba(212, 184, 126, 0.18)',
          backgroundColor: 'rgba(30, 24, 18, 0.92)',
          color: '#f6e6c4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          textAlign: 'center',
          lineHeight: 1.7,
        }}>
          {candidate.label}
        </div>
      )}

      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5 }}>
        {candidate.label}
      </div>
      {candidate.conditionText && (
        <div style={smallLineStyle}>条件：{candidate.conditionText}</div>
      )}
      {candidate.primaryText && (
        <div style={smallLineStyle}>执行后台词：{candidate.primaryText}</div>
      )}
    </button>
  )
}

export default function StoryInspector({ type, data, onClose }) {
  const cardsLite = useConfigStore((s) => s.cardsLite)
  const cardsById = useConfigStore((s) => s.cardsById)
  const model = adaptStoryData(type, data, cardsLite, cardsById)
  const { url: noteBg } = useChromeAsset('noteBackground')
  const { url: titleEmblem } = useChromeAsset('titleEmblem')
  const { url: slotBg } = useChromeAsset('slotFrame')
  const { url: textFrame } = useChromeAsset('dialogueFrame')

  const [activeSlotId, setActiveSlotId] = useState(null)
  const [slotSelections, setSlotSelections] = useState({})
  const [revealedLineCount, setRevealedLineCount] = useState(1)
  const [revealedSegmentCount, setRevealedSegmentCount] = useState(0)

  function buildDialogueLines(slotId, selections) {
    const slot = model?.slots?.find((entry) => entry.id === slotId) || null
    const candidate = slot?.candidates?.find((entry) => entry.id === selections?.[slotId]) || slot?.candidates?.[0] || null
    return splitIntro(model?.intro).concat((candidate?.choiceTexts || []).map((entry) => entry.text))
  }

  useEffect(() => {
    if (!model) return

    const defaults = Object.fromEntries(
      (model.slots || []).map((slot) => [slot.id, slot.candidates?.[0]?.id || null])
    )
    const firstSlotId = model.slots?.[0]?.id || null
    const firstCandidate = model.slots?.[0]?.candidates?.[0] || null
    const initialLines = splitIntro(model.intro).concat((firstCandidate?.choiceTexts || []).map((entry) => entry.text))

    setSlotSelections(defaults)
    setActiveSlotId(firstSlotId)
    setRevealedLineCount(initialLines.length > 0 ? 1 : 0)
    setRevealedSegmentCount(0)
  }, [type, data?.id, data?._source_path])

  const selectedSlot = useMemo(
    () => model?.slots?.find((slot) => slot.id === activeSlotId) || null,
    [model?.slots, activeSlotId]
  )

  const selectedCandidate = useMemo(() => {
    if (!selectedSlot) return null
    return selectedSlot.candidates?.find((candidate) => candidate.id === slotSelections[selectedSlot.id]) || selectedSlot.candidates?.[0] || null
  }, [selectedSlot, slotSelections])

  const dialogueLines = useMemo(() => {
    const introLines = splitIntro(model?.intro)
    const candidateLines = (selectedCandidate?.choiceTexts || []).map((entry) => entry.text)
    return [...introLines, ...candidateLines].filter(Boolean)
  }, [model?.intro, selectedCandidate])

  const visibleLines = dialogueLines.slice(0, revealedLineCount)
  const visibleSegments = (model?.segments || []).slice(0, revealedSegmentCount)
  const currentGateSegment = visibleSegments.find((segment) => segment.options?.length > 0)
  const canRevealLine = revealedLineCount < dialogueLines.length
  const canRevealSegment = !canRevealLine && !currentGateSegment && revealedSegmentCount < (model?.segments?.length || 0)
  const isFullscreenReader = type === 'rite' || type === 'event'

  if (!model) return null

  async function handleOpenAction(action, offsetIndex = 0) {
    if (!action?.targetType || !action?.targetId) return

    const targetNodeKey = await mountNodeOnCanvas(
      {
        id: action.targetId,
        type: action.targetType,
        name: action.text,
      },
      { x: 460 + offsetIndex * 60, y: 180 + offsetIndex * 50 },
      { autoSelect: true, expandRelations: true }
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

  function resetFlow(nextSlotId = activeSlotId) {
    const nextLines = buildDialogueLines(nextSlotId, slotSelections)
    setRevealedLineCount(nextLines.length > 0 ? 1 : 0)
    setRevealedSegmentCount(0)
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
    const nextLines = buildDialogueLines(selectedSlot.id, nextSelections)
    setRevealedLineCount(nextLines.length > 0 ? 1 : 0)
    setRevealedSegmentCount(0)
  }

  function handleManualReset() {
    const defaults = Object.fromEntries(
      (model.slots || []).map((slot) => [slot.id, slot.candidates?.[0]?.id || null])
    )
    setSlotSelections(defaults)
    setActiveSlotId(model.slots?.[0]?.id || null)

    const firstCandidate = model.slots?.[0]?.candidates?.[0] || null
    const nextLines = splitIntro(model.intro).concat((firstCandidate?.choiceTexts || []).map((entry) => entry.text))
    setRevealedLineCount(nextLines.length > 0 ? 1 : 0)
    setRevealedSegmentCount(0)
  }

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
        gridTemplateColumns: model.slots.length > 0 ? '220px minmax(280px, 360px) minmax(0, 1fr)' : 'minmax(280px, 360px) minmax(0, 1fr)',
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
              <div style={{ ...smallLineStyle, marginTop: 8 }}>
                点击槽位后，下方会出现这个槽位的候选手牌或条件分支。
              </div>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              overflowY: 'auto',
              paddingRight: 4,
            }}>
              {model.slots.map((slot) => {
                const currentCandidate = slot.candidates?.find((candidate) => candidate.id === slotSelections[slot.id]) || slot.candidates?.[0] || null
                return (
                  <SlotButton
                    key={slot.id}
                    slot={slot}
                    slotBgUrl={slotBg}
                    active={activeSlotId === slot.id}
                    candidateLabel={currentCandidate?.label}
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
          </div>

          {selectedSlot?.candidates?.length > 0 ? (
            <div style={{
              marginTop: 16,
              minHeight: 0,
              display: 'grid',
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
                  条件：{selectedSlot.conditions.join('，')}
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
            gridTemplateRows: 'auto minmax(0, 1fr) auto',
          }}>
            <div style={{
              padding: '22px 24px 18px',
              position: 'relative',
              overflow: 'hidden',
              backgroundImage: noteBg
                ? `${READER_CHROME.header.panelOverlay}, url("${noteBg}")`
                : READER_CHROME.header.panelOverlay,
              backgroundRepeat: 'no-repeat',
              backgroundSize: READER_CHROME.assets.noteBackground.backgroundSize,
              backgroundPosition: READER_CHROME.assets.noteBackground.backgroundPosition,
              color: READER_CHROME.header.metaColor,
            }}>
              {titleEmblem && (
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: READER_CHROME.assets.titleEmblem.top,
                    right: READER_CHROME.assets.titleEmblem.right,
                    width: READER_CHROME.assets.titleEmblem.width,
                    height: READER_CHROME.assets.titleEmblem.height,
                    opacity: READER_CHROME.assets.titleEmblem.opacity,
                    pointerEvents: 'none',
                    backgroundImage: `url("${titleEmblem}")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: READER_CHROME.assets.titleEmblem.backgroundSize,
                    backgroundPosition: READER_CHROME.assets.titleEmblem.backgroundPosition,
                  }}
                />
              )}
              <div style={{ fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', color: READER_CHROME.header.subtitleColor }}>
                {model.subtitle || model.kind}
              </div>
              <div style={{
                marginTop: 10,
                display: 'flex',
                alignItems: 'center',
              }}>
                <div style={{
                  fontSize: 40,
                  fontWeight: 900,
                  lineHeight: 1.08,
                  color: READER_CHROME.header.titleColor,
                  textShadow: READER_CHROME.header.titleShadow,
                }}>
                  {model.title}
                </div>
              </div>
              {model.meta.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginTop: 14,
                }}>
                  {model.meta.slice(0, 6).map((item) => (
                    <span key={item} style={metaChipStyle}>
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{
              minHeight: 0,
              overflowY: 'auto',
              padding: '24px 24px 16px',
              display: 'grid',
              gap: 18,
            }}>
              {selectedSlot && (
                <div style={slotHintCardStyle}>
                  <div style={sectionTitleStyle}>当前卡槽</div>
                  <div style={{ marginTop: 10, fontSize: 16, fontWeight: 700, color: '#f6ead1' }}>
                    {selectedSlot.title}
                  </div>
                  <div style={{ ...smallLineStyle, marginTop: 8 }}>{selectedSlot.text}</div>
                  {selectedSlot.conditions.length > 0 && (
                    <div style={{ ...smallLineStyle, marginTop: 8 }}>
                      可放入条件：{selectedSlot.conditions.join('，')}
                    </div>
                  )}
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
                        backgroundColor: 'rgba(16, 13, 10, 0.78)',
                        backgroundImage: textFrame
                          ? `linear-gradient(180deg, rgba(16, 13, 10, 0.18), rgba(16, 13, 10, 0.34)), url("${textFrame}")`
                          : 'none',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: READER_CHROME.assets.dialogueFrame.backgroundSize,
                        backgroundPosition: READER_CHROME.assets.dialogueFrame.backgroundPosition,
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
                  onClick={() => setRevealedLineCount((count) => Math.min(dialogueLines.length, count + 1))}
                >
                  下一句
                </button>
              )}
              {canRevealSegment && (
                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={() => setRevealedSegmentCount((count) => Math.min(model.segments.length, count + 1))}
                >
                  推进后续
                </button>
              )}
              {!canRevealLine && !canRevealSegment && model.segments.length > 0 && (
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
          <div>
            <div style={overlayTitleStyle}>{type === 'rite' ? '仪式阅读模式' : '事件阅读模式'}</div>
            <div style={overlaySubStyle}>关闭后返回节点图模式。</div>
          </div>
          <button type="button" onClick={onClose} style={closeButtonStyle}>关闭</button>
        </div>
        <div style={{ height: '100%', minHeight: 0, overflow: 'hidden', padding: 24 }}>
          {content}
        </div>
      </div>
    </div>
  )
}

const imageFallbackStyle = {
  color: 'rgba(241, 232, 213, 0.58)',
  fontSize: 14,
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

const metaChipStyle = {
  padding: '5px 12px',
  borderRadius: 999,
  border: '1px solid rgba(61, 39, 21, 0.08)',
  backgroundColor: 'rgba(61, 39, 21, 0.14)',
  fontSize: 13,
}

const slotHintCardStyle = {
  padding: '18px 18px 16px',
  borderRadius: 22,
  border: '1px solid rgba(212, 184, 126, 0.12)',
  backgroundColor: 'rgba(27, 21, 16, 0.9)',
}

const segmentCardStyle = {
  padding: '18px 18px 16px',
  borderRadius: 24,
  border: '1px solid rgba(212, 184, 126, 0.12)',
  backgroundImage: 'linear-gradient(180deg, rgba(31, 24, 18, 0.96), rgba(20, 16, 12, 0.96))',
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
  padding: '22px 28px 18px',
  borderBottom: '1px solid rgba(212, 184, 126, 0.12)',
}

const overlayTitleStyle = {
  fontSize: 28,
  fontWeight: 900,
  color: '#f8edd7',
}

const overlaySubStyle = {
  marginTop: 6,
  color: 'rgba(241, 232, 213, 0.68)',
  fontSize: 13,
}

const closeButtonStyle = {
  padding: '10px 16px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.24)',
  backgroundColor: 'rgba(212, 184, 126, 0.08)',
  color: '#f2ead5',
  cursor: 'pointer',
}

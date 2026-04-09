import { useEffect, useMemo, useState } from 'react'
import useConfigStore from '../../stores/useConfigStore'
import { useResolvedImage } from '../../services/imageResolver'
import { adaptStoryData } from '../../services/storyAdapter'
import { READER_CHROME } from '../../config/readerChrome'
import { mountNodeOnCanvas } from '../../services/graphNavigation'

function useChromeAsset(assetKey) {
  return useResolvedImage(READER_CHROME.assets[assetKey]?.asset)
}

function PreviewImage({ pic, maxHeight = 260 }) {
  const { url, loading } = useResolvedImage(pic)

  if (!pic) return null
  if (loading) return <div style={imageFallbackStyle}>载入图片中…</div>
  if (!url) return <div style={imageFallbackStyle}>暂无对应图片</div>

  return (
    <div style={{
      maxHeight,
      minHeight: Math.min(maxHeight, 220),
      borderRadius: 20,
      overflow: 'hidden',
      border: '1px solid rgba(216, 192, 146, 0.2)',
      boxShadow: '0 24px 50px rgba(0, 0, 0, 0.22)',
    }}>
      <img
        src={url}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  )
}

function splitIntro(text) {
  if (!text) return []

  return text
    .split(/(?<=[。！？\n])/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
}

function SlotButton({ slot, active, onClick, slotBgUrl }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: READER_CHROME.assets.slotFrame.width,
        minHeight: READER_CHROME.assets.slotFrame.minHeight,
        borderRadius: 24,
        overflow: 'hidden',
        background: slotBgUrl
          ? `linear-gradient(180deg, rgba(6, 8, 8, 0.16), rgba(6, 8, 8, 0.52)), url("${slotBgUrl}")`
          : 'linear-gradient(180deg, #d9d2c2 0%, #92846d 100%)',
        backgroundSize: READER_CHROME.assets.slotFrame.backgroundSize,
        backgroundPosition: READER_CHROME.assets.slotFrame.backgroundPosition,
        border: active
          ? '2px solid rgba(238, 212, 157, 0.9)'
          : '1px solid rgba(219, 207, 181, 0.24)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        fontWeight: 700,
        color: '#f7ecd3',
        boxShadow: active
          ? '0 0 0 3px rgba(212, 184, 126, 0.2), 0 12px 28px rgba(0,0,0,0.24)'
          : '0 12px 28px rgba(0,0,0,0.24)',
        cursor: 'pointer',
      }}
    >
      {slot.title}
    </button>
  )
}

export default function StoryInspector({ type, data, onClose }) {
  const cardsLite = useConfigStore((s) => s.cardsLite)
  const model = adaptStoryData(type, data, cardsLite)
  const { url: noteBg } = useChromeAsset('noteBackground')
  const { url: slotBg } = useChromeAsset('slotFrame')
  const { url: textFrame } = useChromeAsset('dialogueFrame')
  const [selectedSlotId, setSelectedSlotId] = useState(null)
  const [revealedIntroCount, setRevealedIntroCount] = useState(1)
  const [revealedSegmentCount, setRevealedSegmentCount] = useState(0)

  useEffect(() => {
    setSelectedSlotId(null)
    setRevealedIntroCount(1)
    setRevealedSegmentCount(0)
  }, [type, data?._source_path])

  const introChunks = useMemo(() => splitIntro(model?.intro), [model?.intro])
  const selectedSlot = useMemo(
    () => model?.slots?.find((slot) => slot.id === selectedSlotId) || null,
    [model?.slots, selectedSlotId]
  )
  const selectedSlotOptions = selectedSlot?.options || []
  const visibleIntro = introChunks.slice(0, Math.max(1, revealedIntroCount))
  const visibleSegments = (model?.segments || []).slice(0, revealedSegmentCount)
  const currentGateSegment = visibleSegments.find((segment) => segment.options?.length > 0)
  const canRevealIntro = revealedIntroCount < introChunks.length
  const canRevealSegment = !canRevealIntro && !currentGateSegment && revealedSegmentCount < (model?.segments?.length || 0)
  const isEventOverlay = type === 'event'

  if (!model) return null

  async function handleOpenAction(action, offsetIndex = 0) {
    if (!action?.targetType || !action?.targetId) return

    await mountNodeOnCanvas(
      {
        id: action.targetId,
        type: action.targetType,
        name: action.text,
      },
      { x: 460 + offsetIndex * 60, y: 180 + offsetIndex * 50 },
      { autoSelect: true, expandRelations: true }
    )
  }

  function branchActions(segment, branch) {
    return (segment.choiceActions || []).filter((action) => action.branch === branch)
  }

  const inspectorContent = (
    <div style={{
      display: 'grid',
      gridTemplateColumns: model.slots.length > 0 ? '108px 1fr' : '1fr',
      gap: 18,
      color: '#f1e8d5',
      minHeight: '100%',
    }}>
      {model.slots.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          alignItems: 'center',
          paddingTop: 6,
        }}>
          <div style={slotColumnTitleStyle}>卡槽</div>
          {model.slots.map((slot) => (
            <SlotButton
              key={slot.id}
              slot={slot}
              slotBgUrl={slotBg}
              active={selectedSlotId === slot.id}
              onClick={() => {
                setSelectedSlotId((current) => {
                  const next = current === slot.id ? null : slot.id
                  return next
                })
                setRevealedIntroCount(1)
                setRevealedSegmentCount(0)
              }}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              setSelectedSlotId(null)
              setRevealedIntroCount(1)
              setRevealedSegmentCount(0)
            }}
            style={smallResetButtonStyle}
          >
            重置仪式
          </button>
        </div>
      )}

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        minWidth: 0,
      }}>
        <div style={{
          padding: '18px 18px 20px',
          borderRadius: 24,
          background: noteBg
            ? `linear-gradient(180deg, rgba(18, 13, 9, 0.16), rgba(18, 13, 9, 0.44)), url("${noteBg}")`
            : 'linear-gradient(180deg, #efe3c6 0%, #d9c9a6 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: READER_CHROME.header.metaColor,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.24)',
        }}>
          <div style={{ fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', color: READER_CHROME.header.subtitleColor }}>
            {model.subtitle || model.kind}
          </div>
          <div style={{
            fontSize: 32,
            fontWeight: 800,
            marginTop: 10,
            lineHeight: 1.15,
            color: READER_CHROME.header.titleColor,
            textShadow: '0 1px 0 rgba(0,0,0,0.28)',
          }}>
            {model.title}
          </div>
          {model.meta.length > 0 && (
            <div style={{
              marginTop: 12,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}>
              {model.meta.slice(0, 6).map((item) => (
                <span key={item} style={metaChipStyle}>
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>

        {model.image && <PreviewImage pic={model.image} maxHeight={isEventOverlay ? 360 : 260} />}

        {(visibleIntro.length > 0 || selectedSlot) && (
          <div style={{
            padding: '22px 20px 20px',
            borderRadius: 28,
            background: 'rgba(24, 19, 14, 0.92)',
            border: '1px solid rgba(212, 184, 126, 0.12)',
            boxShadow: '0 20px 46px rgba(0, 0, 0, 0.28)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div style={sectionTitleStyle}>{type === 'rite' ? '当前仪式文本' : '当前事件文本'}</div>
              {selectedSlot && (
                <div style={{ fontSize: 12, color: '#d7c2a0' }}>
                  当前卡槽：{selectedSlot.title}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
              {visibleIntro.map((chunk, index) => (
                <div
                  key={`${chunk}-${index}`}
                  style={{
                    maxWidth: READER_CHROME.assets.dialogueFrame.maxWidth,
                    minHeight: READER_CHROME.assets.dialogueFrame.minHeight,
                    marginLeft: 'auto',
                    padding: READER_CHROME.assets.dialogueFrame.padding,
                    borderRadius: 22,
                    background: textFrame
                      ? `linear-gradient(180deg, rgba(10, 12, 9, 0.08), rgba(10, 12, 9, 0.28)), url("${textFrame}")`
                      : 'rgba(27, 23, 18, 0.85)',
                    backgroundSize: READER_CHROME.assets.dialogueFrame.backgroundSize,
                    backgroundPosition: READER_CHROME.assets.dialogueFrame.backgroundPosition,
                    color: '#f1e8d5',
                    boxShadow: '0 18px 36px rgba(0, 0, 0, 0.22)',
                  }}
                >
                  <div style={{ fontSize: 15, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                    {chunk}
                  </div>
                </div>
              ))}
            </div>

            {selectedSlot && (
              <div style={{
                marginTop: 18,
                padding: '14px 16px',
                borderRadius: 18,
                background: 'rgba(212, 184, 126, 0.06)',
                border: '1px solid rgba(212, 184, 126, 0.12)',
              }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  {selectedSlot.text || `${selectedSlot.title} 卡槽`}
                </div>
                {selectedSlot.conditions.length > 0 && (
                  <div style={{ ...smallLineStyle, marginTop: 6 }}>
                    可放入条件：{selectedSlot.conditions.join('，')}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
              {canRevealIntro && (
                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={() => setRevealedIntroCount((count) => Math.min(introChunks.length, count + 1))}
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
                  推进结算
                </button>
              )}
              {!canRevealIntro && !canRevealSegment && model.segments.length > 0 && (
                <span style={smallLineStyle}>当前已推进到可选分支或末尾。</span>
              )}
            </div>
          </div>
        )}

        {selectedSlotOptions.length > 0 && (
          <div style={gateBlockStyle}>
            <div style={sectionTitleStyle}>卡槽分支选项</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {selectedSlotOptions.map((option) => (
                <button key={option.id} type="button" style={choiceButtonStyle}>
                  {option.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {visibleSegments.length > 0 && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={sectionTitleStyle}>已展开分支</div>
            {visibleSegments.map((segment, index) => (
              <div key={`${segment.phase}-${index}`} style={segmentCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#d4b87e' }}>
                      {segment.phase}
                    </div>
                    {segment.title && (
                      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 600 }}>{segment.title}</div>
                    )}
                  </div>
                  {segment.conditions.length > 0 && (
                    <div style={{ fontSize: 12, color: '#cbb391', maxWidth: 220, textAlign: 'right', lineHeight: 1.6 }}>
                      {segment.conditions.join(' / ')}
                    </div>
                  )}
                </div>

                {segment.text && (
                  <div style={{
                    marginTop: 12,
                    fontSize: 14,
                    lineHeight: 1.9,
                    whiteSpace: 'pre-wrap',
                    color: '#f3ecde',
                  }}>
                    {segment.text}
                  </div>
                )}

                {segment.image && (
                  <div style={{ marginTop: 12 }}>
                    <PreviewImage pic={segment.image} maxHeight={240} />
                  </div>
                )}

                {segment.actions.length > 0 && (
                  <div style={{ ...smallLineStyle, marginTop: 12 }}>
                    后续触发：{segment.actions.map((action) => action.text).join('；')}
                  </div>
                )}

                {segment.options.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                    {segment.options.slice(0, 8).map((option) => (
                      <button key={option.id} type="button" style={choiceButtonStyle}>
                        {option.text}
                      </button>
                    ))}
                  </div>
                )}

                {segment.choiceActions?.filter((action) => action.branch === 'direct').length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                    {branchActions(segment, 'success').length > 0 && (
                      <button
                        type="button"
                        style={branchSuccessButtonStyle}
                        onClick={() => branchActions(segment, 'success').forEach((action, actionIndex) => {
                          handleOpenAction(action, actionIndex)
                        })}
                      >
                        选择成功
                      </button>
                    )}
                    {branchActions(segment, 'failed').length > 0 && (
                      <button
                        type="button"
                        style={branchFailedButtonStyle}
                        onClick={() => branchActions(segment, 'failed').forEach((action, actionIndex) => {
                          handleOpenAction(action, actionIndex)
                        })}
                      >
                        选择失败
                      </button>
                    )}
                  </div>
                )}

                {segment.note && (
                  <div style={{ ...smallLineStyle, marginTop: 10 }}>
                    备注：{segment.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  if (!isEventOverlay) return inspectorContent

  return (
    <div style={overlayShellStyle}>
      <div style={{
        ...overlayCardStyle,
        inset: READER_CHROME.eventOverlay.inset,
        padding: READER_CHROME.eventOverlay.padding,
        background: READER_CHROME.eventOverlay.background,
        border: READER_CHROME.eventOverlay.border,
        borderRadius: READER_CHROME.eventOverlay.borderRadius,
        backdropFilter: `blur(${READER_CHROME.eventOverlay.backdropBlur})`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={overlayTitleStyle}>事件阅读模式</div>
            <div style={overlaySubStyle}>关闭后返回节点图视图。</div>
          </div>
          <button type="button" onClick={onClose} style={closeButtonStyle}>关闭</button>
        </div>
        <div style={{ minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
          {inspectorContent}
        </div>
      </div>
    </div>
  )
}

const imageFallbackStyle = {
  minHeight: 220,
  borderRadius: 20,
  border: '1px dashed rgba(216, 192, 146, 0.22)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'rgba(241, 232, 213, 0.58)',
  background: 'rgba(31, 24, 18, 0.82)',
}

const sectionTitleStyle = {
  fontSize: 13,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: '#d4b87e',
}

const slotColumnTitleStyle = {
  fontSize: 12,
  letterSpacing: '0.2em',
  color: '#d4b87e',
  marginBottom: 4,
}

const gateBlockStyle = {
  padding: '18px 18px 16px',
  borderRadius: 24,
  background: 'rgba(27, 21, 16, 0.9)',
  border: '1px solid rgba(212, 184, 126, 0.16)',
  boxShadow: '0 18px 38px rgba(0, 0, 0, 0.24)',
}

const segmentCardStyle = {
  padding: '18px 18px 16px',
  borderRadius: 24,
  background: 'linear-gradient(180deg, rgba(31, 24, 18, 0.96), rgba(20, 16, 12, 0.96))',
  border: '1px solid rgba(212, 184, 126, 0.12)',
  boxShadow: '0 16px 34px rgba(0, 0, 0, 0.22)',
}

const metaChipStyle = {
  padding: '4px 10px',
  borderRadius: 999,
  background: 'rgba(35, 23, 16, 0.12)',
  border: '1px solid rgba(35, 23, 16, 0.08)',
  fontSize: 12,
}

const smallLineStyle = {
  fontSize: 12,
  lineHeight: 1.7,
  color: '#cbb391',
}

const primaryButtonStyle = {
  padding: '10px 16px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.24)',
  background: 'rgba(212, 184, 126, 0.12)',
  color: '#f2ead5',
  cursor: 'pointer',
}

const choiceButtonStyle = {
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.24)',
  background: 'rgba(212, 184, 126, 0.08)',
  color: '#f2ead5',
  cursor: 'pointer',
}

const actionButtonStyle = {
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid rgba(143, 191, 119, 0.24)',
  background: 'rgba(143, 191, 119, 0.08)',
  color: '#e5f1d9',
  cursor: 'pointer',
}

const branchSuccessButtonStyle = {
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid rgba(143, 191, 119, 0.24)',
  background: 'rgba(143, 191, 119, 0.12)',
  color: '#e5f1d9',
  cursor: 'pointer',
}

const branchFailedButtonStyle = {
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid rgba(195, 91, 91, 0.24)',
  background: 'rgba(195, 91, 91, 0.12)',
  color: '#f6d1d1',
  cursor: 'pointer',
}

const smallResetButtonStyle = {
  padding: '8px 10px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.18)',
  background: 'rgba(212, 184, 126, 0.06)',
  color: '#f2ead5',
  cursor: 'pointer',
  fontSize: 12,
}

const overlayShellStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(5, 4, 3, 0.72)',
  zIndex: 80,
}

const overlayCardStyle = {
  position: 'fixed',
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  boxShadow: '0 30px 90px rgba(0, 0, 0, 0.45)',
}

const overlayTitleStyle = {
  fontSize: 28,
  fontWeight: 800,
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
  background: 'rgba(212, 184, 126, 0.08)',
  color: '#f2ead5',
  cursor: 'pointer',
  height: 'fit-content',
}

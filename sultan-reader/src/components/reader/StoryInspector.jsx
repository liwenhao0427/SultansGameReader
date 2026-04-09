import useConfigStore from '../../stores/useConfigStore'
import { useResolvedImage } from '../../services/imageResolver'
import { adaptStoryData } from '../../services/storyAdapter'

function OrnamentBlock({ pic, style, children }) {
  const { url } = useResolvedImage(pic)

  return (
    <div
      style={{
        ...style,
        backgroundImage: url ? `linear-gradient(rgba(17, 12, 8, 0.2), rgba(17, 12, 8, 0.2)), url("${url}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {children}
    </div>
  )
}

function PreviewImage({ pic }) {
  const { url, loading } = useResolvedImage(pic)

  if (!pic) return null
  if (loading) {
    return (
      <div style={imageFallbackStyle}>
        载入图片中…
      </div>
    )
  }

  if (!url) {
    return (
      <div style={imageFallbackStyle}>
        暂无对应图片
      </div>
    )
  }

  return (
    <div style={{
      minHeight: 220,
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

export default function StoryInspector({ type, data }) {
  const cardsLite = useConfigStore((s) => s.cardsLite)
  const model = adaptStoryData(type, data, cardsLite)
  const { url: noteBg } = useResolvedImage('note_bg_new')
  const { url: slotBg } = useResolvedImage('nomal_slot_bg')
  const { url: textFrame } = useResolvedImage('1-3')

  if (!model) return null

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      color: '#f1e8d5',
    }}>
      <div style={{
        padding: '18px 18px 20px',
        borderRadius: 24,
        background: noteBg
          ? `linear-gradient(180deg, rgba(18, 13, 9, 0.22), rgba(18, 13, 9, 0.54)), url("${noteBg}")`
          : 'linear-gradient(180deg, #efe3c6 0%, #d9c9a6 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: '#231710',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.24)',
      }}>
        <div style={{ fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', opacity: 0.7 }}>
          {model.subtitle || model.kind}
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, marginTop: 10, lineHeight: 1.15 }}>
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
              <span
                key={item}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'rgba(35, 23, 16, 0.12)',
                  border: '1px solid rgba(35, 23, 16, 0.08)',
                  fontSize: 12,
                }}
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      {model.image && <PreviewImage pic={model.image} />}

      {model.intro && (
        <OrnamentBlock
          pic="nomal_rite_bg"
          style={{
            padding: '28px 24px',
            borderRadius: 28,
            minHeight: 220,
            boxShadow: '0 20px 46px rgba(0, 0, 0, 0.28)',
            color: '#2f2218',
            backgroundColor: '#eadfca',
          }}
        >
          <div style={{
            maxWidth: 460,
            marginLeft: 'auto',
            padding: '18px 20px',
            borderRadius: 22,
            background: textFrame
              ? `linear-gradient(180deg, rgba(10, 12, 9, 0.08), rgba(10, 12, 9, 0.28)), url("${textFrame}")`
              : 'rgba(27, 23, 18, 0.85)',
            backgroundSize: 'cover',
            color: '#f1e8d5',
            boxShadow: '0 18px 36px rgba(0, 0, 0, 0.22)',
          }}>
            <div style={{ fontSize: 13, letterSpacing: '0.18em', opacity: 0.72, marginBottom: 10 }}>
              开场文本
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
              {model.intro}
            </div>
          </div>
        </OrnamentBlock>
      )}

      {model.slots.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={sectionTitleStyle}>卡槽与可选入口</div>
          {model.slots.map((slot) => (
            <div
              key={slot.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '82px 1fr',
                gap: 14,
                alignItems: 'stretch',
              }}
            >
              <div style={{
                minHeight: 132,
                borderRadius: 24,
                overflow: 'hidden',
                background: slotBg
                  ? `linear-gradient(180deg, rgba(6, 8, 8, 0.16), rgba(6, 8, 8, 0.52)), url("${slotBg}")`
                  : 'linear-gradient(180deg, #d9d2c2 0%, #92846d 100%)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: '1px solid rgba(219, 207, 181, 0.24)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 700,
                color: '#f7ecd3',
                boxShadow: '0 12px 28px rgba(0,0,0,0.24)',
              }}>
                {slot.title}
              </div>
              <div style={slotCardStyle}>
                <div style={{ fontSize: 17, fontWeight: 600 }}>{slot.text || `${slot.title} 卡槽`}</div>
                {slot.conditions.length > 0 && (
                  <div style={smallLineStyle}>
                    允许条件：{slot.conditions.join('，')}
                  </div>
                )}
                {slot.options.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {slot.options.slice(0, 6).map((option) => (
                      <button key={option.id} type="button" style={choiceButtonStyle}>
                        {option.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {model.segments.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={sectionTitleStyle}>后续分支</div>
          {model.segments.slice(0, 16).map((segment, index) => (
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
                  <div style={{ fontSize: 12, color: '#cbb391', maxWidth: 180, textAlign: 'right', lineHeight: 1.6 }}>
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
                  <PreviewImage pic={segment.image} />
                </div>
              )}

              {segment.actions.length > 0 && (
                <div style={{ ...smallLineStyle, marginTop: 12 }}>
                  后续触发：{segment.actions.join('；')}
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
  )
}

const sectionTitleStyle = {
  fontSize: 13,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: '#d4b87e',
}

const slotCardStyle = {
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

const smallLineStyle = {
  fontSize: 12,
  lineHeight: 1.7,
  color: '#cbb391',
}

const choiceButtonStyle = {
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.24)',
  background: 'rgba(212, 184, 126, 0.08)',
  color: '#f2ead5',
  cursor: 'pointer',
}

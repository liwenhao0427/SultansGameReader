// 基础节点组件，所有自定义节点共用此样式基础
import { Handle, Position } from '@xyflow/react'
import { useResolvedImage } from '../../services/imageResolver'
import { CARD_RENDER_CONFIG, getCardFrameHeight, getCardRarityFrameAsset } from '../../resourceConfig'
import { CONTENT_TYPE_LABELS } from '../../constants/gameTerminology'

const NODE_TYPE_LABELS = {
  ...CONTENT_TYPE_LABELS,
  loot: '掉落池',
}

function formatDisplayId(id) {
  if (typeof id !== 'string') return String(id || '')
  const colonIndex = id.indexOf(':')
  if (colonIndex === -1) return id
  const type = id.slice(0, colonIndex)
  const rawId = id.slice(colonIndex + 1)
  return `${NODE_TYPE_LABELS[type] || type}:${rawId}`
}

/**
 * @param {string} id - 节点 ID
 * @param {string} label - 底部显示的名称/摘要文本
 * @param {string} color - 边框颜色
 * @param {boolean} selected - 是否被选中
 * @param {string|null} image - 图片资源 key（可选）
 * @param {number|null} rare - 稀有度（卡牌用，可选）
 */
export default function BaseNode({ id, label, color, selected, image, rare }) {
  const { url: imgUrl } = useResolvedImage(image || null)
  const { url: rareFrameUrl } = useResolvedImage(rare ? getCardRarityFrameAsset(rare) : null)
  const isCardLike = rare != null
  const previewWidth = isCardLike ? 72 : 118
  const previewHeight = isCardLike ? getCardFrameHeight(72) : 84
  const displayId = formatDisplayId(id)

  return (
    <div style={{
      background: '#1e1e2e',
      border: `${selected ? 3 : 2}px solid ${selected ? lighten(color) : color}`,
      borderRadius: 6,
      padding: imgUrl ? '8px' : '8px 12px',
      minWidth: imgUrl ? previewWidth + 16 : 120,
      maxWidth: 200,
      boxSizing: 'border-box',
    }}>
      <Handle type="target" position={Position.Top} />

      {imgUrl && (
        <div style={{
          width: previewWidth,
          height: previewHeight,
          borderRadius: 6,
          overflow: 'hidden',
          position: 'relative',
          background: 'rgba(12, 10, 8, 0.8)',
          backgroundImage: rareFrameUrl ? `url("${rareFrameUrl}")` : 'none',
          backgroundSize: '100% 100%',
        }}>
          <img
            src={imgUrl}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: isCardLike ? CARD_RENDER_CONFIG.imageObjectFit : 'cover',
              objectPosition: isCardLike ? CARD_RENDER_CONFIG.imageObjectPosition : 'center',
              display: 'block',
            }}
          />
          <div style={overlayShadeStyle} />
          <div style={overlayTextWrapStyle}>
            <div style={{ ...overlayIdStyle, color }}>
              {displayId}
            </div>
            <div style={overlayLabelStyle}>
              {label}
            </div>
          </div>
        </div>
      )}

      {!imgUrl && (
        <>
          <div style={{
            fontFamily: 'monospace',
            fontSize: 12,
            color,
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {displayId}
          </div>

          <div style={{
            fontSize: 11,
            color: '#a6adc8',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {label}
          </div>
        </>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

/** 简单亮化颜色：将十六进制颜色各通道提亮 40 */
function lighten(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, (n >> 16) + 40)
  const g = Math.min(255, ((n >> 8) & 0xff) + 40)
  const b = Math.min(255, (n & 0xff) + 40)
  return `rgb(${r},${g},${b})`
}

const overlayShadeStyle = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(180deg, rgba(8, 7, 6, 0.06) 0%, rgba(8, 7, 6, 0.16) 48%, rgba(8, 7, 6, 0.92) 100%)',
}

const overlayTextWrapStyle = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  padding: '8px 8px 7px',
}

const overlayIdStyle = {
  fontFamily: 'monospace',
  fontSize: 11,
  lineHeight: 1.2,
  textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const overlayLabelStyle = {
  marginTop: 4,
  fontSize: 11,
  lineHeight: 1.35,
  color: '#f1e8d5',
  textShadow: '0 1px 2px rgba(0, 0, 0, 0.88)',
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
}

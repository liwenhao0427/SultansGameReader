// 基础节点组件，所有自定义节点共用此样式基础
import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useResolvedImage } from '../../services/imageResolver'
import { CARD_RENDER_CONFIG, getCardRarityFrameAsset } from '../../resourceConfig'

/**
 * @param {string} id - 节点 ID
 * @param {string} label - 节点标题
 * @param {string} color - 边框颜色
 * @param {boolean} selected - 是否被选中
 * @param {string|null} image - 图片资源 key（可选）
 * @param {number|null} rare - 稀有度（卡牌用，可选）
 * @param {'text'|'iconTitle'|'heroBackdrop'} variant - 节点展示样式
 * @param {Function|null} onExpand - 右侧签出回调
 * @param {Function|null} onRemove - 左侧移除子树回调
 */
export default function BaseNode({
  id,
  label,
  color,
  selected,
  image,
  fallbackImage = null,
  rare,
  variant = 'text',
  onExpand = null,
  onRemove = null,
}) {
  const { url: imgUrl } = useResolvedImage(image || null)
  const { url: fallbackImgUrl } = useResolvedImage(fallbackImage || null)
  const { url: rareFrameUrl } = useResolvedImage(rare ? getCardRarityFrameAsset(rare) : null)
  const [hovered, setHovered] = useState(false)
  const isCardLike = rare != null
  const resolvedImgUrl = imgUrl || fallbackImgUrl
  const useIconTitle = variant === 'iconTitle' && resolvedImgUrl
  const useHeroBackdrop = variant === 'heroBackdrop'
  const canExpand = typeof onExpand === 'function'
  const canRemove = typeof onRemove === 'function'

  return (
    <div
      style={nodeShellStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={hoverBridgeLeftStyle} />
      <div style={hoverBridgeRightStyle} />
      <Handle type="target" position={Position.Left} style={handleStyle} />

      <div
        style={{
          ...nodeCardStyle,
          ...(useHeroBackdrop ? heroBackdropNodeStyle : (useIconTitle ? iconTitleNodeStyle : textNodeStyle)),
          border: `${selected ? 2.5 : 2}px solid ${selected ? lighten(color) : color}`,
          boxShadow: selected
            ? `0 16px 30px ${withAlpha(color, 0.22)}`
            : `0 14px 26px ${withAlpha(color, 0.12)}`,
        }}
        data-node-body="true"
      >
        {useHeroBackdrop ? (
          <>
            {resolvedImgUrl ? <img src={resolvedImgUrl} alt="" style={heroBackdropImageStyle} /> : null}
            <div style={heroBackdropShadeStyle} />
            <div style={heroBackdropLabelStyle}>{label}</div>
          </>
        ) : useIconTitle ? (
          <>
            <div
              style={{
                ...iconThumbWrapStyle,
                backgroundImage: rareFrameUrl ? `url("${rareFrameUrl}")` : 'none',
              }}
            >
              <img
                src={resolvedImgUrl}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: isCardLike ? CARD_RENDER_CONFIG.imageObjectFit : 'cover',
                  objectPosition: isCardLike ? CARD_RENDER_CONFIG.imageObjectPosition : 'center',
                  display: 'block',
                }}
              />
            </div>
            <div style={iconTitleTextWrapStyle}>
              <div style={iconTitleLabelStyle}>{label}</div>
            </div>
          </>
        ) : (
          <div style={textTitleStyle}>{label}</div>
        )}
      </div>

      {canExpand ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onExpand(id)
          }}
          className="nodrag nopan"
          style={{
            ...floatingButtonStyle,
            right: -44,
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translate(0, -50%)' : 'translate(10px, -50%)',
            pointerEvents: hovered ? 'auto' : 'none',
            borderColor: selected ? lighten(color) : color,
            boxShadow: `0 10px 20px ${withAlpha(color, 0.22)}`,
          }}
          aria-label="签出关联节点"
        >
          +
        </button>
      ) : null}

      {canRemove ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRemove(id)
          }}
          className="nodrag nopan"
          style={{
            ...floatingButtonStyle,
            left: -44,
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translate(0, -50%)' : 'translate(-10px, -50%)',
            pointerEvents: hovered ? 'auto' : 'none',
            borderColor: selected ? lighten(color) : color,
            boxShadow: `0 10px 20px ${withAlpha(color, 0.18)}`,
          }}
          aria-label="移除节点和子树"
        >
          ×
        </button>
      ) : null}

      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  )
}

function lighten(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, (n >> 16) + 40)
  const g = Math.min(255, ((n >> 8) & 0xff) + 40)
  const b = Math.min(255, (n & 0xff) + 40)
  return `rgb(${r},${g},${b})`
}

function withAlpha(hex, alpha) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const nodeShellStyle = {
  position: 'relative',
  display: 'inline-block',
}

const nodeCardStyle = {
  background: 'linear-gradient(180deg, rgba(17, 12, 9, 0.96), rgba(10, 8, 6, 0.98))',
  borderRadius: 18,
  boxSizing: 'border-box',
  color: '#f4ead6',
  backdropFilter: 'blur(4px)',
}

const textNodeStyle = {
  minWidth: 180,
  maxWidth: 240,
  padding: '14px 18px',
}

const iconTitleNodeStyle = {
  minWidth: 210,
  maxWidth: 280,
  padding: 8,
  display: 'grid',
  gridTemplateColumns: '56px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 12,
}

const heroBackdropNodeStyle = {
  width: 240,
  minHeight: 132,
  overflow: 'hidden',
  position: 'relative',
}

const iconThumbWrapStyle = {
  width: 56,
  height: 56,
  borderRadius: 14,
  overflow: 'hidden',
  position: 'relative',
  background: 'rgba(12, 10, 8, 0.92)',
  backgroundSize: '100% 100%',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
}

const iconTitleTextWrapStyle = {
  minWidth: 0,
  paddingRight: 6,
}

const iconTitleLabelStyle = {
  fontSize: 17,
  lineHeight: 1.3,
  fontWeight: 700,
  color: '#f4ead6',
  textShadow: '0 1px 2px rgba(0, 0, 0, 0.58)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const textTitleStyle = {
  fontSize: 16,
  lineHeight: 1.45,
  fontWeight: 700,
  color: '#f4ead6',
  textAlign: 'left',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
}

const heroBackdropImageStyle = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center',
  display: 'block',
}

const heroBackdropShadeStyle = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(180deg, rgba(7, 5, 4, 0.12), rgba(8, 6, 4, 0.84))',
}

const heroBackdropLabelStyle = {
  position: 'absolute',
  left: 16,
  right: 16,
  bottom: 14,
  fontSize: 18,
  lineHeight: 1.35,
  fontWeight: 700,
  color: '#f8efde',
  textShadow: '0 2px 5px rgba(0, 0, 0, 0.72)',
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
}

const floatingButtonStyle = {
  position: 'absolute',
  top: '50%',
  width: 32,
  height: 32,
  borderRadius: 999,
  border: '2px solid #c8aa70',
  background: 'rgba(16, 12, 9, 0.96)',
  color: '#f4ead6',
  fontSize: 20,
  lineHeight: '28px',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'opacity 140ms ease, transform 140ms ease',
}

const hoverBridgeLeftStyle = {
  position: 'absolute',
  top: -8,
  bottom: -8,
  left: -56,
  width: 68,
}

const hoverBridgeRightStyle = {
  position: 'absolute',
  top: -8,
  bottom: -8,
  right: -56,
  width: 68,
}

const handleStyle = {
  position: 'absolute',
  width: 10,
  height: 10,
  borderRadius: 999,
  background: 'rgba(0, 0, 0, 0)',
  border: 'none',
}

// 基础节点组件，所有自定义节点共用此样式基础
import { Handle, Position } from '@xyflow/react'

/**
 * @param {string} id - 节点 ID
 * @param {string} label - 底部显示的名称/摘要文本
 * @param {string} color - 边框颜色
 * @param {boolean} selected - 是否被选中
 */
export default function BaseNode({ id, label, color, selected }) {
  return (
    <div style={{
      background: '#1e1e2e',
      border: `${selected ? 3 : 2}px solid ${selected ? lighten(color) : color}`,
      borderRadius: 6,
      padding: '8px 12px',
      minWidth: 120,
      maxWidth: 200,
      boxSizing: 'border-box',
    }}>
      {/* 顶部连接点 */}
      <Handle type="target" position={Position.Top} />

      {/* 节点 ID */}
      <div style={{
        fontFamily: 'monospace',
        fontSize: 12,
        color,
        marginBottom: 4,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {id}
      </div>

      {/* 名称/摘要，最多 2 行 */}
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

      {/* 底部连接点 */}
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

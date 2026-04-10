import { useState, useEffect } from 'react'
import useCanvasStore from '../stores/useCanvasStore'
import RawFileView from './RawFileView'
import StoryInspector from './reader/StoryInspector'

const FULLSCREEN_TYPES = new Set(['rite', 'event', 'dt', 'over', 'after_story'])

// 面板整体样式
const panelStyle = {
  position: 'fixed',
  top: 18,
  right: 18,
  bottom: 18,
  width: 520,
  zIndex: 70,
  background: 'linear-gradient(180deg, #15100b 0%, #0f0c08 100%)',
  color: '#f1e8d5',
  padding: 18,
  boxSizing: 'border-box',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 28,
  border: '1px solid rgba(212, 184, 126, 0.12)',
  boxShadow: '0 24px 54px rgba(0, 0, 0, 0.32)',
}

const errorStyle = {
  color: '#ffb6a3',
  fontSize: 12,
  padding: '8px 0',
}

/**
 * DetailPanel — 右侧详情面板容器
 * 监听 selectedNodeId，加载对应缓存数据，分发到子组件
 */
export default function DetailPanel() {
  const selectedNodeId = useCanvasStore(s => s.selectedNodeId)
  const setSelectedNode = useCanvasStore(s => s.setSelectedNode)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [rawContent, setRawContent] = useState(null)

  // 当选中节点变化时加载数据
  useEffect(() => {
    if (!selectedNodeId) {
      setData(null)
      setError(null)
      return
    }

    // 解析 "{type}:{id}" 格式
    const colonIdx = selectedNodeId.indexOf(':')
    if (colonIdx === -1) return
    const type = selectedNodeId.slice(0, colonIdx)
    const id = selectedNodeId.slice(colonIdx + 1)

    setLoading(true)
    setError(null)
    setData(null)

    window.electronAPI.configReadCache(type, id)
      .then(result => {
        setData(result)
        setLoading(false)
      })
      .catch(err => {
        setError(err?.message || '加载失败')
        setLoading(false)
      })
  }, [selectedNodeId])

  // 查看原始文件
  async function handleViewRaw() {
    if (!data?._source_path) return
    try {
      const content = await window.electronAPI.fileReadRaw(data._source_path)
      setRawContent(content)
    } catch (e) {
      setRawContent(`读取失败：${e?.message}`)
    }
  }

  const colonIdx = selectedNodeId?.indexOf(':') ?? -1
  const type = colonIdx !== -1 ? selectedNodeId.slice(0, colonIdx) : ''

  if (!selectedNodeId) {
    return null
  }

  if (FULLSCREEN_TYPES.has(type)) {
    return !loading && !error && data
      ? <StoryInspector type={type} data={data} onClose={() => setSelectedNode(null)} />
      : null
  }

  return (
    <div style={panelStyle}>
      {/* 加载状态 */}
      {loading && (
        <div style={{ color: '#a6adc8', fontSize: 12, padding: '8px 0' }}>加载中…</div>
      )}

      {/* 错误状态 */}
      {error && <div style={errorStyle}>错误：{error}</div>}
      {!loading && !error && data && (
        <div style={{ flex: 1, display: 'grid', gridTemplateRows: 'auto 1fr', minHeight: 0 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 14,
          }}>
            <div style={{ color: 'rgba(241, 232, 213, 0.62)', fontSize: 12 }}>
              {selectedNodeId}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {data?._source_path && (
                <button type="button" onClick={handleViewRaw} style={actionButtonStyle}>查看原始文件</button>
              )}
              <button type="button" onClick={() => setSelectedNode(null)} style={actionButtonStyle}>关闭</button>
            </div>
          </div>
          <StoryInspector type={type} data={data} onClose={() => setSelectedNode(null)} />
        </div>
      )}

      {rawContent !== null && (
        <RawFileView content={rawContent} onClose={() => setRawContent(null)} />
      )}
    </div>
  )
}

const actionButtonStyle = {
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.18)',
  background: 'rgba(212, 184, 126, 0.08)',
  color: '#f1e8d5',
  cursor: 'pointer',
}

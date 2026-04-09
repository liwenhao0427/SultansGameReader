import { useState, useEffect } from 'react'
import useCanvasStore from '../stores/useCanvasStore'
import RawFileView from './RawFileView'
import StoryInspector from './reader/StoryInspector'

// 面板整体样式
const panelStyle = {
  width: '100%',
  height: '100%',
  background: 'linear-gradient(180deg, #15100b 0%, #0f0c08 100%)',
  color: '#f1e8d5',
  padding: 18,
  boxSizing: 'border-box',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
}

const emptyStyle = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'rgba(241, 232, 213, 0.52)',
  fontSize: 14,
  lineHeight: 1.8,
  textAlign: 'center',
}

const rawBtnStyle = {
  marginTop: 16,
  padding: '8px 14px',
  background: 'rgba(212, 184, 126, 0.08)',
  color: '#f1e8d5',
  border: '1px solid rgba(212, 184, 126, 0.2)',
  borderRadius: 999,
  cursor: 'pointer',
  fontSize: 12,
  alignSelf: 'flex-start',
  flexShrink: 0,
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

  // 无选中节点
  if (!selectedNodeId) {
    return (
      <div style={panelStyle}>
        <div style={emptyStyle}>
          选择一个仪式或事件开始阅读。
          <br />
          右侧将逐步展示正文、卡槽和后续分支。
        </div>
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      {/* 加载状态 */}
      {loading && (
        <div style={{ color: '#a6adc8', fontSize: 12, padding: '8px 0' }}>加载中…</div>
      )}

      {/* 错误状态 */}
      {error && <div style={errorStyle}>错误：{error}</div>}

      {/* 详情内容 */}
      {!loading && !error && data && (
        <div style={{ flex: 1 }}>
          <StoryInspector type={type} data={data} onClose={() => setSelectedNode(null)} />
        </div>
      )}

      {/* 查看原始文件按钮 */}
      {data?._source_path && (
        <button style={rawBtnStyle} onClick={handleViewRaw}>
          查看原始文件
        </button>
      )}

      {/* 原始文件弹窗 */}
      {rawContent !== null && (
        <RawFileView content={rawContent} onClose={() => setRawContent(null)} />
      )}
    </div>
  )
}

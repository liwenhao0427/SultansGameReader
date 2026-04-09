import { useState, useEffect } from 'react'
import useCanvasStore from '../stores/useCanvasStore'
import EventDetail from './details/EventDetail'
import RiteDetail from './details/RiteDetail'
import AfterStoryDetail from './details/AfterStoryDetail'
import CardDetail from './details/CardDetail'
import LootDetail from './details/LootDetail'
import OverDetail from './details/OverDetail'
import UpgradeDetail from './details/UpgradeDetail'
import DTDetail from './details/DTDetail'
import RawFileView from './RawFileView'

// 面板整体样式
const panelStyle = {
  width: '100%',
  height: '100%',
  background: '#1e1e2e',
  color: '#cdd6f4',
  padding: 16,
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
  color: '#585b70',
  fontSize: 13,
}

const rawBtnStyle = {
  marginTop: 16,
  padding: '6px 14px',
  background: '#313244',
  color: '#cdd6f4',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  alignSelf: 'flex-start',
  flexShrink: 0,
}

const errorStyle = {
  color: '#f38ba8',
  fontSize: 12,
  padding: '8px 0',
}

/**
 * DetailPanel — 右侧详情面板容器
 * 监听 selectedNodeId，加载对应缓存数据，分发到子组件
 */
export default function DetailPanel() {
  const selectedNodeId = useCanvasStore(s => s.selectedNodeId)
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

  // 根据 type 分发到对应子组件
  function renderDetail() {
    if (!selectedNodeId) return null
    const colonIdx = selectedNodeId.indexOf(':')
    const type = colonIdx !== -1 ? selectedNodeId.slice(0, colonIdx) : ''

    switch (type) {
      case 'event':       return <EventDetail data={data} />
      case 'rite':        return <RiteDetail data={data} />
      case 'after_story': return <AfterStoryDetail data={data} />
      case 'card':        return <CardDetail data={data} />
      case 'loot':        return <LootDetail data={data} />
      case 'over':        return <OverDetail data={data} />
      case 'upgrade':     return <UpgradeDetail data={data} />
      case 'dt':          return <DTDetail data={data} />
      default:
        return (
          <div style={{ color: '#a6adc8', fontSize: 12 }}>
            未知类型：{type}
          </div>
        )
    }
  }

  // 无选中节点
  if (!selectedNodeId) {
    return (
      <div style={panelStyle}>
        <div style={emptyStyle}>点击节点查看详情</div>
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
          {renderDetail()}
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

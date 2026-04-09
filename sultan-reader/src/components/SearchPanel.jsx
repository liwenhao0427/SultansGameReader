import { useState, useEffect, useCallback, useRef } from 'react'

// 类型过滤选项
const ALL_TYPES = ['event', 'rite', 'loot', 'after_story', 'over', 'card', 'upgrade', 'dt']

// 各类型对应的彩色标签颜色
const TYPE_COLORS = {
  event:       '#89b4fa',
  rite:        '#cba6f7',
  loot:        '#f9e2af',
  after_story: '#94e2d5',
  card:        '#a6e3a1',
  over:        '#f38ba8',
  upgrade:     '#fab387',
  dt:          '#89dceb',
}

/**
 * 截断文本到指定长度
 */
function truncate(str, len = 40) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '…' : str
}

/**
 * 搜索面板组件
 * 左侧搜索栏：关键字输入 + 类型过滤 + 可滚动结果列表
 * 结果项支持拖拽到 Canvas
 */
export default function SearchPanel() {
  const [query, setQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState(new Set(ALL_TYPES))
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const debounceTimer = useRef(null)

  // 执行搜索
  const doSearch = useCallback(async (q, types) => {
    setLoading(true)
    try {
      const typesArr = [...types]
      const res = await window.electronAPI.configSearch(q, typesArr)
      setResults(res || [])
    } catch (e) {
      console.error('搜索失败', e)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // 输入变化时 debounce 300ms 后搜索
  useEffect(() => {
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      doSearch(query, selectedTypes)
    }, 300)
    return () => clearTimeout(debounceTimer.current)
  }, [query, selectedTypes, doSearch])

  // 切换类型过滤
  const toggleType = useCallback((type) => {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }, [])

  // 拖拽开始：传递 { id, type } 数据
  const handleDragStart = useCallback((e, id, type) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ id, type }))
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#1e1e2e',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      borderRight: '1px solid #313244',
    }}>
      {/* 搜索输入框 */}
      <div style={{ padding: '10px 10px 6px' }}>
        <input
          type="text"
          placeholder="搜索 id / 名称 / 文本…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '6px 10px',
            background: '#313244',
            border: '1px solid #45475a',
            borderRadius: 4,
            color: '#cdd6f4',
            fontSize: 13,
            outline: 'none',
          }}
        />
      </div>

      {/* 类型过滤复选框 */}
      <div style={{
        padding: '4px 10px 6px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px 8px',
        borderBottom: '1px solid #313244',
      }}>
        {ALL_TYPES.map(type => (
          <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', fontSize: 11 }}>
            <input
              type="checkbox"
              checked={selectedTypes.has(type)}
              onChange={() => toggleType(type)}
              style={{ accentColor: TYPE_COLORS[type], cursor: 'pointer' }}
            />
            <span style={{ color: TYPE_COLORS[type] }}>{type}</span>
          </label>
        ))}
      </div>

      {/* 结果列表 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {loading && (
          <div style={{ color: '#6c7086', fontSize: 12, textAlign: 'center', padding: 12 }}>搜索中…</div>
        )}
        {!loading && results.length === 0 && (
          <div style={{ color: '#6c7086', fontSize: 12, textAlign: 'center', padding: 12 }}>
            {query ? '无匹配结果' : '输入关键字开始搜索'}
          </div>
        )}
        {!loading && results.map((item) => {
          const summary = truncate(item.name || item.text || '')
          return (
            <div
              key={`${item.type}:${item.id}`}
              draggable={true}
              onDragStart={e => handleDragStart(e, item.id, item.type)}
              style={{
                padding: '6px 10px',
                cursor: 'grab',
                borderBottom: '1px solid #181825',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                userSelect: 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#313244'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* 第一行：id + 类型标签 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#cdd6f4', fontSize: 12, fontFamily: 'monospace' }}>{item.id}</span>
                <span style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: TYPE_COLORS[item.type] + '33',
                  color: TYPE_COLORS[item.type],
                  border: `1px solid ${TYPE_COLORS[item.type]}66`,
                  flexShrink: 0,
                }}>
                  {item.type}
                </span>
              </div>
              {/* 第二行：名称/文本摘要 */}
              {summary && (
                <div style={{ color: '#a6adc8', fontSize: 11, lineHeight: 1.4 }}>{summary}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

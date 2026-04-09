import { useState, useEffect, useCallback, useRef } from 'react'
import useCanvasStore from '../stores/useCanvasStore.js'

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

function truncate(str, len = 40) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '…' : str
}

/**
 * 搜索面板
 * - 点击结果项：直接加入画布（居中位置，带随机偏移避免重叠）
 * - 拖拽结果项：拖到画布指定位置放置
 */
export default function SearchPanel() {
  const [query, setQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState(new Set(ALL_TYPES))
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(null) // 正在加入的 item key
  const debounceTimer = useRef(null)

  const { nodeIdSet, addNode, addEdges } = useCanvasStore()

  // 执行搜索
  const doSearch = useCallback(async (q, types) => {
    setLoading(true)
    try {
      const res = await window.electronAPI.configSearch(q, [...types])
      setResults(res || [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      doSearch(query, selectedTypes)
    }, 300)
    return () => clearTimeout(debounceTimer.current)
  }, [query, selectedTypes, doSearch])

  const toggleType = useCallback((type) => {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }, [])

  // 点击直接加入画布
  const handleClick = useCallback(async (item) => {
    const nodeKey = `${item.type}:${item.id}`
    if (nodeIdSet.has(nodeKey)) return // 已在画布上

    setAdding(nodeKey)
    try {
      const data = await window.electronAPI.configReadCache(item.type, item.id)
      if (!data) return

      // 随机偏移，避免多个节点堆叠
      const offset = () => (Math.random() - 0.5) * 300
      const position = { x: 400 + offset(), y: 300 + offset() }

      addNode(item.id, item.type, {
        label: item.id,
        nodeType: item.type,
        rawData: data,
      }, position)

      // 自动展开关联（≤10 个）
      const { extractEdges } = await import('../services/edgeExtractor.js')
      const { evaluateCondition } = await import('../services/conditionEvaluator.js')
      const relations = extractEdges(item.type, item.id, data)
      const currentSet = useCanvasStore.getState().nodeIdSet
      const newRelations = relations.filter(r => !currentSet.has(r.target))

      const EDGE_COLORS = { success: '#a6e3a1', failed: '#f38ba8', default: '#6c7086' }
      const buildEdges = (rels) => rels.map(r => ({
        id: `${r.source}->${r.target}:${r.path}`,
        source: r.source,
        target: r.target,
        style: { stroke: EDGE_COLORS[r.branchType] ?? EDGE_COLORS.default },
        data: { conditionText: r.conditionText, branchType: r.branchType },
      }))

      if (newRelations.length <= 10) {
        let x = position.x - 200, y = position.y + 150
        for (const rel of newRelations) {
          const [relType, relId] = rel.target.split(':')
          try {
            const relData = await window.electronAPI.configReadCache(relType, relId)
            if (relData) {
              addNode(relId, relType, { label: relId, nodeType: relType, rawData: relData }, { x, y })
              x += 220
            }
          } catch {}
        }
        addEdges(buildEdges(relations))
      } else {
        addEdges(buildEdges(relations.filter(r => useCanvasStore.getState().nodeIdSet.has(r.target))))
      }
    } catch (e) {
      console.error('加入节点失败', e)
    } finally {
      setAdding(null)
    }
  }, [nodeIdSet, addNode, addEdges])

  // 拖拽开始（保留拖拽功能）
  const handleDragStart = useCallback((e, id, type) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ id, type }))
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#1e1e2e',
      display: 'flex', flexDirection: 'column',
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
            width: '100%', boxSizing: 'border-box',
            padding: '6px 10px',
            background: '#313244', border: '1px solid #45475a',
            borderRadius: 4, color: '#cdd6f4', fontSize: 13, outline: 'none',
          }}
        />
      </div>

      {/* 类型过滤复选框 */}
      <div style={{
        padding: '4px 10px 6px',
        display: 'flex', flexWrap: 'wrap', gap: '4px 8px',
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
          const key = `${item.type}:${item.id}`
          const inCanvas = nodeIdSet.has(key)
          const isAdding = adding === key
          const summary = truncate(item.name || item.text || '')

          return (
            <div
              key={key}
              draggable={!inCanvas}
              onDragStart={e => handleDragStart(e, item.id, item.type)}
              onClick={() => !inCanvas && !isAdding && handleClick(item)}
              style={{
                padding: '6px 10px',
                cursor: inCanvas ? 'default' : isAdding ? 'wait' : 'pointer',
                borderBottom: '1px solid #181825',
                display: 'flex', flexDirection: 'column', gap: 2,
                userSelect: 'none',
                opacity: inCanvas ? 0.45 : 1,
              }}
              onMouseEnter={e => { if (!inCanvas) e.currentTarget.style.background = '#313244' }}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#cdd6f4', fontSize: 12, fontFamily: 'monospace' }}>{item.id}</span>
                <span style={{
                  fontSize: 10, padding: '1px 5px', borderRadius: 3,
                  background: TYPE_COLORS[item.type] + '33',
                  color: TYPE_COLORS[item.type],
                  border: `1px solid ${TYPE_COLORS[item.type]}66`,
                  flexShrink: 0,
                }}>
                  {item.type}
                </span>
                {inCanvas && <span style={{ fontSize: 10, color: '#6c7086' }}>已在画布</span>}
                {isAdding && <span style={{ fontSize: 10, color: '#a6adc8' }}>加入中…</span>}
              </div>
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

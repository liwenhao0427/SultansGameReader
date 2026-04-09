import { useState, useMemo } from 'react'
import useConfigStore from '../stores/useConfigStore'
import usePlayerStore from '../stores/usePlayerStore'

/**
 * CounterPanel — 计数器与事件触发状态管理侧拉栏
 * Props:
 *   visible  {boolean} 是否显示
 *   onClose  {function} 关闭回调
 */
export default function CounterPanel({ visible, onClose }) {
  // 搜索框文本
  const [eventSearch, setEventSearch] = useState('')

  // 从 configStore 读取计数器注册表
  const counterRegistry = useConfigStore(s => s.counterRegistry)
  // 从 playerStore 读取模拟状态
  const counterValues = usePlayerStore(s => s.counterValues)
  const triggeredEvents = usePlayerStore(s => s.triggeredEvents)
  const setCounterValue = usePlayerStore(s => s.setCounterValue)
  const toggleEvent = usePlayerStore(s => s.toggleEvent)
  const resetAll = usePlayerStore(s => s.resetAll)

  // 将 counterRegistry Map 转为数组，按 id 排序
  const counters = useMemo(() => {
    return [...counterRegistry.values()].sort((a, b) => Number(a.id) - Number(b.id))
  }, [counterRegistry])

  // 过滤事件列表（按搜索词）
  const filteredEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase()
    if (!q) return [...triggeredEvents].sort()
    return [...triggeredEvents].filter(id => id.toLowerCase().includes(q)).sort()
  }, [triggeredEvents, eventSearch])

  // 面板不可见时不渲染
  if (!visible) return null

  return (
    <>
      {/* 遮罩层 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 999,
        }}
      />

      {/* 侧拉面板 */}
      <div style={{
        position: 'fixed', top: 0, right: 0,
        width: 360, height: '100vh',
        background: '#1e1e2e',
        borderLeft: '1px solid #313244',
        display: 'flex', flexDirection: 'column',
        zIndex: 1000,
        boxShadow: '-4px 0 16px rgba(0,0,0,0.5)',
      }}>
        {/* 标题栏 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #313244',
          flexShrink: 0,
        }}>
          <span style={{ color: '#cba6f7', fontWeight: 'bold', fontSize: 14 }}>
            计数器 &amp; 事件状态
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* 重置全部按钮 */}
            <button
              onClick={resetAll}
              style={{
                background: '#45475a', color: '#f38ba8',
                border: 'none', borderRadius: 4,
                padding: '4px 10px', cursor: 'pointer', fontSize: 12,
              }}
            >
              重置全部
            </button>
            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              style={{
                background: 'transparent', color: '#6c7086',
                border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* 内容区（可滚动） */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>

          {/* ── 计数器列表 ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: '#a6adc8', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              计数器模拟值
            </div>
            {counters.length === 0 ? (
              <div style={{ color: '#585b70', fontSize: 12 }}>暂无计数器（请先构建注册表）</div>
            ) : (
              counters.map(({ id, comment }) => (
                <div key={id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 6,
                }}>
                  {/* 计数器 ID */}
                  <span style={{ color: '#89b4fa', fontSize: 12, width: 70, flexShrink: 0, fontFamily: 'monospace' }}>
                    #{id}
                  </span>
                  {/* 注释描述 */}
                  <span style={{
                    color: '#a6adc8', fontSize: 12, flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }} title={comment ?? ''}>
                    {comment ?? <span style={{ color: '#585b70' }}>—</span>}
                  </span>
                  {/* 数字输入框 */}
                  <input
                    type="number"
                    value={counterValues.get(id) ?? 0}
                    onChange={e => setCounterValue(id, Number(e.target.value))}
                    style={{
                      width: 60, background: '#313244', color: '#cdd6f4',
                      border: '1px solid #45475a', borderRadius: 4,
                      padding: '2px 6px', fontSize: 12, textAlign: 'right',
                    }}
                  />
                </div>
              ))
            )}
          </div>

          {/* ── 事件触发区 ── */}
          <div>
            <div style={{ color: '#a6adc8', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              已触发事件
            </div>

            {/* 搜索框 + 添加事件 */}
            <EventSearchInput
              value={eventSearch}
              onChange={setEventSearch}
              onToggle={toggleEvent}
              triggeredEvents={triggeredEvents}
            />

            {/* 已触发事件列表 */}
            <div style={{ maxHeight: 300, overflowY: 'auto', marginTop: 8 }}>
              {filteredEvents.length === 0 ? (
                <div style={{ color: '#585b70', fontSize: 12 }}>
                  {triggeredEvents.size === 0 ? '暂无已触发事件' : '无匹配结果'}
                </div>
              ) : (
                filteredEvents.map(id => (
                  <div key={id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '4px 0',
                    borderBottom: '1px solid #313244',
                  }}>
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => toggleEvent(id)}
                      style={{ cursor: 'pointer', accentColor: '#a6e3a1' }}
                    />
                    <span style={{ color: '#cdd6f4', fontSize: 12, fontFamily: 'monospace' }}>{id}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * 事件搜索输入框：输入事件 ID 后按 Enter 或点击按钮切换触发状态
 */
function EventSearchInput({ value, onChange, onToggle, triggeredEvents }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && value.trim()) {
      onToggle(value.trim())
      onChange('')
    }
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <input
        type="text"
        placeholder="输入事件 ID，Enter 添加…"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          flex: 1, background: '#313244', color: '#cdd6f4',
          border: '1px solid #45475a', borderRadius: 4,
          padding: '5px 8px', fontSize: 12,
          outline: 'none',
        }}
      />
      <button
        onClick={() => { if (value.trim()) { onToggle(value.trim()); onChange('') } }}
        style={{
          background: '#313244', color: '#a6e3a1',
          border: '1px solid #45475a', borderRadius: 4,
          padding: '5px 10px', cursor: 'pointer', fontSize: 12,
        }}
      >
        {triggeredEvents.has(value.trim()) ? '取消' : '标记'}
      </button>
    </div>
  )
}

import { useEffect, useState } from 'react'
import useConfigStore from '../stores/useConfigStore'
import SearchPanel from './SearchPanel'
import Canvas from './Canvas'
import DetailPanel from './DetailPanel'
import CounterPanel from './CounterPanel'

// 顶部导航栏高度
const NAV_HEIGHT = 44

/**
 * 三栏主布局组件
 * 左：SearchPanel（240px）| 中：Canvas（flex:1）| 右：DetailPanel（320px）
 * 右侧可打开 CounterPanel 侧拉栏
 */
export default function MainLayout({ onNavigate }) {
  const isLoaded = useConfigStore(s => s.isLoaded)
  const [counterPanelVisible, setCounterPanelVisible] = useState(false)

  // 组件挂载时初始化搜索索引和卡牌映射
  useEffect(() => {
    useConfigStore.getState().initialize()
  }, [])

  // 加载中状态
  if (!isLoaded) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: '#11111b',
        color: '#a6adc8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
      }}>
        正在加载索引…
      </div>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#11111b' }}>
      {/* 顶部导航栏 */}
      <div style={{
        height: NAV_HEIGHT,
        minHeight: NAV_HEIGHT,
        background: '#181825',
        borderBottom: '1px solid #313244',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
      }}>
        {/* 左侧标题 */}
        <span style={{ color: '#cba6f7', fontWeight: 'bold', fontSize: 15 }}>
          苏丹的游戏 剧情阅读器
        </span>
        {/* 右侧按钮组 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setCounterPanelVisible(v => !v)}
            style={{
              background: counterPanelVisible ? '#cba6f7' : '#313244',
              color: counterPanelVisible ? '#1e1e2e' : '#cdd6f4',
              border: 'none', borderRadius: 4,
              padding: '5px 12px', cursor: 'pointer', fontSize: 13,
            }}
          >
            🎲 计数器
          </button>
          <button
            onClick={() => onNavigate('settings')}
            style={{
              background: '#313244',
              color: '#cdd6f4',
              border: 'none',
              borderRadius: 4,
              padding: '5px 12px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            ⚙ 设置
          </button>
        </div>
      </div>

      {/* 三栏内容区 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左侧搜索面板（固定 240px） */}
        <div style={{ width: 240, flexShrink: 0, overflow: 'hidden' }}>
          <SearchPanel />
        </div>

        {/* 中间画布（flex: 1） */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Canvas />
        </div>

        {/* 右侧详情面板（固定 320px） */}
        <div style={{ width: 320, flexShrink: 0, borderLeft: '1px solid #313244', overflow: 'hidden' }}>
          <DetailPanel />
        </div>
      </div>

      {/* 计数器侧拉栏 */}
      <CounterPanel visible={counterPanelVisible} onClose={() => setCounterPanelVisible(false)} />
    </div>
  )
}

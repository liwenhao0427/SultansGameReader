import { useEffect, useMemo, useState } from 'react'
import useConfigStore from '../stores/useConfigStore'
import useCanvasStore from '../stores/useCanvasStore'
import Canvas from './Canvas'
import DetailPanel from './DetailPanel'
import { mountNodeOnCanvas } from '../services/graphNavigation'

const TYPE_TABS = [
  { key: 'rite', label: '仪式' },
  { key: 'event', label: '事件' },
  { key: 'loot', label: '战利品' },
  { key: 'over', label: '结局' },
  { key: 'after_story', label: '后日谈' },
  { key: 'card', label: '卡牌' },
  { key: 'dt', label: '对话树' },
]

const PAGE_SIZE = 18

function chunkSummary(entry) {
  return entry.name || entry.text || entry.id
}

export default function MainLayout({ onNavigate }) {
  const isLoaded = useConfigStore((s) => s.isLoaded)
  const initialize = useConfigStore((s) => s.initialize)
  const indexStats = useConfigStore((s) => s.indexStats)
  const nodeIdSet = useCanvasStore((s) => s.nodeIdSet)
  const clearCanvas = useCanvasStore((s) => s.clearCanvas)

  const [activeType, setActiveType] = useState('rite')
  const [items, setItems] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [loadingItems, setLoadingItems] = useState(false)
  const [bootstrapped, setBootstrapped] = useState(false)

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (!isLoaded) return

    let cancelled = false

    async function loadItems() {
      setLoadingItems(true)
      setCurrentPage(1)
      try {
        const result = await window.electronAPI.configListCache(activeType)
        if (!cancelled) {
          setItems(result || [])
        }
      } catch {
        if (!cancelled) {
          setItems([])
        }
      } finally {
        if (!cancelled) {
          setLoadingItems(false)
        }
      }
    }

    loadItems()

    return () => {
      cancelled = true
    }
  }, [activeType, isLoaded])

  useEffect(() => {
    if (!isLoaded || bootstrapped || nodeIdSet.size > 0) return

    let cancelled = false

    async function bootstrapRites() {
      try {
        const rites = await window.electronAPI.configListCache('rite')
        if (!rites?.length || cancelled) return

        const randomRites = [...rites]
          .sort(() => Math.random() - 0.5)
          .slice(0, 4)

        const positions = [
          { x: 80, y: 70 },
          { x: 420, y: 60 },
          { x: 160, y: 320 },
          { x: 520, y: 300 },
        ]

        for (let i = 0; i < randomRites.length; i++) {
          await mountNodeOnCanvas(randomRites[i], positions[i] || { x: 140 + i * 180, y: 120 + i * 110 }, { autoSelect: i === 0 })
        }

        if (!cancelled) {
          setBootstrapped(true)
        }
      } catch {
        if (!cancelled) {
          setBootstrapped(true)
        }
      }
    }

    bootstrapRites()

    return () => {
      cancelled = true
    }
  }, [bootstrapped, isLoaded, nodeIdSet.size])

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const visibleItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return items.slice(start, start + PAGE_SIZE)
  }, [currentPage, items])

  if (!isLoaded) {
    return (
      <div style={loadingScreenStyle}>
        正在整理剧情索引与阅读资源…
      </div>
    )
  }

  return (
    <div style={shellStyle}>
      <div style={heroBarStyle}>
        <div>
          <div style={eyebrowStyle}>Sultan's Game Reader</div>
          <div style={titleStyle}>仪式优先的剧情阅读工作台</div>
          <div style={subTitleStyle}>
            默认加载几个仪式到画布，画布负责导航，右侧负责阅读。
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            style={secondaryActionStyle}
            onClick={async () => {
              clearCanvas()
              setBootstrapped(false)
            }}
          >
            换一组仪式
          </button>
          <button
            type="button"
            style={secondaryActionStyle}
            onClick={() => onNavigate('settings')}
          >
            设置
          </button>
        </div>
      </div>

      <div style={workspaceStyle}>
        <aside style={leftRailStyle}>
          <div style={railHeaderStyle}>
            <div style={railTitleStyle}>内容目录</div>
            <div style={railMetaStyle}>
              {typeof indexStats?.counts === 'object'
                ? `已索引 ${Object.values(indexStats.counts).reduce((sum, value) => sum + value, 0)} 项`
                : '可直接切换类型'}
            </div>
          </div>

          <div style={tabRowStyle}>
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveType(tab.key)}
                style={{
                  ...tabStyle,
                  ...(activeType === tab.key ? activeTabStyle : null),
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={listWrapStyle}>
            {loadingItems && <div style={listHintStyle}>正在读取 {TYPE_TABS.find((tab) => tab.key === activeType)?.label}…</div>}
            {!loadingItems && visibleItems.length === 0 && <div style={listHintStyle}>该类型下暂无可读条目。</div>}

            {!loadingItems && visibleItems.map((item, index) => {
              const nodeKey = `${activeType}:${item.id}`
              const inCanvas = nodeIdSet.has(nodeKey)
              return (
                <button
                  key={nodeKey}
                  type="button"
                  onClick={() => mountNodeOnCanvas({ ...item, type: activeType }, { x: 120 + (index % 3) * 180, y: 120 + index * 24 }, { autoSelect: true })}
                  style={{
                    ...listItemStyle,
                    ...(inCanvas ? mountedItemStyle : null),
                  }}
                >
                  <div style={listItemIdStyle}>{item.id}</div>
                  <div style={listItemTitleStyle}>{chunkSummary(item)}</div>
                </button>
              )
            })}
          </div>

          <div style={paginationStyle}>
            <button
              type="button"
              style={pagerBtnStyle}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              上一页
            </button>
            <span style={{ color: '#cdb589', fontSize: 12 }}>
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              style={pagerBtnStyle}
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            >
              下一页
            </button>
          </div>
        </aside>

        <section style={canvasStageStyle}>
          <div style={stageHeaderStyle}>
            <div>
              <div style={stageTitleStyle}>节点图导航</div>
              <div style={stageHintStyle}>现在可以直接拖动画布中的节点，阅读区会跟随当前选择更新。</div>
            </div>
          </div>
          <div style={canvasFrameStyle}>
            <Canvas />
          </div>
        </section>

        <aside style={readerStageStyle}>
          <DetailPanel />
        </aside>
      </div>
    </div>
  )
}

const shellStyle = {
  width: '100%',
  height: '100%',
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  background: `
    radial-gradient(circle at top, rgba(173, 134, 70, 0.16), transparent 35%),
    linear-gradient(180deg, #1a140f 0%, #100d09 100%)
  `,
  color: '#f1e8d5',
}

const loadingScreenStyle = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(180deg, #1a140f 0%, #100d09 100%)',
  color: '#f1e8d5',
  fontSize: 15,
  letterSpacing: '0.08em',
}

const heroBarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  padding: '22px 28px 18px',
  borderBottom: '1px solid rgba(212, 184, 126, 0.14)',
  background: 'linear-gradient(180deg, rgba(27, 21, 16, 0.92), rgba(20, 16, 12, 0.8))',
}

const eyebrowStyle = {
  color: '#b99759',
  fontSize: 11,
  letterSpacing: '0.28em',
  textTransform: 'uppercase',
}

const titleStyle = {
  marginTop: 8,
  fontSize: 28,
  fontWeight: 700,
  lineHeight: 1.2,
}

const subTitleStyle = {
  marginTop: 8,
  fontSize: 13,
  color: 'rgba(241, 232, 213, 0.7)',
}

const secondaryActionStyle = {
  padding: '10px 14px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.2)',
  background: 'rgba(212, 184, 126, 0.08)',
  color: '#f1e8d5',
  cursor: 'pointer',
}

const workspaceStyle = {
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: '300px minmax(420px, 1fr) 500px',
  gap: 18,
  padding: 18,
}

const panelBaseStyle = {
  minHeight: 0,
  borderRadius: 28,
  overflow: 'hidden',
  border: '1px solid rgba(212, 184, 126, 0.12)',
  background: 'linear-gradient(180deg, rgba(27, 21, 16, 0.92), rgba(18, 15, 11, 0.94))',
  boxShadow: '0 24px 54px rgba(0, 0, 0, 0.26)',
}

const leftRailStyle = {
  ...panelBaseStyle,
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr auto',
}

const canvasStageStyle = {
  ...panelBaseStyle,
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
}

const readerStageStyle = {
  ...panelBaseStyle,
}

const railHeaderStyle = {
  padding: '18px 18px 12px',
  borderBottom: '1px solid rgba(212, 184, 126, 0.1)',
}

const railTitleStyle = {
  fontSize: 18,
  fontWeight: 700,
}

const railMetaStyle = {
  marginTop: 6,
  fontSize: 12,
  color: 'rgba(241, 232, 213, 0.6)',
}

const tabRowStyle = {
  padding: '14px 14px 8px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

const tabStyle = {
  padding: '7px 11px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.12)',
  background: 'rgba(212, 184, 126, 0.04)',
  color: '#d7c2a0',
  cursor: 'pointer',
}

const activeTabStyle = {
  background: 'rgba(212, 184, 126, 0.18)',
  color: '#fff3dd',
  border: '1px solid rgba(212, 184, 126, 0.28)',
}

const listWrapStyle = {
  minHeight: 0,
  overflowY: 'auto',
  padding: '0 12px 12px',
  display: 'grid',
  gap: 10,
}

const listHintStyle = {
  padding: '20px 10px',
  color: 'rgba(241, 232, 213, 0.56)',
  fontSize: 13,
  textAlign: 'center',
}

const listItemStyle = {
  textAlign: 'left',
  padding: '12px 14px',
  borderRadius: 20,
  border: '1px solid rgba(212, 184, 126, 0.1)',
  background: 'rgba(212, 184, 126, 0.035)',
  color: '#f1e8d5',
  cursor: 'pointer',
}

const mountedItemStyle = {
  background: 'rgba(133, 170, 117, 0.08)',
  border: '1px solid rgba(133, 170, 117, 0.22)',
}

const listItemIdStyle = {
  fontFamily: 'Consolas, monospace',
  fontSize: 11,
  color: '#c29e61',
}

const listItemTitleStyle = {
  marginTop: 6,
  fontSize: 13,
  lineHeight: 1.55,
}

const paginationStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 14px 16px',
  borderTop: '1px solid rgba(212, 184, 126, 0.08)',
}

const pagerBtnStyle = {
  padding: '7px 12px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.18)',
  background: 'rgba(212, 184, 126, 0.06)',
  color: '#f1e8d5',
  cursor: 'pointer',
}

const stageHeaderStyle = {
  padding: '18px 18px 12px',
  borderBottom: '1px solid rgba(212, 184, 126, 0.08)',
}

const stageTitleStyle = {
  fontSize: 18,
  fontWeight: 700,
}

const stageHintStyle = {
  marginTop: 6,
  fontSize: 12,
  color: 'rgba(241, 232, 213, 0.62)',
}

const canvasFrameStyle = {
  minHeight: 0,
  padding: 10,
}

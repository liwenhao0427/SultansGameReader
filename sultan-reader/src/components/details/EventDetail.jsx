import { useState, useEffect } from 'react'
import { useResolvedImage } from '../../services/imageResolver'
import { parseConditionObject } from '../../services/conditionParser'

// 每页显示的 settlement 条目数
const PAGE_SIZE = 20

// 样式常量
const S = {
  wrap: { padding: 0 },
  title: { color: '#89b4fa', fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  comment: { color: '#a6adc8', fontSize: 11, marginBottom: 8 },
  section: { marginBottom: 12 },
  sectionTitle: { color: '#89b4fa', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  condTag: { color: '#f9e2af', fontSize: 11, display: 'block', lineHeight: '1.6' },
  settlementBox: { background: '#181825', borderRadius: 4, padding: '8px 10px', marginBottom: 8 },
  label: { color: '#a6adc8', fontSize: 11, marginRight: 4 },
  text: { color: '#cdd6f4', fontSize: 13, lineHeight: '1.6', whiteSpace: 'pre-wrap' },
  tag: { display: 'inline-block', background: '#313244', color: '#cba6f7', fontSize: 11, borderRadius: 3, padding: '1px 6px', marginRight: 4, marginBottom: 4 },
  idList: { color: '#a6adc8', fontSize: 11 },
  img: { maxWidth: '100%', borderRadius: 4, marginTop: 6 },
  imgPlaceholder: { width: 80, height: 80, background: '#313244', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#585b70', fontSize: 11, marginTop: 6 },
}

/** 图片组件，带占位 */
function ResolvedImage({ pic }) {
  const { url, loading } = useResolvedImage(pic)
  if (!pic) return null
  if (loading) return <div style={S.imgPlaceholder}>加载中…</div>
  if (!url) return <div style={S.imgPlaceholder}>无图片</div>
  return <img src={url} alt="" style={S.img} />
}

/** 渲染 action 中的关联 ID */
function ActionIds({ action, branch }) {
  if (!action) return null
  const branchData = action[branch]
  if (!branchData) return null
  const ids = []
  for (const [k, v] of Object.entries(branchData)) {
    if (k.endsWith('__c') || k.endsWith('__ca')) continue
    const vals = Array.isArray(v) ? v : [v]
    ids.push(...vals.map(id => `${k}:${id}`))
  }
  if (!ids.length) return null
  return (
    <div style={S.idList}>
      <span style={S.label}>{branch === 'success' ? '✓' : '✗'}</span>
      {ids.join('  ')}
    </div>
  )
}

/** 单个 settlement 条目 */
function SettlementItem({ item }) {
  const action = item.action || {}
  // 交互类型检测
  const interactType = action.confirm ? 'confirm' : action.option ? 'option' : action.slide ? 'slide' : action.prompt ? 'prompt' : null
  // 图片：slide.pics 或 icon
  const pics = action.slide?.pics || (action.confirm?.icon ? [].concat(action.confirm.icon) : [])
  const conditions = parseConditionObject(item.condition)

  return (
    <div style={S.settlementBox}>
      {/* 注释标题 */}
      {item.__ca && <div style={{ color: '#89b4fa', fontSize: 11, marginBottom: 2 }}>{item.__ca}</div>}
      {item.__c && <div style={S.comment}>{item.__c}</div>}

      {/* 交互类型标签 */}
      {interactType && <span style={S.tag}>{interactType}</span>}

      {/* 触发条件 */}
      {conditions.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          {conditions.map((c, i) => <span key={i} style={S.condTag}>{c}</span>)}
        </div>
      )}

      {/* 结果文本 */}
      {(item.result_text || item.tips_text) && (
        <div style={{ ...S.text, fontSize: 12, marginBottom: 4 }}>
          {item.result_text || item.tips_text}
        </div>
      )}

      {/* success/failed 关联 */}
      <ActionIds action={action} branch="success" />
      <ActionIds action={action} branch="failed" />

      {/* 图片 */}
      {pics.filter(Boolean).map((p, i) => <ResolvedImage key={i} pic={p} />)}
    </div>
  )
}

/**
 * EventDetail — 事件详情组件
 * @param {{ data: object }} props
 */
export default function EventDetail({ data }) {
  // 当前页码（从 0 开始）
  const [page, setPage] = useState(0)

  // data 变化时重置页码
  useEffect(() => { setPage(0) }, [data])

  if (!data) return null
  const conditions = parseConditionObject(data.condition)
  const settlements = Array.isArray(data.settlement) ? data.settlement : []

  // 是否需要分页（条目数超过 PAGE_SIZE 才显示分页控件）
  const needPaging = settlements.length > PAGE_SIZE
  const totalPages = needPaging ? Math.ceil(settlements.length / PAGE_SIZE) : 1
  const pageSettlements = needPaging
    ? settlements.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : settlements

  // 切换页面时滚动到顶部
  const handlePageChange = (newPage) => {
    setPage(newPage)
    window.scrollTo(0, 0)
  }

  return (
    <div style={S.wrap}>
      {/* 标题 */}
      <div style={S.title}>{data.text || `事件 ${data.id}`}</div>
      {data.text__c && <div style={S.comment}>{data.text__c}</div>}

      {/* 触发条件 */}
      {conditions.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>触发条件</div>
          {conditions.map((c, i) => <span key={i} style={S.condTag}>{c}</span>)}
        </div>
      )}

      {/* settlement 列表 */}
      {settlements.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>结算条目（{settlements.length}）</div>
          {pageSettlements.map((s, i) => <SettlementItem key={i} item={s} />)}

          {/* 分页控件（条目数 > PAGE_SIZE 时显示） */}
          {needPaging && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, justifyContent: 'center' }}>
              <button disabled={page === 0} onClick={() => handlePageChange(page - 1)}>上一页</button>
              <span>{page + 1} / {totalPages}</span>
              <button disabled={page === totalPages - 1} onClick={() => handlePageChange(page + 1)}>下一页</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

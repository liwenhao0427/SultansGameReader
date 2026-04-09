import { parseConditionObject } from '../../services/conditionParser'

const S = {
  title: { color: '#89b4fa', fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  text: { color: '#cdd6f4', fontSize: 13, lineHeight: '1.6', whiteSpace: 'pre-wrap', marginBottom: 8 },
  sectionTitle: { color: '#89b4fa', fontSize: 12, fontWeight: 'bold', margin: '10px 0 4px' },
  phaseBox: { background: '#181825', borderRadius: 4, padding: '8px 10px', marginBottom: 6 },
  phaseTitle: { color: '#cba6f7', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  condTag: { color: '#f9e2af', fontSize: 11, display: 'block', lineHeight: '1.6' },
  resultText: { color: '#cdd6f4', fontSize: 12, lineHeight: '1.6', whiteSpace: 'pre-wrap', marginTop: 4 },
  actionText: { color: '#a6adc8', fontSize: 11, marginTop: 4 },
  comment: { color: '#a6adc8', fontSize: 11, marginBottom: 6 },
}

/** 渲染单个结算阶段条目 */
function PhaseItem({ item, index }) {
  const conditions = parseConditionObject(item.condition)
  // 提取 action 中的关联动作（简单显示 key:value）
  const actionEntries = item.action
    ? Object.entries(item.action).filter(([k]) => !k.endsWith('__c') && !k.endsWith('__ca'))
    : []

  return (
    <div style={S.phaseBox}>
      {item.__ca && <div style={{ color: '#89b4fa', fontSize: 11, marginBottom: 2 }}>{item.__ca}</div>}
      {item.result_title && <div style={{ color: '#cba6f7', fontSize: 12, fontWeight: 'bold' }}>{item.result_title}</div>}

      {/* 条件 */}
      {conditions.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          {conditions.map((c, i) => <span key={i} style={S.condTag}>{c}</span>)}
        </div>
      )}

      {/* 结果文本 */}
      {item.result_text && <div style={S.resultText}>{item.result_text}</div>}

      {/* 关联动作 */}
      {actionEntries.length > 0 && (
        <div style={S.actionText}>
          {actionEntries.map(([k, v]) => (
            <span key={k} style={{ marginRight: 8 }}>
              {k}: {Array.isArray(v) ? v.join(', ') : String(v)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** 渲染一个结算阶段数组 */
function PhaseSection({ title, items }) {
  if (!items || items.length === 0) return null
  return (
    <div>
      <div style={S.sectionTitle}>{title}（{items.length}）</div>
      {items.map((item, i) => <PhaseItem key={i} item={item} index={i} />)}
    </div>
  )
}

/**
 * RiteDetail — 仪式详情组件
 * @param {{ data: object }} props
 */
export default function RiteDetail({ data }) {
  if (!data) return null

  return (
    <div>
      {/* 名称和描述 */}
      <div style={S.title}>{data.name || `仪式 ${data.id}`}</div>
      {data.text && <div style={S.text}>{data.text}</div>}
      {data.location && <div style={S.comment}>地点：{data.location}</div>}

      {/* 三个结算阶段 */}
      <PhaseSection title="前置结算（settlement_prior）" items={data.settlement_prior} />
      <PhaseSection title="主结算（settlement）" items={data.settlement} />
      <PhaseSection title="额外结算（settlement_extre）" items={data.settlement_extre} />
    </div>
  )
}

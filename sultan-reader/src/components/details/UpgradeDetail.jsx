import { parseConditionObject } from '../../services/conditionParser'

const S = {
  title: { color: '#89b4fa', fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  text: { color: '#cdd6f4', fontSize: 13, lineHeight: '1.6', whiteSpace: 'pre-wrap', marginBottom: 8 },
  sectionTitle: { color: '#89b4fa', fontSize: 12, fontWeight: 'bold', marginBottom: 4, marginTop: 8 },
  condTag: { color: '#f9e2af', fontSize: 11, display: 'block', lineHeight: '1.6' },
  effectBox: { background: '#181825', borderRadius: 4, padding: '6px 10px', marginBottom: 6 },
  effectRow: { color: '#cdd6f4', fontSize: 12, lineHeight: '1.8' },
  linkCard: { color: '#a6adc8', fontSize: 12, marginTop: 6 },
  comment: { color: '#a6adc8', fontSize: 11, marginBottom: 6 },
}

/**
 * UpgradeDetail — 升级详情组件
 * @param {{ data: object }} props
 */
export default function UpgradeDetail({ data }) {
  if (!data) return null

  const conditions = parseConditionObject(data.condition)

  // 解析 effect 对象为可读行
  const effectEntries = data.effect && typeof data.effect === 'object'
    ? Object.entries(data.effect).filter(([k]) => !k.endsWith('__c') && !k.endsWith('__ca'))
    : []

  return (
    <div>
      {/* 名称 */}
      <div style={S.title}>{data.name || `升级 ${data.id}`}</div>

      {/* 描述 */}
      {data.text && <div style={S.text}>{data.text}</div>}

      {/* 触发条件 */}
      {conditions.length > 0 && (
        <div>
          <div style={S.sectionTitle}>条件</div>
          {conditions.map((c, i) => <span key={i} style={S.condTag}>{c}</span>)}
        </div>
      )}

      {/* 效果 */}
      {effectEntries.length > 0 && (
        <div>
          <div style={S.sectionTitle}>效果</div>
          <div style={S.effectBox}>
            {effectEntries.map(([k, v]) => (
              <div key={k} style={S.effectRow}>
                <span style={{ color: '#a6adc8', fontSize: 11 }}>{k}：</span>
                {Array.isArray(v) ? v.join(', ') : String(v)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 关联卡牌 */}
      {data.link_card && (
        <div style={S.linkCard}>
          关联卡牌：{data.link_card}
          {data.link_card__c && <span style={{ color: '#585b70', marginLeft: 4 }}>（{data.link_card__c}）</span>}
        </div>
      )}
    </div>
  )
}

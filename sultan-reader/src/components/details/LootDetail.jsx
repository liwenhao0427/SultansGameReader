const S = {
  title: { color: '#89b4fa', fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  typeRow: { marginBottom: 8 },
  typeLabel: { color: '#a6adc8', fontSize: 11 },
  typeComment: { color: '#a6adc8', fontSize: 11, marginLeft: 6 },
  sectionTitle: { color: '#89b4fa', fontSize: 12, fontWeight: 'bold', marginBottom: 6 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { color: '#a6adc8', textAlign: 'left', padding: '3px 6px', borderBottom: '1px solid #313244', fontSize: 11 },
  td: { color: '#cdd6f4', padding: '4px 6px', borderBottom: '1px solid #181825' },
  tdMuted: { color: '#a6adc8', padding: '4px 6px', borderBottom: '1px solid #181825', fontSize: 11 },
}

/**
 * LootDetail — 战利品详情组件
 * @param {{ data: object }} props
 */
export default function LootDetail({ data }) {
  if (!data) return null

  const items = Array.isArray(data.item) ? data.item : []

  return (
    <div>
      {/* 名称 */}
      <div style={S.title}>{data.name || `战利品 ${data.id}`}</div>

      {/* 类型 */}
      {data.type !== undefined && (
        <div style={S.typeRow}>
          <span style={S.typeLabel}>类型：{data.type}</span>
          {data.type__c && <span style={S.typeComment}>（{data.type__c}）</span>}
        </div>
      )}

      {/* 物品列表 */}
      {items.length > 0 && (
        <div>
          <div style={S.sectionTitle}>物品列表（{items.length}）</div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>ID</th>
                <th style={S.th}>类型</th>
                <th style={S.th}>数量</th>
                <th style={S.th}>权重</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td style={S.td}>{item.id}</td>
                  <td style={S.tdMuted}>{item.type}</td>
                  <td style={S.td}>{item.num}</td>
                  <td style={S.tdMuted}>{item.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

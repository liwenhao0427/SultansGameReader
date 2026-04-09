const S = {
  sectionTitle: { color: '#89b4fa', fontSize: 13, fontWeight: 'bold', marginBottom: 6, borderLeft: '3px solid #89b4fa', paddingLeft: 6 },
  entryBox: { background: '#181825', borderRadius: 4, padding: '8px 10px', marginBottom: 8 },
  keyLabel: { color: '#a6adc8', fontSize: 11, marginBottom: 2 },
  name: { color: '#89b4fa', fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  subName: { color: '#a6adc8', fontSize: 11, marginBottom: 4 },
  text: { color: '#cdd6f4', fontSize: 12, lineHeight: '1.6', whiteSpace: 'pre-wrap' },
}

/**
 * OverDetail — 结局详情组件
 * over.json 是一个以数字 key 为索引的对象，每个 key 对应一个结局
 * @param {{ data: object }} props
 */
export default function OverDetail({ data }) {
  if (!data) return null

  // 遍历对象的所有 key，显示每个结局条目
  const entries = Object.entries(data).filter(([k]) =>
    !k.startsWith('_') // 跳过元数据字段
  )

  return (
    <div>
      <div style={S.sectionTitle}>结局列表（{entries.length}）</div>
      {entries.map(([key, over]) => {
        if (typeof over !== 'object' || !over) return null
        return (
          <div key={key} style={S.entryBox}>
            <div style={S.keyLabel}>#{key}</div>
            {over.name && <div style={S.name}>{over.name}</div>}
            {over.sub_name && <div style={S.subName}>{over.sub_name}</div>}
            {over.text && <div style={S.text}>{over.text}</div>}
          </div>
        )
      })}
    </div>
  )
}

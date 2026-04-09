const S = {
  title: { color: '#89b4fa', fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
  desc: { color: '#a6adc8', fontSize: 12, marginBottom: 10 },
  sectionTitle: { color: '#89b4fa', fontSize: 12, fontWeight: 'bold', marginBottom: 6 },
  itemBox: { background: '#181825', borderRadius: 4, padding: '8px 10px', marginBottom: 6 },
  wordId: { color: '#a6adc8', fontSize: 11, marginBottom: 2 },
  word: { color: '#cdd6f4', fontSize: 13, lineHeight: '1.6', whiteSpace: 'pre-wrap', marginBottom: 4 },
  jumpType: { display: 'inline-block', background: '#313244', color: '#cba6f7', fontSize: 11, borderRadius: 3, padding: '1px 6px', marginBottom: 4 },
  optionBox: { marginTop: 4, paddingLeft: 8, borderLeft: '2px solid #313244' },
  optionItem: { color: '#a6adc8', fontSize: 11, lineHeight: '1.8' },
}

// jump_type 含义映射
const JUMP_TYPE_MAP = {
  '0': '直接跳转',
  '1': '选项分支',
  '2': '条件跳转',
  '3': '结束',
}

/**
 * DTDetail — 对话树详情组件
 * @param {{ data: object }} props
 */
export default function DTDetail({ data }) {
  if (!data) return null

  const items = Array.isArray(data.Item) ? data.Item : []

  return (
    <div>
      {/* 对话树 ID 和描述 */}
      <div style={S.title}>{data.dialog_tree_id}</div>
      {data.description && <div style={S.desc}>{data.description}</div>}

      {/* 对话条目列表 */}
      <div style={S.sectionTitle}>对话条目（{items.length}）</div>
      {items.map((item, i) => {
        const jumpLabel = JUMP_TYPE_MAP[item.jump_type] || item.jump_type
        const options = Array.isArray(item.Option) ? item.Option : []

        return (
          <div key={i} style={S.itemBox}>
            {/* word_id */}
            <div style={S.wordId}>{item.word_id}</div>

            {/* 对话内容 */}
            {item.word && <div style={S.word}>{item.word}</div>}

            {/* 跳转类型 */}
            <span style={S.jumpType}>{jumpLabel}</span>
            {item.direct_id && (
              <span style={{ color: '#a6adc8', fontSize: 11, marginLeft: 6 }}>→ {item.direct_id}</span>
            )}

            {/* 选项列表 */}
            {options.length > 0 && (
              <div style={S.optionBox}>
                {options.map((opt, oi) => (
                  <div key={oi} style={S.optionItem}>
                    [{opt.option_Jump_id}] {opt.option_Jump_word}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

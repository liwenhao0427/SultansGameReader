import { useEffect, useMemo, useState } from 'react'

const S = {
  title: { color: '#89b4fa', fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
  desc: { color: '#a6adc8', fontSize: 12, marginBottom: 12 },
  sectionTitle: { color: '#89b4fa', fontSize: 12, fontWeight: 'bold', marginBottom: 8 },
  hint: { color: '#a6adc8', fontSize: 11, lineHeight: '1.7', marginBottom: 12 },
  itemBox: {
    background: 'linear-gradient(180deg, rgba(24, 24, 37, 0.96) 0%, rgba(20, 20, 32, 0.98) 100%)',
    borderRadius: 10,
    padding: '12px 14px',
    marginBottom: 10,
    border: '1px solid rgba(137, 180, 250, 0.08)',
  },
  activeItemBox: {
    border: '1px solid rgba(203, 166, 247, 0.34)',
    boxShadow: '0 0 0 1px rgba(203, 166, 247, 0.08) inset',
  },
  wordId: { color: '#a6adc8', fontSize: 11, marginBottom: 4 },
  word: { color: '#cdd6f4', fontSize: 14, lineHeight: '1.7', whiteSpace: 'pre-wrap', marginBottom: 8 },
  jumpType: {
    display: 'inline-block',
    background: '#313244',
    color: '#cba6f7',
    fontSize: 11,
    borderRadius: 999,
    padding: '2px 8px',
    marginBottom: 6,
  },
  directId: { color: '#a6adc8', fontSize: 11, marginLeft: 8 },
  optionBox: { marginTop: 10, display: 'grid', gap: 8 },
  optionButton: {
    width: '100%',
    textAlign: 'left',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(166, 173, 200, 0.16)',
    background: 'rgba(49, 50, 68, 0.42)',
    color: '#cdd6f4',
    cursor: 'pointer',
    transition: 'all 120ms ease',
  },
  activeOptionButton: {
    border: '1px solid rgba(203, 166, 247, 0.46)',
    background: 'rgba(90, 74, 120, 0.34)',
    color: '#f5eaff',
  },
  optionId: { color: '#a6adc8', fontSize: 11, marginBottom: 2 },
  optionText: { fontSize: 13, lineHeight: '1.6' },
  endHint: { color: '#cba6f7', fontSize: 11, marginTop: 10 },
  empty: {
    color: '#a6adc8',
    fontSize: 12,
    lineHeight: '1.8',
    padding: '14px 0',
  },
}

export const JUMP_TYPE_MAP = {
  '0': '直接跳转',
  '1': '选项分支',
  '2': '条件跳转',
  '3': '结束',
}

export function buildDialogueItemMap(items) {
  return items.reduce((map, item) => {
    if (item?.word_id) {
      map[item.word_id] = item
    }
    return map
  }, {})
}

export function resolveDialogueStartId(data, itemMap) {
  if (data?.first_word_id && itemMap[data.first_word_id]) {
    return data.first_word_id
  }

  const firstItemId = Array.isArray(data?.Item) ? data.Item.find((item) => item?.word_id)?.word_id : ''
  return firstItemId || ''
}

export function buildDialogueVisiblePath(data, selectedOptions = {}) {
  const items = Array.isArray(data?.Item) ? data.Item : []
  const itemMap = buildDialogueItemMap(items)
  const startId = resolveDialogueStartId(data, itemMap)

  if (!startId || !itemMap[startId]) {
    return []
  }

  const path = []
  const visited = new Set()
  let currentId = startId

  while (currentId && itemMap[currentId] && !visited.has(currentId)) {
    visited.add(currentId)
    const item = itemMap[currentId]
    path.push(item)

    if (item.jump_type === '1') {
      const selectedTargetId = selectedOptions[item.word_id]
      if (!selectedTargetId || !itemMap[selectedTargetId]) {
        break
      }
      currentId = selectedTargetId
      continue
    }

    if (item.direct_id && itemMap[item.direct_id]) {
      currentId = item.direct_id
      continue
    }

    break
  }

  return path
}

function getDefaultSelectedOptions(data) {
  const items = Array.isArray(data?.Item) ? data.Item : []

  return items.reduce((result, item) => {
    const options = Array.isArray(item?.Option) ? item.Option : []
    if (item?.jump_type === '1' && options.length > 0) {
      const firstTargetId = options.find((option) => option?.option_Jump_id)?.option_Jump_id
      if (firstTargetId) {
        result[item.word_id] = firstTargetId
      }
    }
    return result
  }, {})
}

/**
 * DTDetail - 对话树详情组件
 * 按当前选择逐层展开对话，允许回切之前的选项并即时刷新后续内容。
 */
export default function DTDetail({ data }) {
  const items = Array.isArray(data?.Item) ? data.Item : []
  const [selectedOptions, setSelectedOptions] = useState(() => getDefaultSelectedOptions(data))

  useEffect(() => {
    setSelectedOptions(getDefaultSelectedOptions(data))
  }, [data])

  const visiblePath = useMemo(() => buildDialogueVisiblePath(data, selectedOptions), [data, selectedOptions])

  if (!data) return null

  if (items.length === 0) {
    return <div style={S.empty}>这个对话树没有可展示的对话条目。</div>
  }

  return (
    <div>
      <div style={S.title}>{data.dialog_tree_id}</div>
      {data.description && <div style={S.desc}>{data.description}</div>}

      <div style={S.sectionTitle}>对话展开</div>
      <div style={S.hint}>
        先显示起始对话，遇到可选分支时由你决定后续展开方向。
        你可以随时改选之前的任一选项，下面的后续内容会立刻按新路径重算。
      </div>

      {visiblePath.map((item, index) => {
        const jumpLabel = JUMP_TYPE_MAP[item.jump_type] || item.jump_type || '未知'
        const options = Array.isArray(item.Option) ? item.Option : []
        const selectedTargetId = selectedOptions[item.word_id]
        const isActiveBranch = item.jump_type === '1'
        const itemStyle = isActiveBranch ? { ...S.itemBox, ...S.activeItemBox } : S.itemBox

        return (
          <div key={item.word_id || index} style={itemStyle}>
            <div style={S.wordId}>{item.word_id}</div>
            {item.word && <div style={S.word}>{item.word}</div>}

            <div>
              <span style={S.jumpType}>{jumpLabel}</span>
              {!isActiveBranch && item.direct_id && (
                <span style={S.directId}>自动前往 {item.direct_id}</span>
              )}
            </div>

            {options.length > 0 && (
              <div style={S.optionBox}>
                {options.map((option) => {
                  const isSelected = option.option_Jump_id === selectedTargetId
                  return (
                    <button
                      key={`${item.word_id}:${option.option_Jump_id}:${option.option_Jump_word}`}
                      type="button"
                      style={isSelected ? { ...S.optionButton, ...S.activeOptionButton } : S.optionButton}
                      onClick={() => {
                        setSelectedOptions((current) => ({
                          ...current,
                          [item.word_id]: option.option_Jump_id,
                        }))
                      }}
                    >
                      <div style={S.optionId}>{option.option_Jump_id}</div>
                      <div style={S.optionText}>{option.option_Jump_word || '未命名选项'}</div>
                    </button>
                  )
                })}
              </div>
            )}

            {item.jump_type === '3' && <div style={S.endHint}>当前路径在这里结束。</div>}
          </div>
        )
      })}
    </div>
  )
}

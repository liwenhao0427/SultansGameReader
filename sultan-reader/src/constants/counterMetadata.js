export const BUILTIN_COUNTER_LABELS = {
  '7100001': '善名',
  '7100002': '恶名',
  '7100003': '权势',
  '7100004': '侠名',
  '7100005': '灵视',
  '7100006': '金骰子次数',
  '7100007': '回到上一回合次数',
  '7100008': '每七天重抽次数',
}

export function resolveCounterLabel(id, fallback = '') {
  const normalizedId = String(id)
  return BUILTIN_COUNTER_LABELS[normalizedId] || fallback || `计数器 ${normalizedId}`
}

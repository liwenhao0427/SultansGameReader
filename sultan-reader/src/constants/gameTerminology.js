export const CONTENT_TYPE_LABELS = {
  rite: '仪式',
  event: '幕后',
  loot: '掉落池',
  over: '结局',
  after_story: '后日谈',
  card: '卡牌',
  dt: '对话树',
  upgrade: '升级',
}

export function getContentTypeLabel(type) {
  return CONTENT_TYPE_LABELS[type] || type
}

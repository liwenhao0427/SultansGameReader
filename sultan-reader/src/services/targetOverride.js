/**
 * 展示层目标节点覆盖规则。
 * 只在阅读器里改“打开到哪里 / 显示成什么类型”，不改 cache 原始数据。
 */

const TARGET_OVERRIDE_RULES = [
  {
    sourceType: 'event',
    sourceId: '5300066',
    targetType: 'event',
    targetId: '5310008',
    replacement: {
      targetType: 'rite',
      targetId: '5000002',
    },
  },
]

export function applyTargetOverride(sourceType, sourceId, targetType, targetId) {
  const normalizedSourceId = String(sourceId || '')
  const normalizedTargetId = String(targetId || '')
  const matchedRule = TARGET_OVERRIDE_RULES.find((rule) => (
    rule.sourceType === sourceType &&
    rule.sourceId === normalizedSourceId &&
    rule.targetType === targetType &&
    rule.targetId === normalizedTargetId
  ))

  if (!matchedRule) {
    return {
      targetType,
      targetId: normalizedTargetId,
    }
  }

  return {
    targetType: matchedRule.replacement.targetType,
    targetId: matchedRule.replacement.targetId,
  }
}

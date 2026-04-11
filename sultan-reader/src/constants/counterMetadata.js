import { GENERATED_COUNTER_LABELS } from './generatedCounterLabels'

/**
 * 计数器展示名映射。
 * 统一使用离线生成的代码映射，避免运行时直接读取文档目录。
 */
export const BUILTIN_COUNTER_LABELS = GENERATED_COUNTER_LABELS

export function resolveCounterLabel(id, fallback = '') {
  const normalizedId = String(id)
  return BUILTIN_COUNTER_LABELS[normalizedId] || fallback || `计数器 ${normalizedId}`
}

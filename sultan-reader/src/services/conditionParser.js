/**
 * 条件与结果解析工具
 * 负责把配置里的 key/value 表达式转成更适合阅读的中文文本。
 */

import { resolveCounterLabel } from '../constants/counterMetadata'
import { getContentTypeLabel } from '../constants/gameTerminology'

const COMMENT_SUFFIXES = ['__c', '__ca', '__ci']
const SLOT_RE = /^s\d+$/i
const NUMBER_ID_RE = /^\d{6,}$/

function resolveCardName(id, cardsMap) {
  return (cardsMap && cardsMap.get(String(id))) || String(id)
}

function resolveCardDisplayByValue(value, cardsMap) {
  const raw = String(value ?? '').trim()
  if (!NUMBER_ID_RE.test(raw)) return null
  if (!cardsMap?.has(raw)) return null
  return `${cardsMap.get(raw)}（${raw}）`
}

function formatEffectValue(value, cardsMap) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const resolved = resolveCardDisplayByValue(item, cardsMap)
        return resolved || String(item)
      })
      .join(' / ')
  }

  const resolved = resolveCardDisplayByValue(value, cardsMap)
  return resolved || String(value)
}

function getComment(source, key) {
  if (!source || typeof source !== 'object') return null
  return source[`${key}__c`] || source[`${key}__ca`] || source[`${key}__ci`] || null
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeArray(value) {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function formatComparator(operator, value) {
  switch (operator) {
    case '>=':
      return `≥ ${value}`
    case '<=':
      return `≤ ${value}`
    case '>':
      return `> ${value}`
    case '<':
      return `< ${value}`
    case '=':
      return `= ${value}`
    default:
      return `≥ ${value}`
  }
}

function splitOperator(raw) {
  const match = String(raw).match(/^(.*?)(>=|<=|>|<|=)?$/)
  return {
    target: match?.[1] || String(raw),
    operator: match?.[2] || '>=',
  }
}

function formatTypeName(type) {
  if (!type) return '未知类型'
  return String(type)
}

function formatSelectorToken(token, cardsMap) {
  if (token == null || token === '') return ''
  if (NUMBER_ID_RE.test(String(token))) return resolveCardName(token, cardsMap)
  if (['char', 'item', 'sudan'].includes(String(token))) return `${token} 类型`
  return String(token)
}

function formatSelector(selector, cardsMap) {
  const { target, operator } = splitOperator(selector)
  const parts = String(target).split('.').filter(Boolean)
  if (parts.length === 0) return String(selector)

  const [head, ...rest] = parts
  const rendered = [formatSelectorToken(head, cardsMap), ...rest.map((part) => formatSelectorToken(part, cardsMap))]
    .filter(Boolean)
    .join(' / ')

  if (operator && operator !== '>=') {
    return `${rendered}（条件 ${operator}）`
  }

  return rendered
}

function formatScopedExistence(scopeLabel, selector, value, cardsMap, negate = false) {
  const { target, operator } = splitOperator(selector)
  const label = formatSelector(target, cardsMap)
  const compareText = formatComparator(operator, value)
  return `${scopeLabel}${negate ? '不存在' : '存在'} ${label}（${compareText}）`
}

function formatSlotSelector(slotId, selector, value, cardsMap, negate = false) {
  if (!selector) {
    return `${slotId.toUpperCase()}${negate ? ' 为空' : ' 非空'}`
  }

  if (selector === 'is') {
    const cards = normalizeArray(value).map((item) => resolveCardName(item, cardsMap)).join(' / ')
    return `${slotId.toUpperCase()}${negate ? ' 不是' : ' 是'} ${cards}`
  }

  if (selector === 'type') {
    return `${slotId.toUpperCase()}${negate ? ' 不是' : ' 是'} ${formatTypeName(value)}`
  }

  const { target, operator } = splitOperator(selector)
  return `${slotId.toUpperCase()}${negate ? ' 不满足' : ' 满足'} ${formatSelector(target, cardsMap)}（${formatComparator(operator, value)}）`
}

function formatFormulaCondition(prefix, expression, operator, value) {
  if (Array.isArray(value)) {
    const [successCount, diceFace] = value
    return `${prefix}${expression}（成功数 ${formatComparator(operator, successCount)}，面值 ${diceFace}）`
  }
  return `${prefix}${expression}（${formatComparator(operator, value)}）`
}

function formatNestedEffect(label, value, cardsMap) {
  if (!isPlainObject(value)) return label
  const nested = parseEffectObject(value, cardsMap)
  if (nested.length === 0) return label
  return `${label}：${nested.join('；')}`
}

function formatCardTarget(rawTarget, cardsMap) {
  const text = String(rawTarget)
  if (text.startsWith('table.')) return `闲置卡牌 ${formatSelector(text.slice('table.'.length), cardsMap)}`
  if (text.startsWith('total.')) return `场上卡牌 ${formatSelector(text.slice('total.'.length), cardsMap)}`
  if (SLOT_RE.test(text)) return `槽位 ${text.toUpperCase()}`
  if (NUMBER_ID_RE.test(text)) return resolveCardName(text, cardsMap)
  if (text === 'table') return '闲置卡牌'
  if (text === 'total') return '场上卡牌'
  return formatSelector(text, cardsMap)
}

function formatCardMutation(target, operator, tagName, value, cardsMap) {
  const actionMap = {
    '+': '增加',
    '-': '减少',
    '=': '设置为',
  }
  const action = actionMap[operator] || '变更'
  return `${formatCardTarget(target, cardsMap)} ${tagName}${action}${formatEffectValue(value, cardsMap)}`
}

function formatCardMutationKey(key, value, cardsMap) {
  let match = key.match(/^(s\d+)\+(s\d+)$/i)
  if (match) {
    return `将 ${match[2].toUpperCase()} 的卡牌装备到 ${match[1].toUpperCase()}`
  }

  match = key.match(/^loot\.(.+)$/)
  if (match) {
    return `触发掉落池 ${formatEffectValue(value, cardsMap)}，并附加 ${match[1]}`
  }

  match = key.match(/^(table\.[^=+\-]+|total\.[^=+\-]+|s\d+|\d+)([=+\-])(.+)$/)
  if (match) {
    return formatCardMutation(match[1], match[2], match[3], value, cardsMap)
  }

  match = key.match(/^(table\.clean)\.(.+)$/)
  if (match) {
    return `移除闲置卡牌 ${formatSelector(match[2], cardsMap)}（数量 ${value}）`
  }

  match = key.match(/^(rebirth)\.(.+)$/)
  if (match) {
    return `重置 ${formatCardTarget(match[2], cardsMap)} 的生命周期`
  }

  match = key.match(/^(copy)\.(s\d+)$/)
  if (match) {
    return `复制 ${match[2].toUpperCase()} 的卡牌`
  }

  match = key.match(/^(clean)\.(.+)$/)
  if (match && match[2] !== 'rite') {
    return `移除 ${formatCardTarget(match[2], cardsMap)}（数量 ${value}）`
  }

  match = key.match(/^(table\.[^.]+|total\.[^.]+|s\d+|\d+)\.(uprare)$/)
  if (match) {
    const direction = Number(value) >= 0 ? `提升 ${value}` : `降低 ${Math.abs(Number(value))}`
    return `${formatCardTarget(match[1], cardsMap)} 品级${direction}`
  }

  match = key.match(/^(table\.[^.]+|total\.[^.]+|s\d+|\d+)([+\-~]equip)$/)
  if (match) {
    const verb = match[2] === '+equip' ? '装备' : match[2] === '-equip' ? '移除装备' : '卸下装备'
    return `${formatCardTarget(match[1], cardsMap)} ${verb} ${formatEffectValue(value, cardsMap)}`
  }

  match = key.match(/^(table\.[^.]+|total\.[^.]+|s\d+|\d+)([+\-]equip_slot)$/)
  if (match) {
    const verb = match[2] === '+equip_slot' ? '添加装备槽' : '移除装备槽'
    return `${formatCardTarget(match[1], cardsMap)} ${verb} ${formatEffectValue(value, cardsMap)}`
  }

  return null
}

/**
 * 解析单个条件。
 */
export function parseCondition(key, value, comment, cardsMap) {
  if (comment) return comment

  let match

  if ((match = key.match(/^(!)?(table_have|have|hand_have)\.(.+)$/))) {
    const scopeMap = {
      table_have: '闲置区',
      have: '场上',
      hand_have: '手牌区',
    }
    return formatScopedExistence(scopeMap[match[2]], match[3], value, cardsMap, Boolean(match[1]))
  }

  if ((match = key.match(/^(!)?rite$/))) {
    return `${match[1] ? '不存在' : '存在'} 仪式 ${formatEffectValue(value, cardsMap)}`
  }

  if ((match = key.match(/^(!)?(counter|global_counter)\.(\d+)(>=|<=|>|<|=)?$/))) {
    const prefix = match[2] === 'global_counter' ? '全局计数器' : '计数器'
    const label = resolveCounterLabel(match[3])
    return `${match[1] ? '不满足' : '满足'} ${prefix} ${label}（${match[3]}）${formatComparator(match[4] || '>=', value)}`
  }

  if ((match = key.match(/^(!)?(s\d+)(?:\.(.+))?$/i))) {
    return formatSlotSelector(match[2], match[3], value, cardsMap, Boolean(match[1]))
  }

  if (key === 'is' || key === '!is') {
    const values = normalizeArray(value)
      .map((item) => resolveCardName(item, cardsMap))
      .join(' / ')
    return `${key === '!is' ? '不存在' : '存在'} 卡牌 ${values}`
  }

  if (key === 'type' || key === '!type') {
    return `${key === '!type' ? '不存在' : '存在'} ${formatTypeName(value)}`
  }

  if ((match = key.match(/^r(\d+):(.+?)(>=|<=|>|<|=)$/))) {
    return formatFormulaCondition(`骰子检定 R${match[1]}：`, match[2], match[3], value)
  }

  if ((match = key.match(/^f:(.+?)(>=|<=|>|<|=)$/))) {
    return formatFormulaCondition('公式检定：', match[1], match[2], value)
  }

  if (key === 'is_rite') {
    return `当前参与仪式是 ${formatEffectValue(value, cardsMap)}`
  }

  if ((match = key.match(/^tag_tips\.(.+)$/))) {
    return `当前仪式检定 ${match[1]}`
  }

  if ((match = key.match(/^(parent|self)\.(.+)$/))) {
    const owner = match[1] === 'parent' ? '装备宿主' : '当前卡牌'
    const { target, operator } = splitOperator(match[2])
    return `${owner}满足 ${target}（${formatComparator(operator, value)}）`
  }

  const { target, operator } = splitOperator(key.replace(/^!/, ''))
  if (target && typeof value !== 'object') {
    return `${key.startsWith('!') ? '不满足' : '满足'} ${target}（${formatComparator(operator, value)}）`
  }

  return key
}

/**
 * 解析条件对象。
 */
export function parseConditionObject(conditionObj, cardsMap) {
  if (!conditionObj || typeof conditionObj !== 'object') return []

  const results = []

  for (const key of Object.keys(conditionObj)) {
    if (COMMENT_SUFFIXES.some((suffix) => key.endsWith(suffix))) continue

    const value = conditionObj[key]
    const comment = getComment(conditionObj, key)

    if (key === 'any' && value && typeof value === 'object') {
      const anyComment = getComment(conditionObj, 'any')
      if (anyComment) {
        results.push(anyComment)
      } else {
        const subConditions = Array.isArray(value)
          ? value.flatMap((item) => parseConditionObject(item, cardsMap))
          : parseConditionObject(value, cardsMap)
        if (subConditions.length > 0) {
          results.push(`满足任意一项：${subConditions.join('；')}`)
        }
      }
      continue
    }

    if (key === 'all' && value && typeof value === 'object') {
      const allComment = getComment(conditionObj, 'all')
      if (allComment) {
        results.push(allComment)
      } else {
        const subConditions = Array.isArray(value)
          ? value.flatMap((item) => parseConditionObject(item, cardsMap))
          : parseConditionObject(value, cardsMap)
        results.push(...subConditions)
      }
      continue
    }

    results.push(parseCondition(key, value, comment, cardsMap))
  }

  return results.filter(Boolean)
}

/**
 * 解析单个结果。
 */
export function parseEffect(key, value, comment, cardsMap) {
  if (comment) return comment

  let match

  if (key === 'card') {
    return `获得卡牌 ${formatEffectValue(value, cardsMap)}`
  }

  if (key === 'link_card') {
    return `关联卡牌 ${formatEffectValue(value, cardsMap)}`
  }

  if (key === 'rite') {
    return `生成仪式 ${formatEffectValue(value, cardsMap)}`
  }

  if (key === 'event_on') {
    return `激活幕后 ${formatEffectValue(value, cardsMap)}`
  }

  if (key === 'event_off') {
    return Number(value) === 1 ? '关闭所有已激活幕后' : `关闭幕后 ${formatEffectValue(value, cardsMap)}`
  }

  if (key === 'loot') {
    return `触发掉落池 ${formatEffectValue(value, cardsMap)}`
  }

  if (key === 'over') {
    return `触发结局 ${formatEffectValue(value, cardsMap)}`
  }

  if (key === 'prompt') {
    return '弹出提示'
  }

  if (key === 'option') {
    return '弹出选项'
  }

  if (key === 'change_name') {
    return Number(value) === 0 ? '打开改名弹框（主角）' : `打开改名弹框（${resolveCardName(value, cardsMap)}）`
  }

  if ((match = key.match(/^change_card_name\.(.+)\.(.+)$/))) {
    return `修改卡牌名称：${formatCardTarget(match[2], cardsMap)} -> ${formatEffectValue(value, cardsMap)}`
  }

  if ((match = key.match(/^change_card_text\.(.+)\.(.+)$/))) {
    return `修改卡牌描述：${formatCardTarget(match[2], cardsMap)}`
  }

  if ((match = key.match(/^change_rite_name\.(.+)\.(.+)$/))) {
    return `修改仪式名称：${match[2]} -> ${formatEffectValue(value, cardsMap)}`
  }

  if (key === 'no_prompt') {
    return formatNestedEffect('隐藏执行', value, cardsMap)
  }

  if (key === 'no_show') {
    return formatNestedEffect('隐藏结算表现', value, cardsMap)
  }

  if (key === 'success') {
    return formatNestedEffect('前一动作成功后', value, cardsMap)
  }

  if (key === 'failed') {
    return formatNestedEffect('前一动作失败后', value, cardsMap)
  }

  if (key === 'choose') {
    return formatNestedEffect('随机执行', value, cardsMap)
  }

  if (key === 'delay') {
    if (!isPlainObject(value)) return '延迟执行动作'
    const nested = Object.entries(value)
      .filter(([nestedKey]) => !COMMENT_SUFFIXES.some((suffix) => nestedKey.endsWith(suffix)) && nestedKey !== 'id' && nestedKey !== 'round')
      .map(([nestedKey, nestedValue]) => parseEffect(nestedKey, nestedValue, getComment(value, nestedKey), cardsMap))
      .filter(Boolean)
    const roundText = value.round != null ? `${value.round} 回合后` : '延迟后'
    return nested.length > 0 ? `${roundText}执行：${nested.join('；')}` : `${roundText}执行动作`
  }

  if ((match = key.match(/^global_counter([=+\-])(\d+)$/))) {
    const operatorMap = { '+': '+', '-': '-', '=': '=' }
    return `全局计数器 ${resolveCounterLabel(match[2])}（${match[2]}） ${operatorMap[match[1]]} ${formatEffectValue(value, cardsMap)}`
  }

  if ((match = key.match(/^counter([=+\-])(\d+)$/))) {
    const operatorMap = { '+': '+', '-': '-', '=': '=' }
    return `计数器 ${resolveCounterLabel(match[2])}（${match[2]}） ${operatorMap[match[1]]} ${formatEffectValue(value, cardsMap)}`
  }

  if (key === 'clean.rite') {
    return Number(value) === 1 ? '移除所有仪式' : `移除仪式 ${formatEffectValue(value, cardsMap)}`
  }

  const cardMutationText = formatCardMutationKey(key, value, cardsMap)
  if (cardMutationText) return cardMutationText

  if ((match = key.match(/^pop\.(.+)\.(.+)$/))) {
    return `显示角色气泡 ${match[2]}`
  }

  if ((match = key.match(/^hand_pop\.(.+)\.(.+)$/))) {
    return `显示手牌气泡 ${match[2]}`
  }

  if ((match = key.match(/^rite_pop\.(.+)\.(.+)$/))) {
    return `显示仪式气泡 ${match[2]}`
  }

  if (key === 'coin' || key === '金币') {
    return `获得金币 ${formatEffectValue(value, cardsMap)}`
  }

  return `${key} = ${formatEffectValue(value, cardsMap)}`
}

/**
 * 解析结果对象。
 */
export function parseEffectObject(effectObj, cardsMap) {
  if (!effectObj || typeof effectObj !== 'object') return []

  const results = []

  for (const key of Object.keys(effectObj)) {
    if (COMMENT_SUFFIXES.some((suffix) => key.endsWith(suffix))) continue

    const value = effectObj[key]
    if (value == null) continue

    const comment = getComment(effectObj, key)
    results.push(parseEffect(key, value, comment, cardsMap))
  }

  return results.filter(Boolean)
}

export function getTypeDisplayLabel(type) {
  return getContentTypeLabel(type)
}

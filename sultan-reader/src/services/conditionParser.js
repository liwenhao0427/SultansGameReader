/**
 * 条件与结果解析工具
 * 负责把配置里的 key/value 表达式转成更适合阅读的中文文本。
 */

const COMMENT_SUFFIXES = ['__c', '__ca', '__ci']

function resolveCardName(id, cardsMap) {
  return (cardsMap && cardsMap.get(String(id))) || String(id)
}

function getComment(source, key) {
  if (!source || typeof source !== 'object') return null
  return source[`${key}__c`] || source[`${key}__ca`] || source[`${key}__ci`] || null
}

function formatHaveTarget(target, cardsMap) {
  const parts = String(target).split('.').filter(Boolean)
  if (parts.length <= 1) return resolveCardName(target, cardsMap)

  const [cardId, ...rest] = parts
  return `${resolveCardName(cardId, cardsMap)}（${rest.join(' / ')}）`
}

/**
 * 解析单个条件。
 */
export function parseCondition(key, value, comment, cardsMap) {
  if (comment) return comment

  let match

  if ((match = key.match(/^have\.(.+)$/))) {
    return `拥有 ${formatHaveTarget(match[1], cardsMap)}`
  }

  if ((match = key.match(/^!have\.(.+)$/))) {
    return `没有 ${formatHaveTarget(match[1], cardsMap)}`
  }

  if ((match = key.match(/^counter\.(\d+)>=$/))) {
    return `计数器 ${match[1]} ≥ ${value}`
  }

  if ((match = key.match(/^counter\.(\d+)<$/))) {
    return Number(value) === 1
      ? `还没有：计数器 ${match[1]}`
      : `还没有达到：计数器 ${match[1]} < ${value}`
  }

  if ((match = key.match(/^counter\.(\d+)=$/))) {
    return `计数器 ${match[1]} = ${value}`
  }

  if ((match = key.match(/^table_have\.(.+)\.(.+)$/))) {
    return `表 ${match[1]} 存在 ${match[2]}`
  }

  if ((match = key.match(/^s(\d+)\.is$/))) {
    return `S${match[1]} 是 ${resolveCardName(value, cardsMap)}`
  }

  if (key === 'is') {
    const values = Array.isArray(value) ? value : [value]
    return `是 ${values.map((item) => resolveCardName(item, cardsMap)).join(' / ')}`
  }

  if (key === '!is') {
    const values = Array.isArray(value) ? value : [value]
    return `不是 ${values.map((item) => resolveCardName(item, cardsMap)).join(' / ')}`
  }

  if ((match = key.match(/^r(\d+):(.+)>=$/))) {
    return `检定 ${match[2]} ≥ ${value}`
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
        const subConditions = parseConditionObject(value, cardsMap)
        if (subConditions.length > 0) {
          results.push(`满足任意一项：${subConditions.join('，')}`)
        }
      }
      continue
    }

    if (key === 'all' && value && typeof value === 'object') {
      const allComment = getComment(conditionObj, 'all')
      if (allComment) {
        results.push(allComment)
      } else {
        const subConditions = parseConditionObject(value, cardsMap)
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

  if ((match = key.match(/^global_counter\+(\d+)$/))) {
    return `全局计数器 ${match[1]} + ${value}`
  }

  if ((match = key.match(/^global_counter=(\d+)$/))) {
    return `全局计数器 ${match[1]} = ${value}`
  }

  if ((match = key.match(/^counter\+(\d+)$/))) {
    return `计数器 ${match[1]} + ${value}`
  }

  if ((match = key.match(/^counter-(\d+)$/))) {
    return `计数器 ${match[1]} - ${value}`
  }

  if ((match = key.match(/^counter=(\d+)$/))) {
    return `计数器 ${match[1]} = ${value}`
  }

  if ((match = key.match(/^clean\.(s\d+)$/))) {
    return `清除卡槽 ${match[1].toUpperCase()}`
  }

  if ((match = key.match(/^s(\d+)\+(.+)$/))) {
    return `S${match[1]} ${match[2]} + ${value}`
  }

  if ((match = key.match(/^s(\d+)-(.+)$/))) {
    return Number(value) === 1
      ? `S${match[1]} 移除${match[2]}`
      : `S${match[1]} ${match[2]} - ${value}`
  }

  if ((match = key.match(/^s(\d+)=(.+)$/))) {
    return `S${match[1]} ${match[2]} = ${value}`
  }

  if ((match = key.match(/^have\.(.+)$/))) {
    return `获得 ${formatHaveTarget(match[1], cardsMap)}`
  }

  if ((match = key.match(/^!have\.(.+)$/))) {
    return `失去 ${formatHaveTarget(match[1], cardsMap)}`
  }

  return `${key} = ${String(value)}`
}

/**
 * 解析结果对象。
 */
export function parseEffectObject(effectObj, cardsMap) {
  if (!effectObj || typeof effectObj !== 'object') return []

  const results = []

  for (const key of Object.keys(effectObj)) {
    if (COMMENT_SUFFIXES.some((suffix) => key.endsWith(suffix))) continue
    if (key === 'choose' || key.startsWith('pop.')) continue

    const value = effectObj[key]
    if (value == null) continue

    const comment = getComment(effectObj, key)
    results.push(parseEffect(key, value, comment, cardsMap))
  }

  return results.filter(Boolean)
}

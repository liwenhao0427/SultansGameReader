const COMMENT_SUFFIXES = ['__c', '__ca', '__ci']

function cleanComment(text) {
  return String(text || '')
    .replace(/^[\s\-—─=]+|[\s\-—─=]+$/g, '')
    .trim()
}

function resolveCardName(token, cardsById) {
  const card = cardsById?.[String(token)]
  return card?.name || String(token)
}

function resolveSubject(token, cardsById) {
  if (/^\d+$/.test(String(token))) {
    return resolveCardName(token, cardsById)
  }
  return String(token)
}

function formatQualifier(parts) {
  if (!parts.length) return ''
  return `（${parts.join('.')}）`
}

function parseHaveCondition(key, cardsById) {
  const isNegative = key.startsWith('!have.')
  const body = key.replace(/^!have\.|^have\./, '')
  const [subject, ...qualifiers] = body.split('.')
  const resolved = `${resolveSubject(subject, cardsById)}${formatQualifier(qualifiers)}`
  return `${isNegative ? '没有' : '拥有'} ${resolved}`
}

function parseCounterCondition(key, value) {
  const match = key.match(/^counter\.(.+?)(>=|<=|>|<|=)$/)
  if (!match) return `${key}: ${value}`
  return `计数器 ${match[1]} ${match[2]} ${value}`
}

function parseFallbackCondition(key, value, cardsById) {
  if (key.startsWith('have.') || key.startsWith('!have.')) {
    return parseHaveCondition(key, cardsById)
  }

  if (key.startsWith('counter.')) {
    return parseCounterCondition(key, value)
  }

  return `${key}: ${value}`
}

export function parseAfterStoryConditionObject(conditionObj, cardsById) {
  if (!conditionObj || typeof conditionObj !== 'object') return []

  const items = []
  const pushedSections = new Set()

  for (const key of Object.keys(conditionObj)) {
    if (COMMENT_SUFFIXES.some((suffix) => key.endsWith(suffix))) continue

    const sectionText = cleanComment(conditionObj[`${key}__ca`])
    if (sectionText && !pushedSections.has(sectionText) && conditionObj[`${key}__c`] !== sectionText) {
      pushedSections.add(sectionText)
      items.push({ type: 'section', text: sectionText })
    }

    const comment = cleanComment(conditionObj[`${key}__c`])
    items.push({
      type: 'condition',
      text: comment || parseFallbackCondition(key, conditionObj[key], cardsById),
      rawKey: key,
      value: conditionObj[key],
    })
  }

  return items
}

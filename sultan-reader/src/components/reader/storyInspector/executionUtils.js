import { parseConditionObject } from '../../../services/conditionParser'

function normalizeArray(value) {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function parseOperator(rawKey) {
  const match = String(rawKey).match(/^(.*?)(>=|<=|>|<|=)?$/)
  return {
    target: match?.[1] || String(rawKey),
    operator: match?.[2] || '>=',
  }
}

function normalizeLookupKey(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .trim()
}

function compareByOperator(actualValue, expectedValue, operator = '>=') {
  const actual = Number(actualValue || 0)
  const expected = Number(expectedValue || 0)

  switch (operator) {
    case '=':
      return actual === expected
    case '>':
      return actual > expected
    case '<':
      return actual < expected
    case '<=':
      return actual <= expected
    case '>=':
    default:
      return actual >= expected
  }
}

function readCardMetric(card, target) {
  if (!card || !target) return 0

  const normalizedTarget = normalizeLookupKey(target)
  const tagMatch = Object.entries(card.tag || {}).find(([key]) => normalizeLookupKey(key) === normalizedTarget)
  if (tagMatch) return Number(tagMatch[1] || 0)

  const directMatch = Object.entries(card || {}).find(([key]) => normalizeLookupKey(key) === normalizedTarget)
  if (directMatch) return Number(directMatch[1] || 0)

  return 0
}

function evaluateSlotCondition(card, selector, expectedValue) {
  if (!selector) return Boolean(card)

  if (selector === 'is') {
    return normalizeArray(expectedValue).map(String).includes(String(card?.id ?? ''))
  }
  if (selector === 'type') {
    return String(card?.type || '') === String(expectedValue)
  }

  const { target, operator } = parseOperator(selector)
  const actualValue = readCardMetric(card, target)
  return compareByOperator(actualValue, expectedValue, operator)
}

function collectAtomicConditions(condition, collector = []) {
  if (!condition || typeof condition !== 'object') return collector

  Object.entries(condition).forEach(([key, value]) => {
    if (key.endsWith('__c') || key.endsWith('__ca') || key.endsWith('__ci')) return
    if (key === 'any' || key === 'all') {
      if (Array.isArray(value)) {
        value.forEach((item) => collectAtomicConditions(item, collector))
      } else if (isPlainObject(value)) {
        collectAtomicConditions(value, collector)
      }
      return
    }
    collector.push({ key, value })
  })

  return collector
}

export function buildConditionOptionId(groupId, key, value) {
  return `${groupId}::${key}::${JSON.stringify(value)}`
}

export function resolveSelectedSlotCard(model, slotId, slotSelections, settlementSelections, cardsById) {
  const slot = model?.slots?.find((entry) => entry.id === slotId)
  if (!slot) return null

  const overrideHintId = settlementSelections?.[slotId]
  const overrideHint = (slot.settlementHints || []).find((hint) => hint.id === overrideHintId)
  const overrideCard = overrideHint?.cards?.[0]
  if (overrideCard?.id) {
    return cardsById?.[String(overrideCard.id)] || overrideCard
  }

  const candidate = slot.candidates?.find((entry) => entry.id === slotSelections?.[slotId]) || slot.candidates?.[0] || null
  const candidateCard = candidate?.cards?.[0] || slot.defaultCards?.[0] || null
  if (!candidateCard?.id) return candidateCard
  return cardsById?.[String(candidateCard.id)] || candidateCard
}

export function evaluateExecutionCondition(condition, context) {
  if (!condition || typeof condition !== 'object') return true

  return Object.entries(condition).every(([key, value]) => {
    if (key.endsWith('__c') || key.endsWith('__ca') || key.endsWith('__ci')) return true

    if (key === 'any') {
      const items = Array.isArray(value)
        ? value
        : (isPlainObject(value) ? Object.entries(value).map(([subKey, subValue]) => ({ [subKey]: subValue })) : [])
      if (items.length === 0) return true
      return items.some((item) => evaluateExecutionCondition(item, context))
    }

    if (key === 'all') {
      const items = Array.isArray(value)
        ? value
        : (isPlainObject(value) ? Object.entries(value).map(([subKey, subValue]) => ({ [subKey]: subValue })) : [])
      if (items.length === 0) return true
      return items.every((item) => evaluateExecutionCondition(item, context))
    }

    const rMatch = String(key).match(/^(r\d+):(.*)$/i)
    if (rMatch) {
      const stageId = rMatch[1].toLowerCase()
      const optionId = buildConditionOptionId(stageId, key, value)
      return context.branchSelections?.[stageId] === optionId
    }

    const slotMatch = String(key).match(/^(!)?(s\d+)(?:\.(.+))?$/i)
    if (slotMatch) {
      const negate = Boolean(slotMatch[1])
      const slotId = slotMatch[2].toLowerCase()
      const selector = slotMatch[3] || ''
      const card = context.slotCards?.[slotId] || null

      if (!selector) {
        const occupied = Boolean(card)
        return negate ? !occupied : occupied
      }

      const optionId = buildConditionOptionId(slotId, key, value)
      if (context.branchSelections?.[slotId]) {
        return context.branchSelections[slotId] === optionId
      }

      const matched = evaluateSlotCondition(card, selector, value)
      return negate ? !matched : matched
    }

    return true
  })
}

export function buildExecutionConditionGroups(model, cardsMap, slotCards) {
  const groups = new Map()

  ;(model?.rawPhases || []).forEach((phase) => {
    collectAtomicConditions(phase.raw?.condition || {}).forEach(({ key, value }) => {
      const rMatch = String(key).match(/^(r\d+):(.*)$/i)
      if (rMatch) {
        const stageId = rMatch[1].toLowerCase()
        const groupId = stageId
        const group = groups.get(groupId) || {
          id: groupId,
          title: `骰子分支 ${stageId.toUpperCase()}`,
          description: model?.randomText?.[stageId] || '请选择这次骰子检定的结果分支。',
          options: [],
          isDice: true,
          stageId,
        }
        const optionId = buildConditionOptionId(groupId, key, value)
        if (!group.options.some((option) => option.id === optionId)) {
          group.options.push({
            id: optionId,
            label: parseConditionObject({ [key]: value }, cardsMap)[0] || key,
            detail: model?.randomTextUp?.[stageId]?.text || '',
          })
        }
        groups.set(groupId, group)
        return
      }

      const slotMatch = String(key).match(/^!?((s\d+))(?:\.(.+))?$/i)
      if (!slotMatch || !slotMatch[3]) return

      const slotId = slotMatch[2].toLowerCase()
      const group = groups.get(slotId) || {
        id: slotId,
        title: `${slotId.toUpperCase()} 条件`,
        description: slotCards?.[slotId]?.name ? `当前带入：${slotCards[slotId].name}` : '可手动调整当前卡槽对应条件。',
        options: [],
        isDice: false,
      }

      const optionId = buildConditionOptionId(slotId, key, value)
      if (!group.options.some((option) => option.id === optionId)) {
        group.options.push({
          id: optionId,
          label: parseConditionObject({ [key]: value }, cardsMap)[0] || key,
          detail: '',
        })
      }
      groups.set(slotId, group)
    })
  })

  return Array.from(groups.values())
}

export function buildExecutionSteps(model, context) {
  const steps = []
  const promptedDiceStages = new Set()

  for (const phase of (model?.rawPhases || [])) {
    const rawCondition = phase.raw?.condition || {}
    const stageKeys = phase.rStageKeys || []
    const nonDiceConditions = Object.fromEntries(
      Object.entries(rawCondition).filter(([key]) => !String(key).match(/^r\d+:/i))
    )

    if (!evaluateExecutionCondition(nonDiceConditions, context)) {
      continue
    }

    for (const stageId of stageKeys) {
      if (promptedDiceStages.has(stageId)) continue
      promptedDiceStages.add(stageId)
      const stageMeta = model?.randomTextUp?.[stageId] || {}
      steps.push({
        id: `dice:${stageId}`,
        kind: 'dice',
        stageId,
        phase: '结算骰子',
        title: model?.randomText?.[stageId] || stageId.toUpperCase(),
        text: stageMeta.text || '',
        tips: [stageMeta.type_tips, stageMeta.low_target_tips].filter(Boolean),
        conditions: [],
        effects: [],
        actions: [],
        popItems: [],
      })
    }

    if (!evaluateExecutionCondition(rawCondition, context)) {
      continue
    }

    steps.push({
      ...phase,
      id: `${phase.phaseKey}:${phase.index}`,
      kind: 'result',
      tips: [],
    })

    if (phase.raw?.result && Object.keys(phase.raw.result).some((key) => !String(key).endsWith('__c') && !String(key).endsWith('__ca') && !String(key).endsWith('__ci'))) {
      break
    }
  }

  return steps
}

export function resolveExecutionTargetImage(targetType, targetData, cardsById) {
  if (!targetData) return null
  if (targetType === 'card') {
    const card = cardsById?.[String(targetData.id)] || targetData
    const resource = card?.resource
    return Array.isArray(resource) ? resource[0] || null : resource || null
  }
  if (targetType === 'rite' || targetType === 'event') return targetData.icon || null
  if (targetType === 'over') return targetData.bg || null
  return targetData.pic || targetData.icon || null
}

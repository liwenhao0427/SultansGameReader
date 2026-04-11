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

function isDisplayMetaKey(key) {
  return String(key).endsWith('__c') || String(key).endsWith('__ca') || String(key).endsWith('__ci')
}

function buildConditionLabel(condition, cardsMap) {
  return parseConditionObject(condition, cardsMap)[0] || Object.keys(condition || {})[0] || '未命名条件'
}

function extractAtomicEntries(condition, collector = []) {
  if (!condition || typeof condition !== 'object') return collector

  Object.entries(condition).forEach(([key, value]) => {
    if (isDisplayMetaKey(key)) return
    if (key === 'any' || key === 'all') {
      if (Array.isArray(value)) {
        value.forEach((item) => extractAtomicEntries(item, collector))
      } else if (isPlainObject(value)) {
        extractAtomicEntries(value, collector)
      }
      return
    }
    collector.push({ key, value })
  })

  return collector
}

function extractGroupIdFromKey(key) {
  const rMatch = String(key).match(/^(r\d+):(.*)$/i)
  if (rMatch) return rMatch[1].toLowerCase()

  const slotMatch = String(key).match(/^!?(s\d+)(?:\.(.+))?$/i)
  if (slotMatch && slotMatch[1]) return slotMatch[1].toLowerCase()

  const normalizedKey = String(key).replace(/^!/, '')
  const { target } = parseOperator(normalizedKey)
  const prefix = String(target).split(/[.:]/)[0]?.trim()
  return prefix ? prefix.toLowerCase() : null

  return null
}

function evaluateAtomicCondition(key, value, context) {
  const rMatch = String(key).match(/^(r\d+):(.*)$/i)
  if (rMatch) {
    const groupId = rMatch[1].toLowerCase()
    const optionId = buildConditionOptionId(groupId, key, value)
    if (!context.branchSelections?.[groupId]) {
      return {
        status: 'pending',
        groupId,
        key,
        value,
      }
    }
    return {
      status: context.branchSelections[groupId] === optionId ? 'matched' : 'unmatched',
      groupId,
      key,
      value,
    }
  }

  const slotMatch = String(key).match(/^(!)?(s\d+)(?:\.(.+))?$/i)
  if (slotMatch) {
    const negate = Boolean(slotMatch[1])
    const slotId = slotMatch[2].toLowerCase()
    const selector = slotMatch[3] || ''
    const card = context.slotCards?.[slotId] || null

    if (!selector) {
      const occupied = Boolean(card)
      return {
        status: negate ? (!occupied ? 'matched' : 'unmatched') : (occupied ? 'matched' : 'unmatched'),
        groupId: slotId,
        key,
        value,
      }
    }

    const optionId = buildConditionOptionId(slotId, key, value)
    if (!context.branchSelections?.[slotId]) {
      return {
        status: 'pending',
        groupId: slotId,
        key,
        value,
      }
    }

    return {
      status: context.branchSelections[slotId] === optionId ? 'matched' : 'unmatched',
      groupId: slotId,
      key,
      value,
    }
  }

  const genericGroupId = extractGroupIdFromKey(key)
  if (genericGroupId) {
    const optionId = buildConditionOptionId(genericGroupId, key, value)
    if (!context.branchSelections?.[genericGroupId]) {
      return {
        status: 'pending',
        groupId: genericGroupId,
        key,
        value,
      }
    }
    return {
      status: context.branchSelections[genericGroupId] === optionId ? 'matched' : 'unmatched',
      groupId: genericGroupId,
      key,
      value,
    }
  }

  return {
    status: 'matched',
    groupId: null,
    key,
    value,
  }
}

function analyzeAnyCondition(condition, context) {
  const entries = Array.isArray(condition)
    ? condition
    : (isPlainObject(condition)
      ? Object.entries(condition)
        .filter(([key]) => !isDisplayMetaKey(key))
        .map(([key, value]) => ({ [key]: value }))
      : [])

  if (entries.length === 0) return { status: 'matched' }

  let pending = null
  for (const entry of entries) {
    const result = analyzeConditionNode(entry, context)
    if (result.status === 'matched') return { status: 'matched' }
    if (!pending && result.status === 'pending') pending = result
  }

  return pending || { status: 'unmatched' }
}

function analyzeAllCondition(condition, context) {
  const entries = Array.isArray(condition)
    ? condition
    : (isPlainObject(condition)
      ? Object.entries(condition)
        .filter(([key]) => !isDisplayMetaKey(key))
        .map(([key, value]) => ({ [key]: value }))
      : [])

  if (entries.length === 0) return { status: 'matched' }

  let pending = null
  for (const entry of entries) {
    const result = analyzeConditionNode(entry, context)
    if (result.status === 'unmatched') return result
    if (!pending && result.status === 'pending') pending = result
  }

  return pending || { status: 'matched' }
}

function analyzeConditionNode(condition, context) {
  if (!condition || typeof condition !== 'object') return { status: 'matched' }

  let pending = null
  for (const [key, value] of Object.entries(condition)) {
    if (isDisplayMetaKey(key)) continue

    let result
    if (key === 'any') {
      result = analyzeAnyCondition(value, context)
    } else if (key === 'all') {
      result = analyzeAllCondition(value, context)
    } else {
      result = evaluateAtomicCondition(key, value, context)
    }

    if (result.status === 'unmatched') return result
    if (!pending && result.status === 'pending') pending = result
  }

  return pending || { status: 'matched' }
}

function findFirstAtomicForGroup(condition, groupId) {
  const entries = extractAtomicEntries(condition)
  return entries.find((entry) => extractGroupIdFromKey(entry.key) === groupId) || null
}

function hasMeaningfulResult(result) {
  if (!result || typeof result !== 'object') return false
  return Object.keys(result).some((key) => !isDisplayMetaKey(key))
}

function buildExecutionStepFromPhase(phase) {
  return {
    id: `${phase.phaseKey}:${phase.index}`,
    kind: 'result',
    phase: phase.phase || phase.phaseLabel || phase.phaseKey || '结算',
    title: phase.title || '',
    text: phase.text || '',
    conditions: phase.conditions || [],
    effects: phase.effects || [],
    actions: (phase.actions || []).filter((action) => action?.targetType && action?.targetId),
    popItems: phase.popItems || [],
    tips: [],
  }
}

function buildChoiceStep(model, group) {
  const isDice = /^r\d+$/i.test(group.id)
  const stageMeta = isDice ? (model?.randomTextUp?.[group.id] || {}) : {}

  return {
    id: `choice:${group.id}`,
    kind: 'choice',
    phase: isDice ? `骰子分支 ${group.id.toUpperCase()}` : '条件分支',
    title: isDice ? (model?.randomText?.[group.id] || group.title) : group.title,
    text: isDice ? (stageMeta.text || '') : group.description,
    conditions: [],
    effects: [],
    actions: [],
    popItems: [],
    tips: isDice ? [stageMeta.type_tips, stageMeta.low_target_tips].filter(Boolean) : [],
    groupId: group.id,
  }
}

function buildDicePromptStep(model, groupId) {
  const stageMeta = model?.randomTextUp?.[groupId] || {}
  return {
    id: `dice:${groupId}`,
    kind: 'dice',
    phase: `骰子分支 ${groupId.toUpperCase()}`,
    title: model?.randomText?.[groupId] || '',
    text: stageMeta.text || '',
    conditions: [],
    effects: [],
    actions: [],
    popItems: [],
    tips: [stageMeta.type_tips, stageMeta.low_target_tips].filter(Boolean),
  }
}

function buildExecutionIntroStep(model) {
  return {
    id: 'execution:intro',
    kind: 'intro',
    phase: '仪式正文',
    title: model?.title || '',
    text: model?.intro || '',
    conditions: [],
    effects: [],
    actions: [],
    popItems: [],
    tips: normalizeArray(model?.tipsText).filter(Boolean),
  }
}

function pickDefaultSlotOption(group, selectedCard) {
  if (!group?.options?.length) return null

  const matched = group.options.find((option) => evaluateExecutionCondition(
    { [option.rawKey]: option.rawValue },
    {
      branchSelections: {},
      slotCards: { [group.id]: selectedCard },
    }
  ))

  return matched?.id || group.options[0]?.id || null
}

function buildGroupDescription(model, groupId, slotCards) {
  if (/^r\d+$/i.test(groupId)) {
    return model?.randomText?.[groupId] || '请选择这次骰子分支的结果。'
  }

  const currentCard = slotCards?.[groupId]
  if (currentCard?.name) {
    return `当前带入：${currentCard.name}`
  }

  return '可根据当前卡槽卡牌切换对应条件。'
}

function extractFirstAtomic(condition) {
  return extractAtomicEntries(condition)[0] || null
}

function collectGroupOptions(model, phases, startIndex, groupId, cardsMap, slotCards) {
  const options = []

  for (let index = startIndex; index < phases.length; index += 1) {
    const phase = phases[index]
    const firstAtomic = extractFirstAtomic(phase.raw?.condition || {})
    if (!firstAtomic) break

    const firstGroupId = extractGroupIdFromKey(firstAtomic.key)
    if (firstGroupId !== groupId) break

    const atomic = findFirstAtomicForGroup(phase.raw?.condition || {}, groupId) || firstAtomic
    const optionId = buildConditionOptionId(groupId, atomic.key, atomic.value)
    if (options.some((option) => option.id === optionId)) continue

    const detail = /^r\d+$/i.test(groupId)
      ? (model?.randomTextUp?.[groupId]?.text || '')
      : ''

    options.push({
      id: optionId,
      rawKey: atomic.key,
      rawValue: atomic.value,
      label: parseConditionObject(phase.raw?.condition || { [atomic.key]: atomic.value }, cardsMap).join(' / ') || buildConditionLabel({ [atomic.key]: atomic.value }, cardsMap),
      detail,
    })
  }

  return {
    id: groupId,
    title: /^r\d+$/i.test(groupId) ? `骰子分支 ${groupId.toUpperCase()}` : `${groupId.toUpperCase()} 条件`,
    description: buildGroupDescription(model, groupId, slotCards),
    options,
    isDice: /^r\d+$/i.test(groupId),
    isSlot: /^s\d+$/i.test(groupId),
    stageId: /^r\d+$/i.test(groupId) ? groupId : null,
  }
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
  return analyzeConditionNode(condition, context).status === 'matched'
}

export function buildExecutionFlow(model, context = {}) {
  const steps = []
  const conditionGroups = []
  const autoSelections = {}
  const resolvedSelections = { ...(context.branchSelections || {}) }
  const renderedChoiceGroups = new Set()
  const phases = model?.rawPhases || []

  if (model?.title || model?.intro || normalizeArray(model?.tipsText).length > 0) {
    steps.push(buildExecutionIntroStep(model))
  }

  let isComplete = false
  let index = 0

  while (index < phases.length) {
    const phase = phases[index]
    const firstAtomic = extractFirstAtomic(phase.raw?.condition || {})
    const blockGroupId = firstAtomic ? extractGroupIdFromKey(firstAtomic.key) : null

    if (blockGroupId && !renderedChoiceGroups.has(blockGroupId)) {
      const group = collectGroupOptions(model, phases, index, blockGroupId, context.cardsMap, context.slotCards || {})
      if (group.options.length > 0) {
        conditionGroups.push(group)
        steps.push(buildChoiceStep(model, group))
        renderedChoiceGroups.add(blockGroupId)
      }
    }

    const analysis = analyzeConditionNode(phase.raw?.condition || {}, {
      branchSelections: resolvedSelections,
      slotCards: context.slotCards || {},
    })

    if (analysis.status === 'unmatched') {
      index += 1
      continue
    }

    if (analysis.status === 'pending' && analysis.groupId) {
      const groupId = analysis.groupId
      const group = conditionGroups.find((entry) => entry.id === groupId) || collectGroupOptions(model, phases, index, groupId, context.cardsMap, context.slotCards || {})

      if (!conditionGroups.some((entry) => entry.id === group.id) && group.options.length > 0) {
        conditionGroups.push(group)
      }

      if (!group || group.options.length === 0) {
        break
      }

      if (!resolvedSelections[groupId] && group.isSlot) {
        const selectedCard = context.slotCards?.[groupId] || null
        const autoOptionId = pickDefaultSlotOption(group, selectedCard)
        if (autoOptionId) {
          resolvedSelections[groupId] = autoOptionId
          autoSelections[groupId] = autoOptionId
          continue
        }
      }

      if (!resolvedSelections[groupId]) {
        break
      }

      continue
    }

    steps.push(buildExecutionStepFromPhase(phase))
    if (hasMeaningfulResult(phase.raw?.result)) {
      isComplete = true
      break
    }

    index += 1
  }

  return {
    steps,
    conditionGroups,
    autoSelections,
    isComplete,
  }
}

export function resolveExecutionTargetImage(targetType, targetData, cardsById) {
  if (!targetData) return null
  if (targetType === 'card') {
    const card = cardsById?.[String(targetData.id)] || targetData
    const resource = card?.resource
    return Array.isArray(resource) ? resource[0] || null : resource || card?.image || null
  }
  if (targetType === 'rite' || targetType === 'event') return targetData.icon || null
  if (targetType === 'over') return targetData.bg || null
  return targetData.pic || targetData.icon || null
}

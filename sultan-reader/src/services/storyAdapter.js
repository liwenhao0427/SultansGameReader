import { parseConditionObject } from './conditionParser'

function normalizeArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function stripSlotPrefix(key, slotId) {
  if (typeof key !== 'string') return key
  if (key.startsWith(`${slotId}.`)) return key.slice(slotId.length + 1)
  if (key.startsWith(`!${slotId}.`)) return `!${key.slice(slotId.length + 2)}`
  return key
}

function actionTargetType(key) {
  switch (key) {
    case 'event_on':
    case 'event_off':
    case 'rite_end':
      return 'event'
    case 'rite':
      return 'rite'
    case 'loot':
      return 'loot'
    case 'card':
    case 'link_card':
      return 'card'
    case 'over':
      return 'over'
    default:
      return null
  }
}

function extractActionTargets(action = {}) {
  const results = []

  for (const [key, value] of Object.entries(action)) {
    if (key.endsWith('__c') || key.endsWith('__ca') || key.endsWith('__ci')) continue
    if (value == null) continue

    if (key === 'success' || key === 'failed') {
      for (const [branchKey, branchValue] of Object.entries(value || {})) {
        if (branchKey.endsWith('__c') || branchKey.endsWith('__ca') || branchKey.endsWith('__ci')) continue
        normalizeArray(branchValue).forEach((item) => {
          const targetType = actionTargetType(branchKey)
          results.push({
            branch: key,
            key: branchKey,
            value: item,
            targetType,
            targetId: targetType ? String(item) : null,
            text: `${key} -> ${branchKey}: ${item}`,
          })
        })
      }
      continue
    }

    normalizeArray(value).forEach((item) => {
      if (typeof item !== 'object') {
        const targetType = actionTargetType(key)
        results.push({
          branch: 'direct',
          key,
          value: item,
          targetType,
          targetId: targetType ? String(item) : null,
          text: `${key}: ${item}`,
        })
      }
    })
  }

  return results
}

function extractChoiceOptions(chooseValue) {
  if (!chooseValue) return []

  if (Array.isArray(chooseValue)) {
    return chooseValue.flatMap((entry) => extractChoiceOptions(entry))
  }

  if (typeof chooseValue === 'object') {
    return Object.entries(chooseValue)
      .filter(([key]) => !key.endsWith('__c') && !key.endsWith('__ca') && !key.endsWith('__ci'))
      .map(([id, text]) => ({ id, text: String(text) }))
  }

  return []
}

function extractPopBubbleText(result = {}, slotId = '') {
  if (!result || typeof result !== 'object') return ''

  const popupEntries = Object.entries(result)
    .filter(([key, value]) => (
      !key.endsWith('__c') &&
      !key.endsWith('__ca') &&
      !key.endsWith('__ci') &&
      typeof value === 'string' &&
      key.startsWith('pop.')
    ))

  if (popupEntries.length === 0) return ''

  const scoped = slotId
    ? popupEntries.find(([key]) => key.endsWith(`.${slotId}`))
    : null

  return (scoped || popupEntries[0])?.[1] || ''
}

function resolveCardResource(card) {
  if (!card) return null
  if (Array.isArray(card.resource)) return card.resource[0] || null
  return card.resource || null
}

function buildCardSummary(id, cardsMap, cardsById) {
  const card = cardsById?.[String(id)] || null
  return {
    id: String(id),
    name: card?.name || cardsMap?.get(String(id)) || String(id),
    title: card?.title || '',
    rare: card?.rare || null,
    image: resolveCardResource(card),
  }
}

function extractConditionCards(condition, cardsMap, cardsById) {
  const directIs = normalizeArray(condition?.is)
  const anyIs = normalizeArray(condition?.any?.is)
  return (directIs.length > 0 ? directIs : anyIs).map((id) => buildCardSummary(id, cardsMap, cardsById))
}

function summarizeLabel(name, fallbackPrefix = '') {
  if (!name) return fallbackPrefix || '未命名条件'
  return fallbackPrefix ? `${fallbackPrefix}${name}` : name
}

function buildSlotCandidate(slotId, pop, index, cardsMap, cardsById) {
  const condition = pop?.condition || {}
  const anyCondition = condition.any && typeof condition.any === 'object' ? condition.any : null
  const directIs = normalizeArray(condition.is)
  const anyIs = normalizeArray(anyCondition?.is)

  let label = `候选 ${index + 1}`
  let cards = []
  let mode = 'text'

  if (directIs.length > 0) {
    cards = directIs.map((id) => buildCardSummary(id, cardsMap, cardsById))
    label = condition.is__c || cards.map((card) => card.name).join(' / ')
    mode = cards.length > 1 ? 'stack' : 'card'
  } else if (anyIs.length > 0) {
    cards = anyIs.map((id) => buildCardSummary(id, cardsMap, cardsById))
    label = anyCondition?.is__c || condition.any__c || cards.map((card) => card.name).join(' / ')
    mode = 'stack'
  } else {
    const positiveLabels = []
    const negativeLabels = []
    const negativeIs = normalizeArray(condition['!is'])

    if (negativeIs.length > 0) {
      negativeLabels.push(summarizeLabel(condition['!is__c'] || '指定卡牌', '非'))
    }

    for (const [key, value] of Object.entries(condition)) {
      if (key.endsWith('__c') || key.endsWith('__ca') || key.endsWith('__ci')) continue
      if (key === 'any' || key === 'all' || key === 'is' || key === '!is') continue
      if (typeof value !== 'number') continue

      const comment = condition[`${key}__c`] || null
      const name = comment || key.replace(/^!/, '')

      if (key.startsWith('!')) {
        negativeLabels.push(summarizeLabel(name, '非'))
      } else {
        positiveLabels.push(name)
      }
    }

    if (positiveLabels.length > 0) {
      label = positiveLabels.join(' / ')
      mode = 'tag'
    } else if (negativeLabels.length > 0) {
      label = negativeLabels.join(' / ')
      mode = 'fallback'
    }
  }

  return {
    id: `${slotId}:candidate:${index}`,
    label,
    mode,
    cards,
    bubbleText: extractPopBubbleText(pop?.result, slotId),
    conditionText: parseConditionObject(condition, cardsMap).join(' / '),
  }
}

function buildSettlementSlotHints(slotId, items, cardsMap, cardsById, phaseKey = 'settlement') {
  return normalizeArray(items)
    .filter((item) => item?.condition && typeof item.condition === 'object')
    .map((item, index) => {
      const scopedCondition = Object.fromEntries(
        Object.entries(item.condition)
          .filter(([key]) => key === slotId || key.startsWith(`${slotId}.`) || key.startsWith(`!${slotId}.`) || key === `${slotId}.is` || key === `!${slotId}.is`)
          .map(([key, value]) => [stripSlotPrefix(key, slotId), value])
      )

      if (Object.keys(scopedCondition).length === 0) return null

      return {
        id: `${slotId}:settlement:${phaseKey}:${item.guid || index}`,
        label: item.result_title || `相关结算 ${index + 1}`,
        mode: 'settlement',
        cards: extractConditionCards(scopedCondition, cardsMap, cardsById),
        choiceTexts: [],
        primaryText: item.result_text || '',
        conditionText: parseConditionObject(scopedCondition, cardsMap).join(' / '),
      }
    })
    .filter(Boolean)
}

function buildGlobalSettlementHints(items, cardsMap, cardsById, slotIds = [], phaseKey = 'settlement') {
  return normalizeArray(items)
    .filter((item) => item?.condition && typeof item.condition === 'object')
    .filter((item) => !Object.keys(item.condition).some((key) => (
      slotIds.some((slotId) => (
        key === slotId ||
        key.startsWith(`${slotId}.`) ||
        key.startsWith(`!${slotId}.`) ||
        key === `${slotId}.is` ||
        key === `!${slotId}.is`
      ))
    )))
    .map((item, index) => ({
      id: `global:settlement:${phaseKey}:${item.guid || index}`,
      label: item.result_title || `额外结算 ${index + 1}`,
      mode: 'settlement',
      cards: extractConditionCards(item.condition || {}, cardsMap, cardsById),
      choiceTexts: [],
      primaryText: item.result_text || '',
      conditionText: parseConditionObject(item.condition, cardsMap).join(' / '),
    }))
}

function buildPhaseItem(item, cardsMap, phase, slotIds = []) {
  const condition = item.condition || {}
  const slotBindingIds = slotIds.filter((slotId) => Object.keys(condition).some((key) => (
    key === slotId ||
    key.startsWith(`${slotId}.`) ||
    key.startsWith(`!${slotId}.`) ||
    key === `${slotId}.is` ||
    key === `!${slotId}.is`
  )))

  return {
    guid: item.guid || null,
    phase,
    title: item.result_title || '',
    text: item.result_text || item.tips_text || '',
    conditions: parseConditionObject(condition, cardsMap),
    slotBindingIds,
    actions: extractActionTargets(item.action),
    choiceActions: extractActionTargets(item.action).filter((entry) => entry.targetType === 'event' || entry.targetType === 'rite' || entry.targetType === 'over'),
    options: extractChoiceOptions(item.result?.choose || item.action?.choose),
    note: item.__ca || item.__c || '',
  }
}

function pickEventImage(data) {
  for (const settlement of normalizeArray(data.settlement)) {
    const pics = settlement?.action?.slide?.pics
    if (Array.isArray(pics) && pics.length > 0) {
      return pics.find(Boolean) || null
    }

    const icons = settlement?.action?.confirm?.icon
    if (Array.isArray(icons) && icons.length > 0) {
      return icons.find(Boolean) || null
    }
  }

  return null
}

function pickCardImage(card) {
  const resource = card?.resource
  if (Array.isArray(resource)) return resource[0] || null
  return resource || null
}

export function adaptStoryData(type, data, cardsMap, cardsById = {}) {
  if (!data) return null

  switch (type) {
    case 'rite':
      const riteSlotIds = Object.keys(data.cards_slot || {})
      const settlementHintsBySlot = {}
      for (const slotId of riteSlotIds) {
        settlementHintsBySlot[slotId] = [
          ...buildSettlementSlotHints(slotId, data.settlement_prior, cardsMap, cardsById, 'prior'),
          ...buildSettlementSlotHints(slotId, data.settlement, cardsMap, cardsById, 'main'),
          ...buildSettlementSlotHints(slotId, data.settlement_extre, cardsMap, cardsById, 'extra'),
        ]
      }
      const globalSettlementHints = [
        ...buildGlobalSettlementHints(data.settlement_prior, cardsMap, cardsById, riteSlotIds, 'prior'),
        ...buildGlobalSettlementHints(data.settlement, cardsMap, cardsById, riteSlotIds, 'main'),
        ...buildGlobalSettlementHints(data.settlement_extre, cardsMap, cardsById, riteSlotIds, 'extra'),
      ]

      return {
        kind: 'rite',
        title: data.name || `仪式 ${data.id}`,
        subtitle: `仪式 #${data.id}`,
        mappingId: data.mapping_id || null,
        intro: data.text || '',
        meta: [
          data.location ? `地点：${data.location}` : null,
          data.round_number != null ? `回合数：${data.round_number}` : null,
          data.waiting_round != null ? `等待回合：${data.waiting_round}` : null,
        ].filter(Boolean),
        tags: normalizeArray(data.tag_tips),
        headerIcon: data.icon || null,
        image: null,
        slots: Object.entries(data.cards_slot || {}).map(([slotId, slot]) => ({
          id: slotId,
          title: slotId.toUpperCase(),
          text: slot.text || '',
          conditions: parseConditionObject(slot.condition, cardsMap),
          defaultCards: extractConditionCards(slot.condition || {}, cardsMap, cardsById),
          candidates: normalizeArray(slot.pops).map((pop, index) => (
            buildSlotCandidate(slotId, pop, index, cardsMap, cardsById)
          )),
          settlementHints: settlementHintsBySlot[slotId] || [],
        })),
        globalSettlementHints,
        segments: [
          ...normalizeArray(data.settlement_prior).map((item) => buildPhaseItem(item, cardsMap, '前置结算', riteSlotIds)),
          ...normalizeArray(data.settlement).map((item) => buildPhaseItem(item, cardsMap, '主结算', riteSlotIds)),
          ...normalizeArray(data.settlement_extre).map((item) => buildPhaseItem(item, cardsMap, '额外结算', riteSlotIds)),
        ].filter((item) => item.text || item.title || item.conditions.length || item.options.length || item.actions.length),
      }

    case 'event':
      return {
        kind: 'event',
        title: data.text || `事件 ${data.id}`,
        subtitle: `事件 #${data.id}`,
        intro: data.tips_text || '',
        meta: parseConditionObject(data.condition, cardsMap),
        image: pickEventImage(data),
        slots: [],
        segments: normalizeArray(data.settlement)
          .map((item) => buildPhaseItem(item, cardsMap, '事件分支'))
          .filter((item) => item.text || item.title || item.conditions.length || item.options.length || item.actions.length),
      }

    case 'after_story':
      return {
        kind: 'after_story',
        title: data.name || `后日谈 ${data.id}`,
        subtitle: `后日谈 #${data.id}`,
        intro: '',
        meta: [],
        image: null,
        slots: [],
        segments: normalizeArray(data.extra)
          .sort((a, b) => (a.sort || 999) - (b.sort || 999))
          .map((item) => ({
            phase: `片段 ${item.key || ''}`.trim(),
            title: '',
            text: item.result_text || '',
            conditions: parseConditionObject(item.condition, cardsMap),
            actions: [],
            options: [],
            note: item.pic || '',
            image: item.pic || null,
          })),
      }

    case 'over':
      return {
        kind: 'over',
        title: data.name || '结局',
        subtitle: data.sub_name || '',
        intro: data.text || '',
        meta: data.success__c ? [data.success__c] : [],
        image: data.bg || null,
        slots: [],
        segments: normalizeArray(data.text_extra)
          .map((item) => ({
            phase: '补充文本',
            title: '',
            text: item.result_text || '',
            conditions: parseConditionObject(item.condition, cardsMap),
            actions: [],
            options: [],
            note: '',
          }))
          .filter((item) => item.text || item.conditions.length),
      }

    case 'dt':
      return {
        kind: 'dt',
        title: data.description || data.dialog_tree_id || '对话树',
        subtitle: data.dialog_tree_id || '',
        intro: '',
        meta: [],
        image: null,
        slots: [],
        segments: normalizeArray(data.Item).map((item) => ({
          phase: item.word_id,
          title: '',
          text: item.word || '',
          conditions: [],
          actions: extractActionTargets(item.action),
          options: normalizeArray(item.Option).map((option) => ({
            id: option.option_Jump_id,
            text: option.option_Jump_word,
          })),
          note: '',
        })),
      }

    case 'card':
      return {
        kind: 'card',
        title: data.name || `卡牌 ${data.id}`,
        subtitle: data.title || '',
        intro: data.text || '',
        meta: data.tag ? Object.entries(data.tag).map(([key, value]) => `${key} ${value}`) : [],
        image: pickCardImage(data),
        slots: [],
        segments: [],
      }

    case 'loot':
      return {
        kind: 'loot',
        title: data.name || `战利品 ${data.id}`,
        subtitle: data.type__c || '',
        intro: '',
        meta: [
          data.type != null ? `类型：${data.type}` : null,
          data.repeat != null ? `重复：${data.repeat}` : null,
        ].filter(Boolean),
        image: (() => {
          const firstCardItem = normalizeArray(data.item).find((item) => item?.type === 'card' && item.id != null)
          return firstCardItem ? pickCardImage(cardsById?.[String(firstCardItem.id)]) : null
        })(),
        slots: [],
        segments: normalizeArray(data.item).map((item, index) => {
          const linkedCard = item?.type === 'card' ? cardsById?.[String(item.id)] : null
          return {
            phase: `掉落项 ${index + 1}`,
            title: linkedCard?.name || `${item.type || '未知类型'} ${item.id || ''}`.trim(),
            text: linkedCard?.text || '',
            conditions: [
              item?.num != null ? `数量：${item.num}` : null,
              item?.weight != null ? `权重：${item.weight}` : null,
            ].filter(Boolean),
            actions: [],
            options: [],
            note: '',
            image: pickCardImage(linkedCard),
          }
        }),
      }

    default:
      return {
        kind: type,
        title: data.name || data.text || `${type}:${data.id || ''}`,
        subtitle: '',
        intro: data.text || '',
        meta: [],
        image: null,
        slots: [],
        segments: [],
      }
  }
}

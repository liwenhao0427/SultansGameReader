import { parseConditionObject, parseEffect } from './conditionParser'
import { EVENT_READER_DEFAULTS, FIXED_ITEM_SLOT_ASSETS, FIXED_SUDAN_SLOT_ASSETS, FIXED_TAG_CARD_IDS } from '../resourceConfig'
import { getContentTypeLabel } from '../constants/gameTerminology'

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

function collectConditionKeys(condition = {}, collector = new Set()) {
  if (!condition || typeof condition !== 'object') return collector

  Object.entries(condition).forEach(([key, value]) => {
    if (key.endsWith('__c') || key.endsWith('__ca') || key.endsWith('__ci')) return
    collector.add(key)
    if (key === 'any' || key === 'all') {
      if (Array.isArray(value)) {
        value.forEach((item) => collectConditionKeys(item, collector))
      } else if (value && typeof value === 'object') {
        collectConditionKeys(value, collector)
      }
    }
  })

  return collector
}

function extractRStageKeys(condition = {}) {
  const result = []
  Array.from(collectConditionKeys(condition)).forEach((key) => {
    const match = String(key).match(/^(r\d+):/)
    if (match && !result.includes(match[1])) result.push(match[1])
  })
  return result
}

function extractSettlementPopItems(result = {}) {
  const lines = []

  function visit(node) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item))
      return
    }

    Object.entries(node).forEach(([key, value]) => {
      if (key.endsWith('__c') || key.endsWith('__ca') || key.endsWith('__ci')) return
      if (key === 'choose') {
        visit(value)
        return
      }
      if (!key.startsWith('pop.') || typeof value !== 'string') return

      const parts = key.split('.')
      const slotTail = parts[parts.length - 1]
      const slotId = /^s\d+$/i.test(slotTail) ? slotTail.toLowerCase() : null
      lines.push({
        key,
        slotId,
        speakerKey: slotId || parts[1] || '角色',
        text: value,
      })
    })
  }

  visit(result)
  return lines
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

function isCardLikeId(value) {
  return /^\d{6,}$/.test(String(value ?? ''))
}

function collectCardsFromEffectValue(value, cardsMap, cardsById) {
  const values = normalizeArray(value)
  const cards = values
    .filter((item) => isCardLikeId(item))
    .filter((item) => cardsById?.[String(item)] || cardsMap?.get(String(item)))
    .map((item) => buildCardSummary(item, cardsMap, cardsById))

  const unique = new Map(cards.map((card) => [card.id, card]))
  return Array.from(unique.values())
}

function buildFixedSudanCard(condition = {}) {
  const sudanKey = Object.keys(FIXED_SUDAN_SLOT_ASSETS).find((key) => Number(condition[key]) > 0)
  if (!sudanKey) return null

  const asset = FIXED_SUDAN_SLOT_ASSETS[sudanKey]
  return {
    id: `fixed-sudan:${sudanKey}`,
    name: asset.name,
    title: '苏丹卡',
    rare: Number(condition['rare=']) || 1,
    image: asset.image,
  }
}

function buildFixedItemCard(condition = {}) {
  const costKey = Object.keys(condition).find((key) => key.startsWith('cost.'))
  if (!costKey) return null

  const itemName = costKey.slice('cost.'.length)
  const asset = FIXED_ITEM_SLOT_ASSETS[itemName]
  if (!asset) return null

  return {
    id: `fixed-item:${itemName}`,
    name: `${asset.name} x${condition[costKey]}`,
    title: '固定消耗',
    rare: null,
    image: asset.image,
  }
}

function buildEmptySlotCandidate(slotId, slot) {
  return {
    id: `${slotId}:candidate:empty`,
    label: '空置',
    mode: 'empty',
    cards: [],
    bubbleText: '',
    conditionText: slot?.is_empty ? '当前槽位允许空置' : '不放入任何卡牌',
    isEmpty: true,
  }
}

function buildFallbackSlotCandidate(slotId, slot, cardsMap, cardsById) {
  const condition = slot?.condition || {}
  const fixedSudanCard = condition.type === 'sudan' ? buildFixedSudanCard(condition) : null
  const fixedItemCard = condition.type === 'item' ? buildFixedItemCard(condition) : null

  let defaultCards
  if (fixedSudanCard) {
    defaultCards = [fixedSudanCard]
  } else if (fixedItemCard) {
    defaultCards = [fixedItemCard]
  } else {
    defaultCards = extractConditionCards(condition, cardsMap, cardsById)
  }

  // 如果还是空，再尝试从 condition 的所有层级（含 any）里找固定 tag
  if (defaultCards.length === 0) {
    const allKeys = [
      ...Object.keys(condition),
      ...Object.keys(condition.any && typeof condition.any === 'object' ? condition.any : {}),
    ]
    for (const tag of Object.keys(FIXED_TAG_CARD_IDS)) {
      if (allKeys.includes(tag)) {
        defaultCards = [buildCardSummary(FIXED_TAG_CARD_IDS[tag], cardsMap, cardsById)]
        break
      }
    }
  }

  const label = defaultCards[0]?.name || slot?.text || slotId.toUpperCase()

  return {
    id: `${slotId}:candidate:default`,
    label,
    mode: defaultCards.length > 1 ? 'stack' : defaultCards.length === 1 ? 'card' : 'text',
    cards: defaultCards,
    bubbleText: '',
    conditionText: parseConditionObject(condition, cardsMap).join(' / '),
    isEmpty: false,
  }
}

function extractConditionCards(condition, cardsMap, cardsById) {
  const directIs = normalizeArray(condition?.is)
  // any 可能是对象或数组，只有对象时才取 any.is
  const anyObj = condition?.any && !Array.isArray(condition.any) && typeof condition.any === 'object' ? condition.any : null
  const anyIs = normalizeArray(anyObj?.is)

  // 优先用 is 字段
  if (directIs.length > 0) {
    return directIs.map((id) => buildCardSummary(id, cardsMap, cardsById))
  }
  if (anyIs.length > 0) {
    return anyIs.map((id) => buildCardSummary(id, cardsMap, cardsById))
  }

  // 识别固定 tag（主角、妻子等）→ 直接返回对应卡牌
  const allConditionKeys = [
    ...Object.keys(condition || {}),
    ...(anyObj ? Object.keys(anyObj) : []),
  ]
  for (const tag of Object.keys(FIXED_TAG_CARD_IDS)) {
    if (allConditionKeys.includes(tag)) {
      return [buildCardSummary(FIXED_TAG_CARD_IDS[tag], cardsMap, cardsById)]
    }
  }

  return []
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
    // 检查固定 tag（主角、妻子等）→ 直接用对应卡牌展示
    const allKeys = [...Object.keys(condition), ...Object.keys(anyCondition || {})]
    const fixedTagKey = allKeys.find((key) => FIXED_TAG_CARD_IDS[key])
    if (fixedTagKey) {
      const cardId = FIXED_TAG_CARD_IDS[fixedTagKey]
      cards = [buildCardSummary(cardId, cardsMap, cardsById)]
      label = cards[0].name
      mode = 'card'
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
  }

  return {
    id: `${slotId}:candidate:${index}`,
    label,
    mode,
    cards,
    bubbleText: extractPopBubbleText(pop?.result, slotId),
    conditionText: parseConditionObject(condition, cardsMap).join(' / '),
    isEmpty: false,
  }
}

function buildResultEffects(result = {}, cardsMap, cardsById) {
  if (!result || typeof result !== 'object') return []

  const effects = []

  for (const [key, value] of Object.entries(result)) {
    if (key.endsWith('__c') || key.endsWith('__ca') || key.endsWith('__ci')) continue
    if (key === 'choose' || key.startsWith('pop.')) continue
    if (value == null) continue

    if (key === 'card' || key === 'link_card') {
      const sourceValues = normalizeArray(value)
      const cards = sourceValues
        .filter((item) => isCardLikeId(item))
        .map((id) => buildCardSummary(id, cardsMap, cardsById))
      const extraTokens = sourceValues.filter((item) => !isCardLikeId(item)).map((item) => String(item)).filter(Boolean)
      if (cards.length > 0) {
        const baseLabel = result[`${key}__c`] || result[`${key}__ca`] || (key === 'link_card' ? '关联卡牌' : '获得卡牌')
        effects.push({
          type: 'card',
          label: extraTokens.length > 0 ? `${baseLabel}（${extraTokens.join(' / ')}）` : baseLabel,
          cards,
        })
      }
      continue
    }

    const parsedCards = collectCardsFromEffectValue(value, cardsMap, cardsById)
    effects.push({
      type: key.startsWith('global_counter')
        ? 'achievement'
        : key.startsWith('counter')
          ? 'counter'
          : key.startsWith('clean.')
            ? 'clean'
            : 'raw',
      label: parseEffect(
        key,
        value,
        result[`${key}__c`] || result[`${key}__ca`] || result[`${key}__ci`] || null,
        cardsMap
      ),
      value,
      cards: parsedCards,
    })
  }

  return effects
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
        conditionRaw: scopedCondition,
        conditionText: parseConditionObject(scopedCondition, cardsMap).join(' / '),
        fullConditionText: parseConditionObject(item.condition || {}, cardsMap).join(' / '),
        fullConditions: parseConditionObject(item.condition || {}, cardsMap),
        effects: buildResultEffects(item.result, cardsMap, cardsById),
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
      conditionRaw: item.condition || {},
      conditionText: parseConditionObject(item.condition, cardsMap).join(' / '),
      fullConditionText: parseConditionObject(item.condition || {}, cardsMap).join(' / '),
      fullConditions: parseConditionObject(item.condition || {}, cardsMap),
      effects: buildResultEffects(item.result, cardsMap, cardsById),
    }))
}

function buildPhaseItem(item, cardsMap, cardsById, phase, slotIds = []) {
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
    resultText: item.result_text || '',
    tipsText: item.tips_text || '',
    conditions: parseConditionObject(condition, cardsMap),
    conditionRaw: condition,
    rStageKeys: extractRStageKeys(condition),
    slotBindingIds,
    actions: extractActionTargets(item.action),
    choiceActions: extractActionTargets(item.action).filter((entry) => entry.targetType === 'event' || entry.targetType === 'rite' || entry.targetType === 'over'),
    options: extractChoiceOptions(item.result?.choose || item.action?.choose),
    effects: buildResultEffects(item.result, cardsMap, cardsById),
    popItems: extractSettlementPopItems(item.result),
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

function extractCardIdFromIcon(icon) {
  if (typeof icon !== 'string') return null
  const match = icon.match(/cards\/(\d+)/)
  return match?.[1] || null
}

function buildCardSummaryFromIcon(icon, cardsMap, cardsById) {
  const cardId = extractCardIdFromIcon(icon)
  if (!cardId) return null
  return buildCardSummary(cardId, cardsMap, cardsById)
}

function normalizePromptEntries(promptValue) {
  return normalizeArray(promptValue)
    .map((entry, index) => {
      if (typeof entry === 'string') {
        return {
          id: `prompt:${index}`,
          text: entry,
          icon: null,
        }
      }

      if (!entry || typeof entry !== 'object') return null

      return {
        id: entry.id || `prompt:${index}`,
        text: entry.text || '',
        icon: entry.icon || null,
      }
    })
    .filter((entry) => entry && (entry.text || entry.icon))
}

function normalizeOptionEntry(optionValue) {
  if (!optionValue || typeof optionValue !== 'object') return null

  return {
    id: optionValue.id || 'option',
    text: optionValue.text || '',
    icon: optionValue.icon || null,
    items: normalizeArray(optionValue.items)
      .map((item, index) => ({
        id: item?.tag || item?.id || `${optionValue.id || 'option'}:${index}`,
        tag: item?.tag || null,
        text: item?.text || `选项 ${index + 1}`,
      }))
      .filter((item) => item.tag || item.text),
  }
}

function extractEventEffects(action = {}, cardsMap, cardsById) {
  if (!action || typeof action !== 'object') return []

  const filtered = Object.fromEntries(
    Object.entries(action).filter(([key]) => (
      !key.endsWith('__c') &&
      !key.endsWith('__ca') &&
      !key.endsWith('__ci') &&
      key !== 'prompt' &&
      key !== 'option' &&
      key !== 'delay' &&
      key !== 'event_on' &&
      key !== 'event_off' &&
      key !== 'rite' &&
      key !== 'over' &&
      key !== 'success' &&
      key !== 'failed' &&
      !key.startsWith('case:')
    ))
  )

  return buildResultEffects(filtered, cardsMap, cardsById)
}

function buildEventActionNode(action = {}, cardsMap, cardsById, nodeId = 'event-root') {
  const promptEntries = normalizePromptEntries(action.prompt)
  const option = normalizeOptionEntry(action.option)
  const promptCards = promptEntries
    .map((entry) => buildCardSummaryFromIcon(entry.icon, cardsMap, cardsById))
    .filter(Boolean)
  const optionCard = buildCardSummaryFromIcon(option?.icon, cardsMap, cardsById)
  const relatedCards = [...promptCards, optionCard].filter(Boolean)
  const uniqCardMap = new Map(relatedCards.map((card) => [card.id, card]))
  const choices = (option?.items || []).map((item) => {
    const branchAction = item.tag ? action[`case:${item.tag}`] : null
    return {
      id: `${nodeId}:${item.tag || item.id}`,
      tag: item.tag || item.id,
      text: item.text,
      branch: branchAction ? buildEventActionNode(branchAction, cardsMap, cardsById, `${nodeId}:${item.tag || item.id}`) : null,
    }
  })

  return {
    id: nodeId,
    promptEntries,
    option,
    choices,
    actions: extractActionTargets(action).filter((entry) => (
      entry.targetType === 'rite' ||
      entry.targetType === 'loot' ||
      entry.targetType === 'over' ||
      (entry.targetType === 'event' && entry.key !== 'event_off')
    )),
    effects: extractEventEffects(action, cardsMap, cardsById),
    relatedCards: Array.from(uniqCardMap.values()),
  }
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
          candidates: (() => {
            const pops = normalizeArray(slot.pops).map((pop, index) => (
              buildSlotCandidate(slotId, pop, index, cardsMap, cardsById)
            ))
            const resolved = pops.length > 0 ? pops : [buildFallbackSlotCandidate(slotId, slot, cardsMap, cardsById)]
            return [...resolved, buildEmptySlotCandidate(slotId, slot)]
          })(),
          settlementHints: settlementHintsBySlot[slotId] || [],
        })),
        globalSettlementHints,
        randomText: data.random_text || {},
        randomTextUp: data.random_text_up || {},
        segments: [
          ...normalizeArray(data.settlement_prior).map((item) => buildPhaseItem(item, cardsMap, cardsById, '前置结算', riteSlotIds)),
          ...normalizeArray(data.settlement).map((item) => buildPhaseItem(item, cardsMap, cardsById, '主结算', riteSlotIds)),
          ...normalizeArray(data.settlement_extre).map((item) => buildPhaseItem(item, cardsMap, cardsById, '额外结算', riteSlotIds)),
        ].filter((item) => item.text || item.title || item.conditions.length || item.options.length || item.actions.length),
      }

    case 'event':
      const eventRootAction = normalizeArray(data.settlement)
        .map((item) => item?.action)
        .find((action) => action && typeof action === 'object') || {}
      const eventFlow = buildEventActionNode(eventRootAction, cardsMap, cardsById, `event:${data.id}:root`)
      const fallbackCharacterCard = buildCardSummary(EVENT_READER_DEFAULTS.fallbackCharacterCardId, cardsMap, cardsById)

      return {
        kind: 'event',
        title: data.text || `幕后 ${data.id}`,
        subtitle: `幕后 #${data.id}`,
        intro: data.tips_text || '',
        meta: parseConditionObject(data.condition, cardsMap),
        image: pickEventImage(data),
        slots: [],
        headerIcon: eventFlow.relatedCards?.[0]?.image || null,
        fallbackCharacterCard,
        eventFlow,
        segments: normalizeArray(data.settlement)
          .map((item) => buildPhaseItem(item, cardsMap, cardsById, '幕后分支'))
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
        title: data.name || `掉落池 ${data.id}`,
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
        title: data.name || data.text || `${getContentTypeLabel(type)}:${data.id || ''}`,
        subtitle: '',
        intro: data.text || '',
        meta: [],
        image: null,
        slots: [],
        segments: [],
      }
  }
}

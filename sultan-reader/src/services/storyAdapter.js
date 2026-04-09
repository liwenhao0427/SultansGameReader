import { parseConditionObject } from './conditionParser'

function normalizeArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
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

function buildPhaseItem(item, cardsMap, phase) {
  return {
    phase,
    title: item.result_title || '',
    text: item.result_text || item.tips_text || '',
    conditions: parseConditionObject(item.condition, cardsMap),
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

export function adaptStoryData(type, data, cardsMap) {
  if (!data) return null

  switch (type) {
    case 'rite':
      return {
        kind: 'rite',
        title: data.name || `仪式 ${data.id}`,
        subtitle: `仪式 #${data.id}`,
        intro: data.text || '',
        meta: [
          data.location ? `地点：${data.location}` : null,
          data.round_number != null ? `回合数：${data.round_number}` : null,
          data.waiting_round != null ? `等待回合：${data.waiting_round}` : null,
        ].filter(Boolean),
        tags: normalizeArray(data.tag_tips),
        image: data.icon || null,
        slots: Object.entries(data.cards_slot || {}).map(([slotId, slot]) => ({
          id: slotId,
          title: slotId.toUpperCase(),
          text: slot.text || '',
          conditions: parseConditionObject(slot.condition, cardsMap),
          options: normalizeArray(slot.pops).flatMap((pop) => extractChoiceOptions(pop.action?.choose)),
        })),
        segments: [
          ...normalizeArray(data.settlement_prior).map((item) => buildPhaseItem(item, cardsMap, '前置结算')),
          ...normalizeArray(data.settlement).map((item) => buildPhaseItem(item, cardsMap, '主结算')),
          ...normalizeArray(data.settlement_extre).map((item) => buildPhaseItem(item, cardsMap, '额外结算')),
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

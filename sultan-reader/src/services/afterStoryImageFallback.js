import { AFTER_STORY_CHARACTER_DEFAULTS } from '../resourceConfig'

function normalizeName(text) {
  return String(text || '')
    .replace(/[「」『』〔〕【】《》、，。！？：；·\s]/g, '')
    .trim()
}

function getCardImage(card) {
  if (!card) return null
  if (Array.isArray(card.resource)) return card.resource[0] || null
  return card.resource || null
}

export function resolveAfterStoryFallbackImage(name, cardsById) {
  return resolveAfterStoryFallbackCard(name, cardsById)?.image || null
}

export function resolveAfterStoryFallbackCard(name, cardsById) {
  const target = normalizeName(name)
  if (!target) return null

  for (const [alias, payload] of Object.entries(AFTER_STORY_CHARACTER_DEFAULTS)) {
    if (normalizeName(alias) === target) {
      return {
        id: `after-story-default:${alias}`,
        name: alias,
        image: payload.image,
        rare: payload.rare ?? null,
      }
    }
  }

  if (!cardsById || typeof cardsById !== 'object') return null

  const cards = Object.values(cardsById).filter((card) => card && card.name)

  const exact = cards.find((card) => normalizeName(card.name) === target && getCardImage(card))
  if (exact) {
    return {
      id: String(exact.id),
      name: exact.name,
      image: getCardImage(exact),
      rare: exact.rare ?? null,
    }
  }

  const inclusive = cards.find((card) => {
    const cardName = normalizeName(card.name)
    return getCardImage(card) && (cardName.includes(target) || target.includes(cardName))
  })
  if (inclusive) {
    return {
      id: String(inclusive.id),
      name: inclusive.name,
      image: getCardImage(inclusive),
      rare: inclusive.rare ?? null,
    }
  }

  return null
}

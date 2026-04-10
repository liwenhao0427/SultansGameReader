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
  const target = normalizeName(name)
  if (!target || !cardsById || typeof cardsById !== 'object') return null

  const cards = Object.values(cardsById).filter((card) => card && card.name)

  const exact = cards.find((card) => normalizeName(card.name) === target && getCardImage(card))
  if (exact) return getCardImage(exact)

  const inclusive = cards.find((card) => {
    const cardName = normalizeName(card.name)
    return getCardImage(card) && (cardName.includes(target) || target.includes(cardName))
  })
  if (inclusive) return getCardImage(inclusive)

  return null
}

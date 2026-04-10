const SEGMENT_REGEX = /[^。！？；，、,.!?;:：\n]+[。！？；，、,.!?;:：\n]*/g

function normalizeSegment(text) {
  return String(text || '')
    .replace(/[。！？；，、,.!?;:：\s]/g, '')
    .trim()
}

export function splitAfterStoryText(text) {
  const source = String(text || '')
  const matched = source.match(SEGMENT_REGEX) || []

  return matched.map((segment, index) => ({
    id: `${index}:${segment.slice(0, 12)}`,
    text: segment,
    normalized: normalizeSegment(segment),
  }))
}

function getSegmentTone(count, total) {
  if (!count || total <= 1) return 'p20'

  const ratio = count / total
  if (ratio >= 1) return 'p100'
  if (ratio >= 0.8) return 'p80'
  if (ratio >= 0.6) return 'p60'
  if (ratio >= 0.4) return 'p40'
  return 'p20'
}

export function buildAfterStoryVariantAnalysis(items) {
  const prepared = (items || []).map((item) => ({
    ...item,
    segments: splitAfterStoryText(item.text),
  }))

  const segmentCounts = new Map()
  for (const item of prepared) {
    const uniqueSegments = new Set(
      item.segments
        .map((segment) => segment.normalized)
        .filter(Boolean)
    )

    uniqueSegments.forEach((segment) => {
      segmentCounts.set(segment, (segmentCounts.get(segment) || 0) + 1)
    })
  }

  return prepared.map((item) => ({
    ...item,
    segments: item.segments.map((segment) => ({
      ...segment,
      tone: segment.normalized
        ? getSegmentTone(segmentCounts.get(segment.normalized), prepared.length)
        : 'p100',
    })),
  }))
}

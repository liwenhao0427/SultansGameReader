const COMMENT_FIELDS = ['__ca', 'key__c']

let relationsPromise = null

const ENDING_NAME_ALIASES = {
  无尽长夜: '无尽夜',
}

function cleanDecorativeText(text) {
  return String(text || '')
    .replace(/^[\s\-—─=]+|[\s\-—─=]+$/g, '')
    .trim()
}

export function normalizeEndingName(text) {
  const normalized = cleanDecorativeText(text)
    .replace(/^消卡结局/, '')
    .replace(/^结局/, '')
    .replace(/的总结后日谈$/, '')
    .replace(/后日谈$/, '')
    .replace(/（[^）]*）|\([^)]*\)/g, '')
    .replace(/[「」『』—【】《》〈〉，。！？：；\s]/g, '')
    .trim()

  return ENDING_NAME_ALIASES[normalized] || normalized
}

export function extractEndingHintsFromComment(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { ids: [], names: [] }
  }

  const ids = Array.from(text.matchAll(/[（(](\d{1,3})[）)]/g)).map((match) => match[1])
  const names = []
  const cleaned = cleanDecorativeText(text)

  const endingIndex = cleaned.indexOf('结局')
  if (endingIndex !== -1) {
    const normalized = normalizeEndingName(cleaned.slice(endingIndex + 2))
    if (normalized) names.push(normalized)
  }

  const afterStoryMatch = cleaned.match(/^(.+?)(?:的?(?:总结)?后日谈)$/)
  if (afterStoryMatch) {
    const normalized = normalizeEndingName(afterStoryMatch[1])
    if (normalized) names.push(normalized)
  }

  return {
    ids: Array.from(new Set(ids)),
    names: Array.from(new Set(names)),
  }
}

function buildOverIndex(overEntries) {
  const byId = new Map()
  const idsByName = new Map()

  for (const entry of overEntries) {
    const id = String(entry.id)
    byId.set(id, entry)

    const normalizedName = normalizeEndingName(entry.name)
    if (!normalizedName) continue

    if (!idsByName.has(normalizedName)) {
      idsByName.set(normalizedName, new Set())
    }

    idsByName.get(normalizedName).add(id)
  }

  return { byId, idsByName }
}

function resolveOverIdsFromComments(comments, overIndex) {
  const matchedIds = new Set()

  for (const text of comments) {
    const { ids, names } = extractEndingHintsFromComment(text)

    ids.forEach((id) => {
      if (overIndex.byId.has(id)) {
        matchedIds.add(id)
      }
    })

    names.forEach((name) => {
      const idsByName = overIndex.idsByName.get(name)
      if (!idsByName) return
      idsByName.forEach((id) => matchedIds.add(id))
    })
  }

  return Array.from(matchedIds)
}

function sortExtras(extras) {
  return extras
    .map((item, index) => ({ ...item, __order: index }))
    .sort((a, b) => ((a.sort ?? 999) - (b.sort ?? 999)) || (a.__order - b.__order))
}

export function extractSectionCommentsByKey(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) return {}

  const lines = rawText.split(/\r?\n/)
  const commentsByKey = {}
  let pendingComment = null

  for (const line of lines) {
    const commentMatch = line.match(/\/\/\s*(-+\s*结局.+?)\s*$/)
    if (commentMatch) {
      pendingComment = commentMatch[1].trim()
      continue
    }

    const keyMatch = line.match(/"key"\s*:\s*"([^"]+)"/)
    if (keyMatch && pendingComment) {
      commentsByKey[keyMatch[1]] = pendingComment
      pendingComment = null
    }
  }

  return commentsByKey
}

export function buildAfterStoryRelations(afterStoryRecords, overEntries) {
  const overIndex = buildOverIndex(overEntries)
  const overToAfterStoryMap = new Map()
  const afterStoryToOverMap = new Map()

  for (const record of afterStoryRecords) {
    const afterStoryId = String(record.id)
    const extras = sortExtras(Array.isArray(record.extra) ? record.extra : [])
    let currentOverIds = []

    for (const item of extras) {
      const comments = COMMENT_FIELDS
        .map((field) => item[field])
        .concat(item.__source_section_comment ? [item.__source_section_comment] : [])
        .filter((value) => typeof value === 'string' && value.trim())

      const explicitOverIds = resolveOverIdsFromComments(comments, overIndex)
      if (explicitOverIds.length > 0) {
        currentOverIds = explicitOverIds
      }

      if (currentOverIds.length === 0) continue

      for (const overId of currentOverIds) {
        if (!overToAfterStoryMap.has(overId)) {
          overToAfterStoryMap.set(overId, new Map())
        }

        const groupsByAfterStory = overToAfterStoryMap.get(overId)
        if (!groupsByAfterStory.has(afterStoryId)) {
          groupsByAfterStory.set(afterStoryId, {
            afterStoryId,
            afterStoryName: record.name || afterStoryId,
            afterStoryImage: extras.find((entry) => entry?.pic)?.pic || null,
            afterStorySourcePath: record._source_path || null,
            items: [],
            _itemKeys: new Set(),
          })
        }

        const group = groupsByAfterStory.get(afterStoryId)
        const itemKey = item.key || `${afterStoryId}:${item.__order}`
        if (!group._itemKeys.has(itemKey)) {
          group._itemKeys.add(itemKey)
          group.items.push({
            key: itemKey,
            text: item.result_text || '',
            pic: item.pic || null,
            note: comments[0] || '',
            condition: item.condition || null,
          })
        }

        if (!afterStoryToOverMap.has(afterStoryId)) {
          afterStoryToOverMap.set(afterStoryId, new Map())
        }

        const linkedOvers = afterStoryToOverMap.get(afterStoryId)
        if (!linkedOvers.has(overId)) {
          const over = overIndex.byId.get(overId)
          linkedOvers.set(overId, {
            overId,
            overName: over?.name || overId,
            overTitle: over?.title || over?.sub_name || '',
          })
        }
      }
    }
  }

  const overToAfterStories = {}
  for (const [overId, groupsByAfterStory] of overToAfterStoryMap.entries()) {
    overToAfterStories[overId] = Array.from(groupsByAfterStory.values())
      .map((group) => ({
        afterStoryId: group.afterStoryId,
        afterStoryName: group.afterStoryName,
        afterStoryImage: group.afterStoryImage,
        afterStorySourcePath: group.afterStorySourcePath,
        items: group.items.filter((item) => item.text || item.pic),
      }))
      .filter((group) => group.items.length > 0)
      .sort((a, b) => a.afterStoryId.localeCompare(b.afterStoryId))
  }

  const afterStoryToOvers = {}
  for (const [afterStoryId, linkedOvers] of afterStoryToOverMap.entries()) {
    afterStoryToOvers[afterStoryId] = Array.from(linkedOvers.values())
      .sort((a, b) => a.overId.localeCompare(b.overId))
  }

  return { overToAfterStories, afterStoryToOvers }
}

export async function getAfterStoryRelations() {
  if (!relationsPromise) {
    relationsPromise = (async () => {
      const [afterStoryEntries, overEntries] = await Promise.all([
        window.electronAPI.configListCache('after_story'),
        window.electronAPI.configListCache('over'),
      ])

      const afterStoryRecords = await Promise.all(
        (afterStoryEntries || []).map(async (entry) => {
          const data = await window.electronAPI.configReadCache('after_story', entry.id)
          if (!data) return null

          let sourceCommentsByKey = {}
          if (data._source_path) {
            try {
              const rawText = await window.electronAPI.fileReadRaw(data._source_path)
              sourceCommentsByKey = extractSectionCommentsByKey(rawText)
            } catch {
              sourceCommentsByKey = {}
            }
          }

          const extra = Array.isArray(data.extra)
            ? data.extra.map((item) => ({
              ...item,
              __source_section_comment: sourceCommentsByKey[item.key] || null,
            }))
            : []

          return {
            ...data,
            extra,
            id: String(entry.id),
          }
        })
      )

      return buildAfterStoryRelations(
        afterStoryRecords.filter(Boolean),
        (overEntries || []).map((entry) => ({ ...entry, id: String(entry.id) }))
      )
    })()
  }

  return relationsPromise
}

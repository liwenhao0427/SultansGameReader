import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const CONTENT_STATE_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'favorite', label: '收藏' },
  { key: 'read', label: '已读' },
]

export function makeContentStateKey(type, id) {
  return `${type}:${id}`
}

export function getContentState(contentStates, type, id) {
  return contentStates[makeContentStateKey(type, id)] || { read: false, favorite: false }
}

export function matchesContentStateFilter(entryState, filterKey) {
  if (filterKey === 'read') return entryState.read
  if (filterKey === 'unread') return !entryState.read
  if (filterKey === 'favorite') return entryState.favorite
  return true
}

const useReadingStateStore = create(
  persist(
    (set, get) => ({
      contentStates: {},

      toggleRead(type, id) {
        const key = makeContentStateKey(type, id)
        const current = get().contentStates[key] || { read: false, favorite: false }

        set({
          contentStates: {
            ...get().contentStates,
            [key]: {
              ...current,
              read: !current.read,
            },
          },
        })
      },

      toggleFavorite(type, id) {
        const key = makeContentStateKey(type, id)
        const current = get().contentStates[key] || { read: false, favorite: false }

        set({
          contentStates: {
            ...get().contentStates,
            [key]: {
              ...current,
              favorite: !current.favorite,
            },
          },
        })
      },

      resetAll() {
        set({ contentStates: {} })
      },
    }),
    {
      name: 'sultan-reading-state',
      storage: createJSONStorage(() => localStorage),
    }
  )
)

export default useReadingStateStore

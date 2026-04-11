import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const CONTENT_STATE_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'favorite', label: '收藏' },
  { key: 'read', label: '已读' },
]

const READING_STATE_STORAGE_KEY = 'readingState'

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

function createReadingStateStorage() {
  return {
    getItem: async () => {
      if (window.electronAPI?.storageGetJson) {
        const persisted = await window.electronAPI.storageGetJson(READING_STATE_STORAGE_KEY)
        return persisted == null ? null : JSON.stringify(persisted)
      }

      return window.localStorage.getItem('sultan-reading-state')
    },
    setItem: async (_name, value) => {
      if (window.electronAPI?.storageSetJson) {
        return window.electronAPI.storageSetJson(READING_STATE_STORAGE_KEY, JSON.parse(value))
      }

      window.localStorage.setItem('sultan-reading-state', value)
      return true
    },
    removeItem: async () => {
      if (window.electronAPI?.storageRemoveJson) {
        return window.electronAPI.storageRemoveJson(READING_STATE_STORAGE_KEY)
      }

      window.localStorage.removeItem('sultan-reading-state')
      return true
    },
  }
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
      storage: createJSONStorage(createReadingStateStorage),
    }
  )
)

export default useReadingStateStore

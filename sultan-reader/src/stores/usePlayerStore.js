import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * usePlayerStore
 * 玩家状态模拟：已触发事件集合、计数器模拟值
 * 使用 persist 中间件持久化到 localStorage
 * 注意：Set 和 Map 不能直接序列化，需自定义 serialize/deserialize
 */
const usePlayerStore = create(
  persist(
    (set, get) => ({
      // 已触发事件 ID 集合
      triggeredEvents: new Set(),

      // 计数器 id → 模拟值
      counterValues: new Map(),

      /**
       * 切换事件触发状态（已触发则取消，未触发则标记）
       * @param {string} id - 事件 ID
       */
      toggleEvent: (id) => {
        const { triggeredEvents } = get();
        const next = new Set(triggeredEvents);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        set({ triggeredEvents: next });
      },

      /**
       * 设置计数器模拟值
       * @param {string} id - 计数器 ID
       * @param {number} value - 模拟值
       */
      setCounterValue: (id, value) => {
        const { counterValues } = get();
        const next = new Map(counterValues);
        next.set(id, value);
        set({ counterValues: next });
      },

      /**
       * 重置所有状态
       */
      resetAll: () => {
        set({ triggeredEvents: new Set(), counterValues: new Map() });
      },
    }),
    {
      name: 'sultan-player-state',
      // 自定义序列化：Set → string[]，Map → Record<string, number>
      serialize: (state) => {
        return JSON.stringify({
          ...state,
          state: {
            ...state.state,
            triggeredEvents: [...state.state.triggeredEvents],
            counterValues: Object.fromEntries(state.state.counterValues),
          },
        });
      },
      // 自定义反序列化：string[] → Set，Record<string, number> → Map
      deserialize: (str) => {
        const parsed = JSON.parse(str);
        return {
          ...parsed,
          state: {
            ...parsed.state,
            triggeredEvents: new Set(parsed.state.triggeredEvents ?? []),
            counterValues: new Map(Object.entries(parsed.state.counterValues ?? {})),
          },
        };
      },
    }
  )
);

export default usePlayerStore;

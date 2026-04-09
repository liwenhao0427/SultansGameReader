import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * usePlayerStore
 * 玩家状态模拟：已触发事件集合、计数器模拟值
 * 使用 persist 中间件持久化到 localStorage
 * 通过 createJSONStorage 的 replacer/reviver 处理 Set 和 Map
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
      storage: createJSONStorage(() => localStorage, {
        replacer: (_key, value) => {
          if (value instanceof Set) {
            return { __type: 'Set', value: [...value] };
          }

          if (value instanceof Map) {
            return { __type: 'Map', value: [...value.entries()] };
          }

          return value;
        },
        reviver: (_key, value) => {
          if (value && value.__type === 'Set') {
            return new Set(value.value ?? []);
          }

          if (value && value.__type === 'Map') {
            return new Map(value.value ?? []);
          }

          return value;
        },
      }),
    }
  )
);

export default usePlayerStore;

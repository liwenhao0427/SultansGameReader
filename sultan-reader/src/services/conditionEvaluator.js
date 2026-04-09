/**
 * conditionEvaluator.js
 * 根据玩家模拟状态对条件对象进行求值
 */

// 需要跳过的注释后缀
const COMMENT_SUFFIXES = ['__c', '__ca', '__ci'];

/**
 * 对条件对象进行求值，所有条件均满足（AND 逻辑）才返回 true
 * @param {object} conditionObj - 条件对象（如 { "counter.7000490>=": 1, "have.妻子": 1 }）
 * @param {{ triggeredEvents: Set<string>, counterValues: Map<string, number> }} playerState
 * @returns {boolean}
 */
export function evaluateCondition(conditionObj, playerState) {
  if (!conditionObj || typeof conditionObj !== 'object') return true;

  const { triggeredEvents = new Set(), counterValues = new Map() } = playerState;

  for (const key of Object.keys(conditionObj)) {
    // 跳过注释字段
    if (COMMENT_SUFFIXES.some((s) => key.endsWith(s))) continue;

    const value = conditionObj[key];
    let m;

    if (key === 'any') {
      // any：子条件中至少一个满足
      if (!evaluateAny(value, playerState)) return false;
    } else if ((m = key.match(/^have\.(.+)$/))) {
      // 拥有卡牌：已触发事件集合中存在，或计数器 > 0
      const cardId = m[1];
      const ok = triggeredEvents.has(cardId) || (counterValues.get(cardId) ?? 0) > 0;
      if (!ok) return false;
    } else if ((m = key.match(/^!have\.(.+)$/))) {
      // 不拥有卡牌
      const cardId = m[1];
      if (triggeredEvents.has(cardId)) return false;
    } else if ((m = key.match(/^counter\.(.+)>=$/))) {
      // 计数器 >=
      const id = m[1];
      if ((counterValues.get(id) ?? 0) < value) return false;
    } else if ((m = key.match(/^counter\.(.+)<$/))) {
      // 计数器 <
      const id = m[1];
      if ((counterValues.get(id) ?? 0) >= value) return false;
    } else if ((m = key.match(/^counter\.(.+)=$/))) {
      // 计数器 =
      const id = m[1];
      if ((counterValues.get(id) ?? 0) !== value) return false;
    }
    // 其他未知条件：默认不阻断，继续
  }

  return true;
}

/**
 * 对 any 子条件求值，至少一个满足则返回 true
 * @param {object} anyObj - any 的值（子条件对象）
 * @param {object} playerState
 * @returns {boolean}
 */
function evaluateAny(anyObj, playerState) {
  if (!anyObj || typeof anyObj !== 'object') return true;

  for (const key of Object.keys(anyObj)) {
    if (COMMENT_SUFFIXES.some((s) => key.endsWith(s))) continue;
    // 将每个子条件包装为单独对象递归求值
    const subCondition = { [key]: anyObj[key] };
    if (evaluateCondition(subCondition, playerState)) return true;
  }

  return false;
}

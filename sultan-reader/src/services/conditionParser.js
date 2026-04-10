/**
 * conditionParser.js
 * 将游戏配置中编码在 key 名里的条件表达式转换为人类可读文本
 */

// 需要跳过的注释后缀
const COMMENT_SUFFIXES = ['__c', '__ca', '__ci'];

/**
 * 从 cardsMap 中查找卡牌名称，找不到则返回原始 ID
 * @param {string} id
 * @param {Map<string, string>} cardsMap
 * @returns {string}
 */
function resolveCardName(id, cardsMap) {
  return (cardsMap && cardsMap.get(id)) || id;
}

/**
 * 将单个条件 key 解析为人类可读字符串
 * @param {string} key - 条件 key（如 "counter.7000490>="、"!have.妻子"）
 * @param {*} value - 条件值（如 1）
 * @param {string|null} comment - __c 注释文本（优先级最高）
 * @param {Map<string, string>} cardsMap - 卡牌 id → name 映射
 * @returns {string}
 */
export function parseCondition(key, value, comment, cardsMap) {
  // 优先使用注释文本
  if (comment) return comment;

  let m;

  // 拥有卡牌
  if ((m = key.match(/^have\.(.+)$/))) {
    return `拥有 ${resolveCardName(m[1], cardsMap)}`;
  }

  // 不拥有卡牌
  if ((m = key.match(/^!have\.(.+)$/))) {
    return `不拥有 ${resolveCardName(m[1], cardsMap)}`;
  }

  // 计数器 >=
  if ((m = key.match(/^counter\.(\d+)>=$/))) {
    return `计数器 ≥ ${value}`;
  }

  // 计数器 <
  if ((m = key.match(/^counter\.(\d+)<$/))) {
    return `计数器 < ${value}`;
  }

  // 计数器 =
  if ((m = key.match(/^counter\.(\d+)=$/))) {
    return `计数器 = ${value}`;
  }

  // 计数器加法（action 中）
  if ((m = key.match(/^counter\+(\d+)$/))) {
    return `计数器 +${value}`;
  }

  // 计数器减法（action 中）
  if ((m = key.match(/^counter-(\d+)$/))) {
    return `计数器 -${value}`;
  }

  // 表中存在字段
  if ((m = key.match(/^table_have\.(.+)\.(.+)$/))) {
    return `表 ${m[1]} 存在 ${m[2]}`;
  }

  // 卡位是某卡牌
  if ((m = key.match(/^s(\d+)\.is$/))) {
    const cardName = resolveCardName(String(value), cardsMap);
    return `卡位 ${m[1]} 是 ${cardName}`;
  }

  // 当前作用域内是某卡牌（如仪式槽位条件被裁剪后只剩 is）
  if (key === 'is') {
    const values = Array.isArray(value) ? value : [value];
    return `是 ${values.map((item) => resolveCardName(String(item), cardsMap)).join(' / ')}`;
  }

  // 当前作用域内不是某卡牌
  if (key === '!is') {
    const values = Array.isArray(value) ? value : [value];
    return `不是 ${values.map((item) => resolveCardName(String(item), cardsMap)).join(' / ')}`;
  }

  // 检定属性 >=
  if ((m = key.match(/^r(\d+):(.+)>=$/))) {
    return `检定 ${m[2]} ≥ ${value}`;
  }

  // 未匹配，返回原始 key 名
  return key;
}

/**
 * 遍历条件对象，将所有条件解析为可读文本数组
 * @param {object} conditionObj - 条件对象
 * @param {Map<string, string>} cardsMap - 卡牌 id → name 映射
 * @returns {string[]}
 */
export function parseConditionObject(conditionObj, cardsMap) {
  if (!conditionObj || typeof conditionObj !== 'object') return [];

  const results = [];

  for (const key of Object.keys(conditionObj)) {
    // 跳过注释字段
    if (COMMENT_SUFFIXES.some((s) => key.endsWith(s))) continue;

    const value = conditionObj[key];
    // 读取同名 __c 注释
    const comment = conditionObj[`${key}__c`] || null;

    if (key === 'any') {
      // 递归解析 any 子对象
      const subConditions = parseConditionObject(value, cardsMap);
      results.push(`满足任意一项: ${subConditions.join(', ')}`);
    } else {
      results.push(parseCondition(key, value, comment, cardsMap));
    }
  }

  return results;
}

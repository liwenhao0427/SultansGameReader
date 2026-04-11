/**
 * edgeExtractor.js
 * 从节点数据中递归提取关联边（关系）
 */

// 字段名 → 目标节点类型的映射表
const FIELD_TYPE_MAP = {
  event_on: 'event',
  event_off: 'event',
  rite: 'rite',
  loot: 'loot',
  rite_end: 'event',
  card: 'card',
  link_card: 'card',
};

// 需要跳过的元数据字段后缀
const SKIP_SUFFIXES = ['__c', '__ca', '__ci', '_source_path'];

/**
 * 判断字段名是否为元数据字段，应跳过
 * @param {string} key
 * @returns {boolean}
 */
function isMetaField(key) {
  return SKIP_SUFFIXES.some((suffix) => key.endsWith(suffix));
}

/**
 * 根据 JSON 路径字符串判断分支类型
 * @param {string} path
 * @returns {'success' | 'failed' | 'default'}
 */
function getBranchType(path) {
  if (path.includes('success')) return 'success';
  if (path.includes('failed')) return 'failed';
  return 'default';
}

/**
 * 从对象中递归提取边
 * @param {string} source - 源节点 ID（如 "event:5300000"）
 * @param {object} obj - 当前遍历的对象
 * @param {string} currentPath - 当前 JSON 路径
 * @param {Map<string, object>} edgeMap - 去重用的边 Map，key 为边 ID
 */
function extractFromObject(source, obj, currentPath, edgeMap) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;

  for (const key of Object.keys(obj)) {
    // 跳过元数据字段
    if (isMetaField(key)) continue;

    const value = obj[key];
    const fieldPath = currentPath ? `${currentPath}.${key}` : key;

    // 检查是否为目标提取字段
    if (key in FIELD_TYPE_MAP) {
      const targetType = FIELD_TYPE_MAP[key];
      const branchType = getBranchType(fieldPath);
      // 读取同名 __c 注释字段作为 conditionText
      const conditionText = obj[`${key}__c`] || null;

      // 值可以是单个 ID 或 ID 数组
      const ids = Array.isArray(value) ? value : [value];
      for (const id of ids) {
        if (id == null) continue;
        const target = `${targetType}:${id}`;
        const edgeId = `${source}->${target}:${fieldPath}`;
        if (!edgeMap.has(edgeId)) {
          edgeMap.set(edgeId, {
            source,
            target,
            path: fieldPath,
            branchType,
            conditionText,
            conditionObj: obj.condition || null,
            resultTitle: obj.result_title || '',
            resultText: obj.result_text || obj.tips_text || '',
          });
        }
      }
      // 提取完字段后继续遍历（字段值本身若为对象也可能含嵌套）
      continue;
    }

    // 递归遍历嵌套对象
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      extractFromObject(source, value, fieldPath, edgeMap);
    } else if (Array.isArray(value)) {
      // 遍历数组中的每个对象元素
      value.forEach((item, idx) => {
        if (item && typeof item === 'object') {
          extractFromObject(source, item, `${fieldPath}[${idx}]`, edgeMap);
        }
      });
    }
  }
}

/**
 * 从节点数据中提取所有关联边
 * @param {string} nodeType - 节点类型（如 "event"）
 * @param {string|number} nodeId - 节点 ID（如 5300000）
 * @param {object} data - 节点的完整缓存数据
 * @returns {Array<{ source, target, path, branchType, conditionText }>}
 */
export function extractEdges(nodeType, nodeId, data) {
  if (!data || typeof data !== 'object') return [];

  const source = `${nodeType}:${nodeId}`;
  // 使用 Map 去重，key 为边 ID
  const edgeMap = new Map();

  // 优先遍历 settlement 数组（主要数据结构）
  if (Array.isArray(data.settlement)) {
    data.settlement.forEach((entry, idx) => {
      extractFromObject(source, entry, `settlement[${idx}]`, edgeMap);
    });
  }

  // 遍历其他可能含边的顶层字段（如 settlement_prior、settlement_extre 等）
  for (const key of Object.keys(data)) {
    if (isMetaField(key)) continue;
    if (key === 'settlement') continue; // 已处理

    const value = data[key];
    if (key in FIELD_TYPE_MAP) {
      // 顶层直接提取字段
      const targetType = FIELD_TYPE_MAP[key];
      const branchType = getBranchType(key);
      const conditionText = data[`${key}__c`] || null;
      const ids = Array.isArray(value) ? value : [value];
      for (const id of ids) {
        if (id == null) continue;
        const target = `${targetType}:${id}`;
        const edgeId = `${source}->${target}:${key}`;
        if (!edgeMap.has(edgeId)) {
          edgeMap.set(edgeId, {
            source,
            target,
            path: key,
            branchType,
            conditionText,
            conditionObj: data.condition || null,
            resultTitle: data.result_title || '',
            resultText: data.result_text || data.text || '',
          });
        }
      }
    } else if (Array.isArray(value) && key !== 'settlement') {
      // 其他数组字段（如 settlement_prior、settlement_extre）
      value.forEach((item, idx) => {
        if (item && typeof item === 'object') {
          extractFromObject(source, item, `${key}[${idx}]`, edgeMap);
        }
      });
    }
  }

  // loot 结构中，item 里的 { type, id } 同样表示可跳转目标
  if (nodeType === 'loot' && Array.isArray(data.item)) {
    data.item.forEach((entry, idx) => {
      const targetType = typeof entry?.type === 'string' ? entry.type : null;
      const targetId = entry?.id != null ? String(entry.id) : null;
      if (!targetType || !targetId) return;

      const target = `${targetType}:${targetId}`;
      const path = `item[${idx}]`;
      const edgeId = `${source}->${target}:${path}`;
      if (edgeMap.has(edgeId)) return;

      edgeMap.set(edgeId, {
        source,
        target,
        path,
        branchType: 'default',
        conditionText: null,
        conditionObj: entry?.condition || null,
        resultTitle: '',
        resultText: entry?.weight != null ? `weight: ${entry.weight}` : '',
      });
    });
  }

  return Array.from(edgeMap.values());
}

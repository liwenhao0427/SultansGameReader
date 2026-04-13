/**
 * 游戏配置文件解析器
 *
 * 注释内联策略（命名规范）：
 *   key__c   — key 自身的行尾注释（inline comment）
 *   key__ca  — key 自身的上方注释（above comment，可能多行，用 \n 连接）
 *   key__ci  — key 的值是数组时，元素注释数组（item comments）
 *              每项为 { c, ca } 或 null，与数组元素一一对应
 *
 * 三个后缀互不冲突：
 *   - __c / __ca 描述 key 本身
 *   - __ci 描述 key 对应数组的元素
 *
 * 重复 key 合并规则：
 *   ARRAY_MERGE_KEYS 中的 key 出现多次时，所有值展平合并为一个数组。
 *   注释也对应合并：__ci 按合并后顺序排列。
 */

const { stripComments } = require('./commentStripper');

// 解析器版本号，用于缓存失效判断（修改解析逻辑时需同步更新此版本号）
const PARSER_VERSION = "1.1.0";

const ARRAY_MERGE_KEYS = new Set([
  'rite', 'event_on', 'rite_end', 'card', 'loot', 'choose',
]);

// ─── 工具 ────────────────────────────────────────────────────────────────────

function removeTrailingCommas(str) {
  return str.replace(/,(\s*[}\]])/g, '$1');
}

/**
 * 将注释列表按行号建立索引，方便 O(1) 查找
 * 返回两个 Map：
 *   byLine   — line → comment（行尾注释，isAbove=false）
 *   aboveLine — line → [comments]（上方注释块，isAbove=true，按行号分组）
 *
 * "上方注释块"的归属：找到注释后的第一个非空行（即 key 所在行）
 */
function buildCommentIndex(comments) {
  // 行尾注释：直接按行号索引
  const byLine = new Map();
  // 上方注释：按"紧随其后的内容行"索引
  // 先收集所有 isAbove 注释，按行号排序，然后归属到下一个内容行
  const aboveRaw = []; // { line, text }

  for (const c of comments) {
    if (!c.isAbove) {
      // 同一行可能有多条注释（理论上不会，但防御一下）
      if (!byLine.has(c.line)) byLine.set(c.line, []);
      byLine.get(c.line).push(c.text);
    } else {
      aboveRaw.push(c);
    }
  }

  // aboveRaw 已按解析顺序（行号升序）排列
  // 归属策略：连续的上方注释行归属到它们之后第一个出现的"内容行"
  // 这里我们不预先归属，而是在 tokenizer 中按位置查询
  // 返回原始列表，tokenizer 自行按 pos 范围查找
  return { byLine, aboveRaw };
}

// ─── 主 tokenizer ─────────────────────────────────────────────────────────────

/**
 * 注释感知的 tokenizer
 *
 * 输入：已剥离注释的 JSON 字符串 + 原始注释列表
 * 输出：解析后的 JS 对象，注释以 __c / __ca / __ci 字段内联
 */
function tokenParseWithComments(str, comments) {
  let pos = 0;
  let currentLine = 1; // 跟踪当前解析位置对应的行号

  const { byLine, aboveRaw } = buildCommentIndex(comments);

  // 推进 pos 并同步更新 currentLine
  function advance(n = 1) {
    for (let i = 0; i < n; i++) {
      if (str[pos] === '\n') currentLine++;
      pos++;
    }
  }

  function skipWhitespace() {
    while (pos < str.length && /\s/.test(str[pos])) advance();
  }

  // 获取某行的行尾注释（合并为字符串）
  function getInlineComment(line) {
    const arr = byLine.get(line);
    return arr ? arr.join(' ') : null;
  }

  // 获取在 [fromLine, toLine) 范围内的所有上方注释，合并为字符串
  // fromLine: 上一个 token 结束后的行，toLine: 当前 key 所在行
  function getAboveComments(fromLine, toLine) {
    const texts = aboveRaw
      .filter(c => c.line >= fromLine && c.line < toLine)
      .map(c => c.text);
    return texts.length ? texts.join('\n') : null;
  }

  function parseValue() {
    skipWhitespace();
    if (pos >= str.length) throw new Error(`Unexpected end at pos ${pos}`);
    const ch = str[pos];
    if (ch === '{') return parseObject();
    if (ch === '[') return parseArrayWithComments().value;
    if (ch === '"') return parseString();
    if (ch === 't') return parseLiteral('true', true);
    if (ch === 'f') return parseLiteral('false', false);
    if (ch === 'n') return parseLiteral('null', null);
    if (ch === '-' || (ch >= '0' && ch <= '9')) return parseNumber();
    throw new Error(`Unexpected char '${ch}' at pos ${pos}, line ${currentLine}`);
  }

  function isValueStartChar(ch) {
    if (!ch) return false;
    return ch === '{'
      || ch === '['
      || ch === '"'
      || ch === '-'
      || ch === 't'
      || ch === 'f'
      || ch === 'n'
      || (ch >= '0' && ch <= '9');
  }

  function parseLiteral(word, value) {
    if (str.slice(pos, pos + word.length) === word) {
      advance(word.length);
      return value;
    }
    throw new Error(`Expected '${word}' at pos ${pos}`);
  }

  function parseString() {
    advance(); // skip "
    let s = '';
    while (pos < str.length) {
      const ch = str[pos];
      if (ch === '\\') {
        advance();
        const esc = str[pos]; advance();
        switch (esc) {
          case '"': s += '"'; break;
          case '\\': s += '\\'; break;
          case '/': s += '/'; break;
          case 'b': s += '\b'; break;
          case 'f': s += '\f'; break;
          case 'n': s += '\n'; break;
          case 'r': s += '\r'; break;
          case 't': s += '\t'; break;
          case 'u': {
            const hex = str.slice(pos, pos + 4);
            s += String.fromCharCode(parseInt(hex, 16));
            advance(4);
            break;
          }
          default: s += esc;
        }
      } else if (ch === '"') {
        advance(); break;
      } else {
        s += ch; advance();
      }
    }
    return s;
  }

  function parseNumber() {
    const start = pos;
    if (str[pos] === '-') advance();
    while (pos < str.length && str[pos] >= '0' && str[pos] <= '9') advance();
    if (pos < str.length && str[pos] === '.') {
      advance();
      while (pos < str.length && str[pos] >= '0' && str[pos] <= '9') advance();
    }
    if (pos < str.length && (str[pos] === 'e' || str[pos] === 'E')) {
      advance();
      if (str[pos] === '+' || str[pos] === '-') advance();
      while (pos < str.length && str[pos] >= '0' && str[pos] <= '9') advance();
    }
    return Number(str.slice(start, pos));
  }

  /**
   * 解析数组，同时收集每个元素的注释
   * - 元素是对象：注释直接写入对象的 __c / __ca 字段
   * - 元素是标量（数字/字符串/布尔/null）：收集到 itemComments 数组
   * 返回 { value: Array, itemComments: Array<{c,ca}|null>|null }
   *   itemComments 仅在存在标量元素注释时非 null
   */
  function parseArrayWithComments() {
    advance(); // skip [
    const arr = [];
    let scalarComments = null; // 懒初始化，只有标量有注释时才创建
    let scalarIndex = 0;

    skipWhitespace();
    if (str[pos] === ']') { advance(); return { value: arr, itemComments: null }; }

    let prevEndLine = currentLine;

    while (pos < str.length) {
      skipWhitespace();
      const elemStartLine = currentLine;
      const ca = getAboveComments(prevEndLine, elemStartLine);

      const value = parseValue();
      const valueEndLine = currentLine;
      const c = getInlineComment(valueEndLine);

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // 对象元素：注释直接写入
        if (c)  value['__c']  = c;
        if (ca) value['__ca'] = ca;
        arr.push(value);
      } else {
        // 标量元素：收集到 itemComments
        arr.push(value);
        if (c || ca) {
          if (!scalarComments) scalarComments = [];
          // 补齐之前没有注释的槽位
          while (scalarComments.length < scalarIndex) scalarComments.push(null);
          scalarComments.push({ c: c || null, ca: ca || null });
        }
        scalarIndex++;
      }

      prevEndLine = valueEndLine;

      skipWhitespace();
      if (str[pos] === ',') {
        advance();
        skipWhitespace();
        if (str[pos] === ']') { advance(); return { value: arr, itemComments: scalarComments }; }
      } else if (isValueStartChar(str[pos])) {
        // 宽松模式：部分 Mod 文件会漏写数组元素之间的逗号，这里降级兼容。
        continue;
      } else if (str[pos] === ']') {
        advance();
        return { value: arr, itemComments: scalarComments };
      } else {
        throw new Error(`Expected ',' or ']' at pos ${pos}, line ${currentLine}`);
      }
    }
    throw new Error('Unterminated array');
  }

  function parseObject() {
    advance(); // skip {
    const obj = {};
    // Map<key, { values: [], inlineComments: [], aboveComments: [], itemCommentsList: [] }>
    const keyData = new Map();

    skipWhitespace();
    if (str[pos] === '}') { advance(); return obj; }

    let prevEndLine = currentLine;

    while (pos < str.length) {
      skipWhitespace();
      if (str[pos] !== '"') throw new Error(`Expected '"' at pos ${pos}, line ${currentLine}, got '${str[pos]}'`);

      const keyStartLine = currentLine;
      // 上方注释：从上一个 value 结束行到本 key 开始行之间
      const ca = getAboveComments(prevEndLine, keyStartLine);

      const key = parseString();
      skipWhitespace();
      if (str[pos] !== ':') throw new Error(`Expected ':' at pos ${pos}`);
      advance(); // skip :

      skipWhitespace();
      const valueStartLine = currentLine;

      // 判断值是否为数组，以便收集元素注释
      let value, itemComments = null;
      if (str[pos] === '[') {
        const result = parseArrayWithComments();
        value = result.value;
        itemComments = result.itemComments;
      } else {
        value = parseValue();
      }

      const valueEndLine = currentLine;
      // 行尾注释：值结束所在行
      const c = getInlineComment(valueEndLine);

      if (!keyData.has(key)) {
        keyData.set(key, { values: [], inlineComments: [], aboveComments: [], itemCommentsList: [] });
      }
      const kd = keyData.get(key);
      kd.values.push(value);
      kd.inlineComments.push(c || null);
      kd.aboveComments.push(ca || null);
      kd.itemCommentsList.push(itemComments);

      prevEndLine = valueEndLine;

      skipWhitespace();
      if (str[pos] === ',') {
        advance();
        skipWhitespace();
        if (str[pos] === '}') { advance(); break; }
      } else if (str[pos] === '"') {
        // 宽松模式：部分 Mod 文件会漏写对象字段之间的逗号，这里降级兼容。
        continue;
      } else if (str[pos] === '}') {
        advance(); break;
      } else {
        throw new Error(`Expected ',' or '}' at pos ${pos}, line ${currentLine}, got '${str[pos]}'`);
      }
    }

    // 写入 obj，处理重复 key 合并
    for (const [key, kd] of keyData) {
      const { values, inlineComments, aboveComments, itemCommentsList } = kd;

      // 取第一个非 null 的上方注释和行尾注释作为 key 自身注释
      const firstCa = aboveComments.find(x => x != null) || null;
      const firstC  = inlineComments.find(x => x != null) || null;

      if (values.length === 1) {
        obj[key] = values[0];
        if (firstC)  obj[`${key}__c`]  = firstC;
        if (firstCa) obj[`${key}__ca`] = firstCa;
        // 标量数组元素注释（对象元素的注释已直接写入元素内）
        if (itemCommentsList[0]) {
          obj[`${key}__ci`] = itemCommentsList[0];
        }
      } else if (ARRAY_MERGE_KEYS.has(key)) {
        // 合并为数组，展平
        const merged = [];
        const mergedScalarComments = [];
        let hasScalarComments = false;
        for (let i = 0; i < values.length; i++) {
          const v  = values[i];
          const ic = itemCommentsList[i]; // 标量注释数组或 null
          if (Array.isArray(v)) {
            merged.push(...v);
            if (ic) {
              // 补齐
              while (mergedScalarComments.length < merged.length - v.length) mergedScalarComments.push(null);
              mergedScalarComments.push(...ic);
              hasScalarComments = true;
            }
          } else {
            merged.push(v);
            // 标量值本身的注释
            const elemC  = inlineComments[i] || null;
            const elemCa = aboveComments[i]  || null;
            if (elemC || elemCa) {
              while (mergedScalarComments.length < merged.length - 1) mergedScalarComments.push(null);
              mergedScalarComments.push({ c: elemC, ca: elemCa });
              hasScalarComments = true;
            }
          }
        }
        obj[key] = merged;
        if (firstC)  obj[`${key}__c`]  = firstC;
        if (firstCa) obj[`${key}__ca`] = firstCa;
        if (hasScalarComments) obj[`${key}__ci`] = mergedScalarComments;
      } else {
        // 未知重复 key，合并为数组
        obj[key] = values;
        if (firstC)  obj[`${key}__c`]  = firstC;
        if (firstCa) obj[`${key}__ca`] = firstCa;
      }
    }

    return obj;
  }

  const result = parseValue();
  return result;
}

// ─── 快速路径（无重复 key 且无需注释内联时）────────────────────────────────────

function hasDuplicateMergeKeys(jsonStr) {
  for (const key of ARRAY_MERGE_KEYS) {
    const pattern = new RegExp(`"${key}"\\s*:`, 'g');
    if ((jsonStr.match(pattern) || []).length > 1) return true;
  }
  return false;
}

// ─── 主解析函数 ───────────────────────────────────────────────────────────────

/**
 * @param {string} source - 原始文件内容
 * @returns {{ data: object, comments: Array, error: string|null }}
 */
function parseGameConfig(source) {
  // Step 1: 剥离注释，收集注释元数据
  let stripped, comments;
  try {
    ({ stripped, comments } = stripComments(source));
  } catch (e) {
    return { data: null, comments: [], error: `注释剥离失败: ${e.message}` };
  }

  // Step 2: 移除尾随逗号
  let cleaned;
  try {
    cleaned = removeTrailingCommas(stripped);
  } catch (e) {
    return { data: null, comments, error: `尾随逗号处理失败: ${e.message}` };
  }

  // Step 3: 解析（注释内联进结果）
  let data;
  try {
    data = tokenParseWithComments(cleaned, comments);
  } catch (e) {
    // 降级：提取基本字段
    const idMatch    = /"id"\s*:\s*(\d+)/.exec(cleaned);
    const nameMatch  = /"name"\s*:\s*"([^"]*)"/.exec(cleaned);
    const textMatch  = /"text"\s*:\s*"([^"]*)"/.exec(cleaned);
    if (idMatch) {
      data = { id: parseInt(idMatch[1]), _parseError: true, _parseErrorMessage: e.message };
      if (nameMatch) data.name = nameMatch[1];
      if (textMatch) data.text = textMatch[1];
      return { data, comments, error: `解析失败（已提取基本字段）: ${e.message}` };
    }
    return { data: null, comments, error: `解析失败: ${e.message}` };
  }

  return { data, comments, error: null };
}

module.exports = { parseGameConfig, removeTrailingCommas, PARSER_VERSION };

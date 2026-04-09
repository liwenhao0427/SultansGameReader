/**
 * 注释感知的源码扫描器
 *
 * 不直接剥离注释，而是返回一个 token 流，每个 token 包含：
 *   - 原始字符（或注释内容）
 *   - 行号、列号
 *   - 类型：'char' | 'line_comment' | 'block_comment'
 *
 * 供 gameConfigParser 的 tokenizer 在解析时直接查询注释位置。
 *
 * 同时提供 stripComments() 兼容接口，返回 { stripped, comments }。
 */

/**
 * 扫描源码，返回注释列表和去注释后的文本
 * comments 每条：{ line, col, type, text, isAbove }
 *   isAbove: 该注释所在行在注释前没有任何非空白内容（独占行）
 */
function stripComments(source) {
  const comments = [];
  let result = '';
  let i = 0;
  let line = 1;
  let col = 0;
  let lineHasContent = false;

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    // 字符串：原样保留
    if (ch === '"') {
      result += ch; i++; col++;
      lineHasContent = true;
      while (i < source.length) {
        const sc = source[i];
        if (sc === '\\') {
          result += source[i] + (source[i + 1] || '');
          i += 2; col += 2;
        } else if (sc === '"') {
          result += sc; i++; col++; break;
        } else if (sc === '\n') {
          result += sc; i++; line++; col = 0;
        } else {
          result += sc; i++; col++;
        }
      }
      continue;
    }

    // 块注释
    if (ch === '/' && next === '*') {
      const startLine = line, startCol = col;
      i += 2; col += 2;
      let text = '';
      while (i < source.length) {
        if (source[i] === '*' && source[i + 1] === '/') { i += 2; col += 2; break; }
        if (source[i] === '\n') { text += '\n'; i++; line++; col = 0; }
        else { text += source[i]; i++; col++; }
      }
      const trimmed = text.trim();
      if (trimmed) {
        const newlines = (text.match(/\n/g) || []).length;
        result += '\n'.repeat(newlines);
        comments.push({ line: startLine, col: startCol, type: 'block', text: trimmed, isAbove: !lineHasContent });
      }
      continue;
    }

    // 行注释
    if (ch === '/' && next === '/') {
      const startLine = line, startCol = col;
      i += 2; col += 2;
      let text = '';
      while (i < source.length && source[i] !== '\n') { text += source[i]; i++; col++; }
      const trimmed = text.trim();
      if (trimmed) {
        comments.push({ line: startLine, col: startCol, type: 'line', text: trimmed, isAbove: !lineHasContent });
      }
      continue;
    }

    if (ch === '\n') {
      result += ch; i++; line++; col = 0; lineHasContent = false; continue;
    }
    if (ch !== ' ' && ch !== '\t' && ch !== '\r') lineHasContent = true;
    result += ch; i++; col++;
  }

  return { stripped: result, comments };
}

module.exports = { stripComments };

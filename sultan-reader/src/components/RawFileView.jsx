// 原始文件内容弹窗组件，带简单语法高亮

// 注释字段标签样式
const commentTagStyle = {
  display: 'inline-block',
  marginLeft: 6,
  padding: '0 5px',
  background: '#313244',
  color: '#a6e3a1',
  borderRadius: 3,
  fontSize: 10,
  verticalAlign: 'middle',
}

// 注释字段名列表（原始文件中这些是注释，不是字段）
const COMMENT_FIELDS = ['__c', '__ca', '__ci']

/**
 * 对单行文本进行语法高亮，返回 React 元素数组
 * 规则：字符串黄色、数字蓝色、其他默认色
 */
function highlightLine(line) {
  const parts = []
  // 简单状态机：逐字符扫描，识别字符串和数字
  let i = 0
  let buf = ''
  let inString = false
  let strBuf = ''

  const flush = () => {
    if (buf) {
      // 检测数字片段（可能混在 key/value 中）
      const numReg = /(-?\d+\.?\d*)/g
      let last = 0
      let m
      while ((m = numReg.exec(buf)) !== null) {
        if (m.index > last) {
          parts.push(<span key={parts.length} style={{ color: '#cdd6f4' }}>{buf.slice(last, m.index)}</span>)
        }
        parts.push(<span key={parts.length} style={{ color: '#89b4fa' }}>{m[0]}</span>)
        last = m.index + m[0].length
      }
      if (last < buf.length) {
        parts.push(<span key={parts.length} style={{ color: '#cdd6f4' }}>{buf.slice(last)}</span>)
      }
      buf = ''
    }
  }

  while (i < line.length) {
    const ch = line[i]
    if (!inString && ch === '"') {
      flush()
      inString = true
      strBuf = '"'
      i++
    } else if (inString) {
      strBuf += ch
      if (ch === '"' && line[i - 1] !== '\\') {
        // 检查是否为注释字段名
        const fieldName = strBuf.slice(1, -1)
        const isCommentField = COMMENT_FIELDS.some(f => fieldName === f || fieldName.endsWith(f))
        parts.push(
          <span key={parts.length} style={{ color: '#f9e2af' }}>
            {strBuf}
            {isCommentField && <span style={commentTagStyle}>注释</span>}
          </span>
        )
        strBuf = ''
        inString = false
      }
      i++
    } else {
      buf += ch
      i++
    }
  }
  if (inString) {
    // 未闭合字符串
    parts.push(<span key={parts.length} style={{ color: '#f9e2af' }}>{strBuf}</span>)
  } else {
    flush()
  }
  return parts
}

/**
 * 渲染单行，判断是否为注释行
 */
function renderLine(line, idx) {
  const trimmed = line.trimStart()
  // 单行注释
  if (trimmed.startsWith('//')) {
    return (
      <div key={idx} style={{ color: '#a6e3a1' }}>{line}</div>
    )
  }
  // 块注释开头
  if (trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return (
      <div key={idx} style={{ color: '#a6e3a1' }}>{line}</div>
    )
  }
  return (
    <div key={idx}>{highlightLine(line)}</div>
  )
}

/**
 * RawFileView — 原始文件内容全屏弹窗
 * props: content（文件文本内容）, onClose（关闭回调）
 */
export default function RawFileView({ content, onClose }) {
  const lines = (content || '').split('\n')

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      {/* 弹窗主体，阻止点击穿透 */}
      <div
        style={{
          background: '#1e1e2e',
          border: '1px solid #313244',
          borderRadius: 6,
          width: '82vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 16,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ color: '#89b4fa', fontSize: 13, fontWeight: 'bold' }}>原始文件</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#a6adc8', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
          >✕</button>
        </div>

        {/* 代码内容区 */}
        <pre style={{
          flex: 1,
          overflowY: 'auto',
          fontSize: 11,
          lineHeight: '1.6',
          margin: 0,
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}>
          {lines.map((line, idx) => renderLine(line, idx))}
        </pre>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useResolvedImage } from '../../services/imageResolver'
import { parseConditionObject } from '../../services/conditionParser'

// 每页显示的 extra 条目数
const PAGE_SIZE = 10

const S = {
  title: { color: '#89b4fa', fontSize: 15, fontWeight: 'bold', marginBottom: 6 },
  img: { maxWidth: '100%', borderRadius: 4, marginBottom: 10 },
  imgPlaceholder: { width: 80, height: 80, background: '#313244', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#585b70', fontSize: 11, marginBottom: 10 },
  chapterTitle: { color: '#89b4fa', fontSize: 12, fontWeight: 'bold', margin: '10px 0 4px', borderLeft: '3px solid #89b4fa', paddingLeft: 6 },
  entryBox: { background: '#181825', borderRadius: 4, padding: '8px 10px', marginBottom: 8 },
  condTag: { color: '#f9e2af', fontSize: 11, display: 'block', lineHeight: '1.6' },
  resultText: { color: '#cdd6f4', fontSize: 12, lineHeight: '1.6', whiteSpace: 'pre-wrap', marginTop: 6 },
  comment: { color: '#a6adc8', fontSize: 11 },
}

/** 角色立绘 */
function CharImage({ pic }) {
  const { url, loading } = useResolvedImage(pic)
  if (!pic) return null
  if (loading) return <div style={S.imgPlaceholder}>加载中…</div>
  if (!url) return <div style={S.imgPlaceholder}>无图片</div>
  return <img src={url} alt="" style={S.img} />
}

/** 单个 extra 条目 */
function ExtraItem({ item }) {
  const conditions = parseConditionObject(item.condition)
  return (
    <div style={S.entryBox}>
      {/* 条目注释 */}
      {item.key__c && <div style={S.comment}>{item.key__c}</div>}

      {/* 条件 */}
      {conditions.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          {conditions.map((c, i) => <span key={i} style={S.condTag}>{c}</span>)}
        </div>
      )}

      {/* 条目立绘 */}
      {item.pic && <CharImage pic={item.pic} />}

      {/* 结果文本 */}
      {item.result_text && <div style={S.resultText}>{item.result_text}</div>}
    </div>
  )
}

/**
 * AfterStoryDetail — 后日谈详情组件
 * @param {{ data: object }} props
 */
export default function AfterStoryDetail({ data }) {
  // 当前页码（从 0 开始）
  const [page, setPage] = useState(0)

  // data 变化时重置页码
  useEffect(() => { setPage(0) }, [data])

  if (!data) return null

  const extras = Array.isArray(data.extra) ? data.extra : []

  // 是否需要分页（条目数超过 PAGE_SIZE 才显示分页控件）
  const needPaging = extras.length > PAGE_SIZE
  const totalPages = needPaging ? Math.ceil(extras.length / PAGE_SIZE) : 1

  // 当前页的 extra 切片
  const pageExtras = needPaging
    ? extras.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : extras

  // 构建章节分组：遇到有 __ca 的条目时开启新章节
  const buildChapters = (items) => {
    const chapters = []
    let currentChapter = { title: null, items: [] }
    for (const item of items) {
      if (item.__ca) {
        if (currentChapter.items.length > 0 || currentChapter.title) {
          chapters.push({ ...currentChapter })
        }
        currentChapter = { title: item.__ca, items: [item] }
      } else {
        currentChapter.items.push(item)
      }
    }
    if (currentChapter.items.length > 0 || currentChapter.title) {
      chapters.push(currentChapter)
    }
    return chapters
  }

  const chapters = buildChapters(pageExtras)

  // 切换页面时滚动到顶部
  const handlePageChange = (newPage) => {
    setPage(newPage)
    window.scrollTo(0, 0)
  }

  return (
    <div>
      {/* 角色名称 */}
      <div style={S.title}>{data.name || `后日谈 ${data.id}`}</div>

      {/* 角色立绘（顶层 pic 字段） */}
      {data.pic && <CharImage pic={data.pic} />}

      {/* 章节列表 */}
      {chapters.map((ch, ci) => (
        <div key={ci}>
          {ch.title && <div style={S.chapterTitle}>{ch.title}</div>}
          {ch.items.map((item, ii) => <ExtraItem key={ii} item={item} />)}
        </div>
      ))}

      {/* 无章节时直接显示所有条目 */}
      {chapters.length === 0 && pageExtras.map((item, i) => <ExtraItem key={i} item={item} />)}

      {/* 分页控件（条目数 > PAGE_SIZE 时显示） */}
      {needPaging && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, justifyContent: 'center' }}>
          <button disabled={page === 0} onClick={() => handlePageChange(page - 1)}>上一页</button>
          <span>{page + 1} / {totalPages}</span>
          <button disabled={page === totalPages - 1} onClick={() => handlePageChange(page + 1)}>下一页</button>
        </div>
      )}
    </div>
  )
}

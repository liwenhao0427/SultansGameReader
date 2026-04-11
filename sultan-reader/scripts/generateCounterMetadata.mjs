import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')
const sourcePath = path.join(projectRoot, '相关知识', '计数器.md')
const outputPath = path.join(projectRoot, 'sultan-reader', 'src', 'constants', 'generatedCounterLabels.js')

function parseCounterDoc(content) {
  const entries = []
  const seen = new Set()

  content.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\|\s*~?~?(\d+)\s*~?~?\s*\|\s*([^|]+?)\s*\|/)
    if (!match) return

    const id = match[1].trim()
    const label = match[2].trim()
    if (!id || !label || seen.has(id)) return

    seen.add(id)
    entries.push([id, label])
  })

  return entries.sort((left, right) => Number(left[0]) - Number(right[0]))
}

function buildModuleSource(entries) {
  const body = entries
    .map(([id, label]) => `  ${JSON.stringify(id)}: ${JSON.stringify(label)},`)
    .join('\n')

  return `/**
 * 计数器文案映射。
 * 由 scripts/generateCounterMetadata.mjs 从“相关知识/计数器.md”生成，请勿手改。
 */
export const GENERATED_COUNTER_LABELS = {
${body}
}
`
}

const raw = fs.readFileSync(sourcePath, 'utf8')
const entries = parseCounterDoc(raw)

if (entries.length === 0) {
  throw new Error('未能从“相关知识/计数器.md”解析出任何计数器映射')
}

fs.writeFileSync(outputPath, buildModuleSource(entries), 'utf8')
console.log(`已生成 ${entries.length} 条计数器映射：${path.relative(projectRoot, outputPath)}`)

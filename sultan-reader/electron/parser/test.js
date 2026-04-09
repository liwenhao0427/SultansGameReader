/**
 * 解析器测试脚本
 * 
 * 用法：node test.js <config目录路径>
 * 例：node test.js ../../../config
 * 
 * 对所有配置文件跑一遍，输出统计和错误列表。
 */

const fs = require('fs');
const path = require('path');
const { parseGameConfig } = require('./gameConfigParser');
const { CacheManager, resolveConfigDir } = require('./cacheManager');

// 支持两种用法：
//   node test.js <config目录>        直接指定配置目录
//   node test.js --game <游戏根目录>  从游戏路径推导配置目录
let configDir;
if (process.argv[2] === '--game') {
  configDir = resolveConfigDir(process.argv[3]);
  console.log(`游戏路径: ${process.argv[3]}`);
  console.log(`推导配置目录: ${configDir}`);
} else {
  configDir = process.argv[2] || path.join(__dirname, '../../../config');
}

const cacheDir = path.join(__dirname, '../../../cache');

// 需要扫描的子目录和单文件
const SCAN_TARGETS = [
  { type: 'event',       dir: 'event' },
  { type: 'rite',        dir: 'rite' },
  { type: 'loot',        dir: 'loot' },
  { type: 'after_story', dir: 'after_story' },
  { type: 'dt',          dir: 'dt' },
  { type: 'init',        dir: 'init' },
  { type: 'wizard',      dir: 'wizard' },
  { type: 'rite_template', dir: 'rite_template' },
];

const SINGLE_FILES = [
  'cards.json',
  'upgrade.json',
  'over.json',
  'quest.json',
  'variable.json',
  'tag.json',
  'credits.json',
  'imagestyle.json',
];

let totalFiles = 0;
let successCount = 0;
let errorCount = 0;
let parseErrorCount = 0;
const errors = [];

function testFile(filePath, label) {
  totalFiles++;
  let source;
  try {
    source = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    errors.push({ label, error: `读取失败: ${e.message}` });
    errorCount++;
    return;
  }

  const { data, comments, error } = parseGameConfig(source);

  if (!data) {
    errors.push({ label, error: error || '解析返回 null' });
    errorCount++;
    return;
  }

  if (data._parseError) {
    errors.push({ label, error: `解析错误（已降级）: ${error}` });
    parseErrorCount++;
    // 降级解析也算部分成功
    successCount++;
    return;
  }

  successCount++;

  // 验证：检查是否有重复 key 被正确合并
  // 通过检查 event_on 是否为数组（如果存在多个）
  if (label.includes('event/5300000')) {
    // 这个文件有已知的重复 event_on
    const settlement = data.settlement;
    if (settlement && settlement[0] && settlement[0].action) {
      const success = settlement[0].action.success;
      if (success && success.event_on) {
        const isArray = Array.isArray(success.event_on);
        console.log(`  [验证] 5300000 success.event_on 是数组: ${isArray} (值: ${JSON.stringify(success.event_on)})`);
      }
    }
  }
}

function scanDir(dirPath, type) {
  if (!fs.existsSync(dirPath)) {
    console.log(`  跳过（目录不存在）: ${dirPath}`);
    return;
  }
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  process.stdout.write(`  扫描 ${type}: ${files.length} 个文件...`);
  const cache = new CacheManager(cacheDir);
  for (const f of files) {
    const id = path.basename(f, '.json');
    const sourcePath = path.join(dirPath, f);
    totalFiles++;
    const { data, error } = cache.read(sourcePath, type, id);
    if (!data) {
      errors.push({ label: `${type}/${f}`, error: error || '返回 null' });
      errorCount++;
    } else if (data._parseError) {
      errors.push({ label: `${type}/${f}`, error: `降级: ${error}` });
      parseErrorCount++;
      successCount++;
    } else {
      successCount++;
      if (`${type}/${f}` === 'event/5300000.json') {
        const s = data.settlement?.[0]?.action?.success;
        if (s?.event_on) {
          console.log(`\n  [验证] 5300000 success.event_on 是数组: ${Array.isArray(s.event_on)} (值: ${JSON.stringify(s.event_on)})`);
        }
      }
    }
    if (error && !data?._parseError) {
      errors.push({ label: `${type}/${f}`, error });
      errorCount++;
    }
  }
  console.log(' 完成');
}

function testSingleFile(filePath, label) {
  totalFiles++;
  const cache = new CacheManager(cacheDir);
  const type = 'single';
  const id = path.basename(filePath, '.json');
  if (!fs.existsSync(filePath)) return;
  const { data, error } = cache.read(filePath, type, id);
  if (!data) { errors.push({ label, error: error || '返回 null' }); errorCount++; }
  else if (data._parseError) { parseErrorCount++; successCount++; }
  else { successCount++; }
}

console.log(`\n=== 苏丹的游戏配置文件解析测试 ===`);
console.log(`配置目录: ${configDir}\n`);

// 扫描子目录
for (const { type, dir } of SCAN_TARGETS) {
  scanDir(path.join(configDir, dir), type);
}

// 扫描单文件
console.log('  扫描单文件...');
for (const f of SINGLE_FILES) {
  testSingleFile(path.join(configDir, f), f);
}

// 输出结果
console.log('\n=== 测试结果 ===');
console.log(`总文件数:     ${totalFiles}`);
console.log(`完全成功:     ${successCount - parseErrorCount}`);
console.log(`降级成功:     ${parseErrorCount}`);
console.log(`失败:         ${errorCount}`);
console.log(`成功率:       ${((successCount / totalFiles) * 100).toFixed(1)}%`);

if (errors.length > 0) {
  console.log(`\n=== 错误列表（${errors.length} 个）===`);
  for (const { label, error } of errors) {
    console.log(`  [${label}] ${error}`);
  }
}

// 额外：测试注释提取
console.log('\n=== 注释提取示例（event/5300000.json）===');
const samplePath = path.join(configDir, 'event/5300000.json');
if (fs.existsSync(samplePath)) {
  const { data, comments } = parseGameConfig(fs.readFileSync(samplePath, 'utf-8'));
  console.log(`  提取到 ${comments.length} 条注释`);
  comments.slice(0, 5).forEach(c => {
    console.log(`  [行${c.line} ${c.isAbove ? '上方' : '行尾'}] ${c.text}`);
  });
}

// 额外：测试 after_story 注释（条件注释）
console.log('\n=== 注释提取示例（after_story/2000008.json）===');
const asPath = path.join(configDir, 'after_story/2000008.json');
if (fs.existsSync(asPath)) {
  const { data, comments } = parseGameConfig(fs.readFileSync(asPath, 'utf-8'));
  console.log(`  提取到 ${comments.length} 条注释`);
  // 找出 condition 相关注释
  const condComments = comments.filter(c => 
    c.text.includes('条件') || c.text.includes('counter') || c.text.includes('结局')
  );
  condComments.slice(0, 8).forEach(c => {
    console.log(`  [行${c.line} ${c.isAbove ? '上方' : '行尾'}] ${c.text}`);
  });
}

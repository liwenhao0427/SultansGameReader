/**
 * Mod 导入辅助函数
 *
 * 负责：
 * 1. 解析 mod/config 下的 JSON 配置
 * 2. 计算配置文件对应的缓存目标位置
 * 3. 按 key 合并单文件聚合缓存
 */

const fs = require('fs');
const path = require('path');
const { parseGameConfig, PARSER_VERSION } = require('./gameConfigParser');

const MOD_DIRECTORY_TYPE_MAP = {
  after_story: 'after_story',
  event: 'event',
  loot: 'loot',
  rite: 'rite',
  dt: 'dt',
  init: 'init',
  wizard: 'wizard',
  rite_template: 'rite_template',
};

const MOD_SINGLE_FILE_TARGETS = {
  'cards.json': { type: 'single', id: 'cards' },
  'upgrade.json': { type: 'single', id: 'upgrade' },
  'over.json': { type: 'single', id: 'over' },
  'quest.json': { type: 'single', id: 'quest' },
  'variable.json': { type: 'single', id: 'variable' },
  'tag.json': { type: 'single', id: 'tag' },
  'over_music_config.json': { type: 'single', id: 'over_music_config' },
  'sfx_config.json': { type: 'single', id: 'sfx_config' },
};

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function buildCacheEntryFromSource(sourcePath, rawSource, mtimeMs = Date.now()) {
  const { data, error } = parseGameConfig(rawSource);

  return {
    _source_path: sourcePath,
    _cached_at: Date.now(),
    _source_mtime: mtimeMs,
    _parser_version: PARSER_VERSION,
    _parse_error: error,
    ...(data || {}),
  };
}

function splitCacheMetadata(record) {
  const metadata = {};
  const data = {};

  for (const [key, value] of Object.entries(record || {})) {
    if (key.startsWith('_')) {
      metadata[key] = value;
    } else {
      data[key] = value;
    }
  }

  return { metadata, data };
}

function mergeCacheEntries(existingRecord, incomingRecord) {
  const { data: existingData } = splitCacheMetadata(existingRecord);
  const { metadata: incomingMetadata, data: incomingData } = splitCacheMetadata(incomingRecord);

  const mergedData = isPlainObject(existingData) && isPlainObject(incomingData)
    ? { ...existingData, ...incomingData }
    : incomingData;

  return {
    ...incomingMetadata,
    ...mergedData,
  };
}

function resolveModSingleFileTarget(fileName) {
  return MOD_SINGLE_FILE_TARGETS[fileName]
    || { type: 'single', id: path.basename(fileName, '.json') };
}

function findExistingChildPath(rootDir, names) {
  for (const name of names) {
    const candidate = path.join(rootDir, name);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveModInfoPath(modDir) {
  return findExistingChildPath(modDir, ['Info.json', 'info.json']);
}

function resolveModPreviewPath(modDir) {
  return findExistingChildPath(modDir, ['preview.jpg', 'Preview.jpg', 'preview.png', 'Preview.png']);
}

function readModInfo(modDir) {
  const infoPath = resolveModInfoPath(modDir);
  if (!infoPath) return null;

  try {
    const raw = fs.readFileSync(infoPath, 'utf-8');
    const { data } = parseGameConfig(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return null;
    }

    return {
      name: data.name || '',
      description: data.description || '',
      tags: Array.isArray(data.tags) ? data.tags.filter(Boolean) : [],
      version: data.version || '',
    };
  } catch {
    return null;
  }
}

function isModDirectory(modDir) {
  if (!modDir || !fs.existsSync(modDir)) return false;
  if (!fs.statSync(modDir).isDirectory()) return false;

  const infoPath = resolveModInfoPath(modDir);
  const configDir = path.join(modDir, 'config');
  const imageDir = path.join(modDir, 'image');
  const bgmDir = path.join(modDir, 'bgm');

  return Boolean(
    infoPath
    || (fs.existsSync(configDir) && fs.statSync(configDir).isDirectory())
    || (fs.existsSync(imageDir) && fs.statSync(imageDir).isDirectory())
    || (fs.existsSync(bgmDir) && fs.statSync(bgmDir).isDirectory())
  );
}

function summarizeModDirectory(modDir) {
  const info = readModInfo(modDir) || {};
  const configDir = path.join(modDir, 'config');
  const imageDir = path.join(modDir, 'image');
  const bgmDir = path.join(modDir, 'bgm');
  const previewPath = resolveModPreviewPath(modDir);

  return {
    path: modDir,
    dirName: path.basename(modDir),
    name: info.name || path.basename(modDir),
    description: info.description || '',
    tags: Array.isArray(info.tags) ? info.tags.filter(Boolean) : [],
    version: info.version || '',
    previewPath,
    hasInfo: Boolean(resolveModInfoPath(modDir)),
    hasConfig: fs.existsSync(configDir) && fs.statSync(configDir).isDirectory(),
    hasImage: fs.existsSync(imageDir) && fs.statSync(imageDir).isDirectory(),
    hasBgm: fs.existsSync(bgmDir) && fs.statSync(bgmDir).isDirectory(),
  };
}

function listModsInRoot(rootDir) {
  if (!rootDir || !fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    return [];
  }

  const found = new Map();
  if (isModDirectory(rootDir)) {
    found.set(path.normalize(rootDir), summarizeModDirectory(rootDir));
  }

  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const childDir = path.join(rootDir, entry.name);
    if (!isModDirectory(childDir)) continue;
    found.set(path.normalize(childDir), summarizeModDirectory(childDir));
  }

  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}

function buildModDirectoryTreeLines(modDir, options = {}) {
  const {
    maxDepth = 4,
    maxEntriesPerDir = 40,
  } = options;

  if (!modDir || !fs.existsSync(modDir) || !fs.statSync(modDir).isDirectory()) {
    return [];
  }

  const lines = [];

  function walk(currentDir, depth) {
    if (depth > maxDepth) {
      lines.push(`${'  '.repeat(depth)}...`);
      return;
    }

    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
      .sort((left, right) => {
        if (left.isDirectory() && !right.isDirectory()) return -1;
        if (!left.isDirectory() && right.isDirectory()) return 1;
        return left.name.localeCompare(right.name, 'zh-CN');
      });

    const visibleEntries = entries.slice(0, maxEntriesPerDir);
    for (const entry of visibleEntries) {
      const prefix = '  '.repeat(depth);
      lines.push(`${prefix}${entry.isDirectory() ? '[D]' : '[F]'} ${entry.name}`);

      if (entry.isDirectory()) {
        walk(path.join(currentDir, entry.name), depth + 1);
      }
    }

    if (entries.length > maxEntriesPerDir) {
      lines.push(`${'  '.repeat(depth)}... 其余 ${entries.length - maxEntriesPerDir} 项已省略`);
    }
  }

  lines.push(`[D] ${path.basename(modDir)}`);
  walk(modDir, 1);
  return lines;
}

module.exports = {
  MOD_DIRECTORY_TYPE_MAP,
  buildCacheEntryFromSource,
  buildModDirectoryTreeLines,
  isModDirectory,
  listModsInRoot,
  mergeCacheEntries,
  readModInfo,
  resolveModInfoPath,
  resolveModSingleFileTarget,
};

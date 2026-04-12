'use strict';

/**
 * Electron 主进程入口
 * 职责：
 *   1. 创建 BrowserWindow，加载 Vite 开发服务器或构建产物
 *   2. 注册 sultan-asset:// 自定义协议，安全加载本地图片
 *   3. 使用 electron-store 持久化用户设置
 *   4. 注册所有 IPC handlers（config: / asset: / file: / settings: 四组）
 *   5. 主进程内存搜索索引（避免 IPC 传输全量数据）
 */

const { app, BrowserWindow, ipcMain, protocol, net, dialog, shell } = require('electron');
const path   = require('path');
const fs     = require('fs');
const { pathToFileURL } = require('url');
const { spawn, exec } = require('child_process');
const appMeta = require('../appMeta.json');

// 动态 require electron-store（ESM 包，需要用 import() 或 createRequire）
let Store;

// 解析器模块（已完成，直接集成）
const { CacheManager, resolveConfigDir } = require('./parser/cacheManager');

// ─── 常量 ─────────────────────────────────────────────────────────────────────

/** 游戏配置目录相对路径片段，用于路径验证 */
const CONFIG_SUBPATH = path.join("Sultan's Game_Data", 'StreamingAssets', 'config');

/** 开发模式判断 */
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

/**
 * 工作区根目录（开发模式下 electron/ 的上两级）
 * sultan-reader/electron/main.js → sultan-reader/ → 工作区根
 */
const WORKSPACE_ROOT = isDev
  ? path.resolve(__dirname, '..', '..')  // sultan-reader/electron/ → sultan-reader/ → 工作区根
  : null;

// ─── 自定义协议注册（必须在 app.ready 之前调用）────────────────────────────────

// 将 sultan-asset:// 注册为安全的自定义协议，允许在 Renderer 中作为 img src 使用
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'sultan-asset',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

// ─── 全局状态 ─────────────────────────────────────────────────────────────────

/** electron-store 实例（app.ready 后初始化） */
let settings = null;

/** 主进程内存搜索索引：Array<{ id, type, name, text }> */
let searchIndex = [];

/** 主窗口引用 */
let mainWindow = null;

const PERSISTENT_STORAGE_FILES = {
  contentNameMap: 'content-name-map.json',
  readingState: 'reading-state.json',
};

function getDataRoot() {
  return path.join(app.getPath('appData'), 'sultan-reader-data');
}

function getPersistentDataDir() {
  const dir = path.join(getDataRoot(), 'persistent');
  ensureDir(dir);
  return dir;
}

function getPersistentStorageFile(key) {
  const fileName = PERSISTENT_STORAGE_FILES[key];
  if (!fileName) return null;
  return path.join(getPersistentDataDir(), fileName);
}

function readPersistentJson(key, fallbackValue = null) {
  const filePath = getPersistentStorageFile(key);
  if (!filePath || !fs.existsSync(filePath)) return fallbackValue;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallbackValue;
  }
}

function writePersistentJson(key, value) {
  const filePath = getPersistentStorageFile(key);
  if (!filePath) return false;
  fs.writeFileSync(filePath, JSON.stringify(value ?? null, null, 2), 'utf-8');
  return true;
}

function removePersistentJson(key) {
  const filePath = getPersistentStorageFile(key);
  if (!filePath || !fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

/** 读取卡牌总表（cache/single/cards.json） */
function readCardsCatalog() {
  const cardsPath = path.join(getCacheDir(), 'single', 'cards.json');
  if (!fs.existsSync(cardsPath)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(cardsPath, 'utf-8'));
    if (Array.isArray(data)) {
      return Object.fromEntries(data.map((card) => [String(card.id), card]));
    }
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

/** 从 cards.json 提取 id → name 精简映射，兼容数组和对象结构 */
function buildCardsLiteMap(cardsData) {
  if (!cardsData) return {};

  const cardsLite = {};
  const cardList = Array.isArray(cardsData)
    ? cardsData
    : Array.isArray(cardsData.card)
      ? cardsData.card
      : Array.isArray(cardsData.cards)
        ? cardsData.cards
        : Object.values(cardsData);

  for (const card of cardList) {
    if (card && card.id != null && card.name != null) {
      cardsLite[String(card.id)] = card.name;
    }
  }

  return cardsLite;
}

/** 读取 cache/single 下的聚合缓存文件 */
function readSingleAggregateFile(fileName) {
  const filePath = path.join(getCacheDir(), 'single', fileName);
  if (!fs.existsSync(filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/** 判断聚合缓存对象中的 key 是否是实际条目 ID */
function isAggregateEntryKey(key, value) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  if (key.startsWith('_') || key.endsWith('__ca')) return false;
  return true;
}

/** over.json 是单文件聚合缓存，这里统一展开为 [{ id, ...data }] */
function readOverEntries() {
  const data = readSingleAggregateFile('over.json');
  if (!data) return [];

  return Object.entries(data)
    .filter(([key, value]) => isAggregateEntryKey(key, value))
    .map(([id, value]) => ({
      id: String(id),
      ...value,
    }));
}

function listCacheEntriesByType(type) {
  if (type === 'card') {
    const cards = readCardsCatalog();
    return Object.values(cards)
      .filter((card) => card && card.id != null)
      .map((card) => ({
        id: String(card.id),
        name: card.name || null,
        text: card.text || null,
        title: card.title || null,
        rare: card.rare ?? null,
        image: Array.isArray(card.resource) ? (card.resource[0] || null) : (card.resource || null),
      }));
  }

  if (type === 'over') {
    return readOverEntries().map((entry) => ({
      id: entry.id,
      name: entry.name || null,
      text: entry.text || null,
      title: entry.title || entry.sub_name || null,
      icon: entry.icon || null,
      image: entry.bg || null,
    }));
  }

  const cacheDir = getCacheDir();
  const typeDir = path.join(cacheDir, type);
  if (!fs.existsSync(typeDir)) return [];

  const files = fs.readdirSync(typeDir).filter((file) => file.endsWith('.json'));
  const result = [];

  for (const file of files) {
    const id = path.basename(file, '.json');
    try {
      const data = JSON.parse(fs.readFileSync(path.join(typeDir, file), 'utf-8'));
      let image = null;

      if (type === 'loot') {
        const cards = readCardsCatalog();
        const firstCardItem = (Array.isArray(data.item) ? data.item : []).find((item) => item?.type === 'card' && item.id != null);
        const previewCard = firstCardItem ? cards[String(firstCardItem.id)] : null;
        image = previewCard
          ? (Array.isArray(previewCard.resource) ? (previewCard.resource[0] || null) : (previewCard.resource || null))
          : null;
      }

      result.push({
        id,
        name: data.name || data.dialog_tree_id || null,
        text: data.text || data.description || null,
        title: data.title || data.sub_name || null,
        image: data.pic || data.icon || image || null,
        icon: type === 'rite' ? (data.icon || null) : undefined,
        pic: type === 'after_story'
          ? (Array.isArray(data.extra) ? (data.extra.find((entry) => entry?.pic)?.pic || null) : null)
          : undefined,
        rare: type === 'loot' ? (() => {
          const cards = readCardsCatalog();
          const firstCardItem = (Array.isArray(data.item) ? data.item : []).find((item) => item?.type === 'card' && item.id != null);
          return firstCardItem ? (cards[String(firstCardItem.id)]?.rare ?? null) : null;
        })() : undefined,
      });
    } catch {
      result.push({ id, name: null, text: null });
    }
  }

  return result;
}

function buildPersistentContentNameMap() {
  const types = ['card', 'rite', 'event', 'loot', 'over', 'after_story', 'dt'];
  const nameMap = {};

  for (const type of types) {
    for (const entry of listCacheEntriesByType(type)) {
      if (!entry?.id) continue;
      nameMap[`${type}:${entry.id}`] = {
        type,
        id: String(entry.id),
        name: entry.name || entry.title || String(entry.id),
        title: entry.title || null,
        text: entry.text || null,
        image: entry.image || null,
        icon: entry.icon || null,
        rare: entry.rare ?? null,
      };
    }
  }

  return nameMap;
}

function readOrBuildContentNameMap(force = false) {
  if (!force) {
    const cached = readPersistentJson('contentNameMap', {});
    if (cached && Object.keys(cached).length > 0) {
      return cached;
    }
  }

  const nextMap = buildPersistentContentNameMap();
  writePersistentJson('contentNameMap', nextMap);
  return nextMap;
}

// ─── 初始化 electron-store ────────────────────────────────────────────────────

/**
 * 动态加载 electron-store（ESM 模块）
 * electron-store v8+ 是纯 ESM，需要动态 import
 */
async function initStore() {
  if (settings) return settings;

  // 使用 appData（而非 userData）下的独立目录，避免被 Electron session Cache 清理
  // userData = C:\Users\...\AppData\Roaming\sultan-reader（Electron 会清理其中的 Cache 目录）
  // 改用 appData\sultan-reader-data\ 作为数据根目录
  const dataRoot = getDataRoot();
  const defaultCacheDir    = path.join(dataRoot, 'cache');
  const defaultResourceDir = path.join(dataRoot, 'resource');

  try {
    const { default: ElectronStore } = await import('electron-store');
    settings = new ElectronStore({
      name: 'sultan-reader-settings',
      defaults: {
        gamePath:    '',
        cliPath:     '',
        resourceDir: defaultResourceDir,
        cacheDir:    defaultCacheDir,
      },
    });

    // 迁移旧路径：如果保存的是旧的 userData/cache 路径，自动更新为新路径
    const savedCacheDir = settings.get('cacheDir');
    const oldUserDataCache = path.join(app.getPath('userData'), 'cache');
    if (savedCacheDir === oldUserDataCache || savedCacheDir.toLowerCase() === oldUserDataCache.toLowerCase()) {
      // 旧路径有数据就迁移，没有就直接更新
      if (fs.existsSync(savedCacheDir) && hasJsonFiles(savedCacheDir)) {
        console.log(`[迁移] 旧缓存路径 ${savedCacheDir} → ${defaultCacheDir}`);
        copyDirSync(savedCacheDir, defaultCacheDir);
      }
      settings.set('cacheDir', defaultCacheDir);
    }

    const savedResourceDir = settings.get('resourceDir');
    const oldUserDataResource = path.join(app.getPath('userData'), 'resource');
    if (savedResourceDir === oldUserDataResource || savedResourceDir.toLowerCase() === oldUserDataResource.toLowerCase()) {
      settings.set('resourceDir', defaultResourceDir);
    }

  } catch (e) {
    console.warn('electron-store 加载失败，使用 JSON 降级存储:', e.message);
    settings = createFallbackStore(defaultCacheDir, defaultResourceDir);
  }
  return settings;
}

/**
 * 降级存储：基于 JSON 文件的简单 key-value store
 */
function createFallbackStore(defaultCacheDir, defaultResourceDir) {
  const storePath = path.join(app.getPath('userData'), 'settings.json');
  let data = {};
  const defaults = {
    gamePath:    '',
    cliPath:     '',
    resourceDir: defaultResourceDir || path.join(app.getPath('userData'), 'resource'),
    cacheDir:    defaultCacheDir    || path.join(app.getPath('userData'), 'cache'),
  };

  // 读取已有数据
  try {
    if (fs.existsSync(storePath)) {
      data = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    }
  } catch { data = {}; }

  const save = () => {
    try { fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8'); } catch {}
  };

  return {
    get: (key) => (key in data ? data[key] : defaults[key]),
    set: (key, value) => { data[key] = value; save(); },
    store: data,
  };
}

// ─── BrowserWindow 创建 ───────────────────────────────────────────────────────

async function createWindow() {
  await initStore();

  mainWindow = new BrowserWindow({
    width:  1280,
    height: 800,
    minWidth:  900,
    minHeight: 600,
    title: `${appMeta.title} ${appMeta.version}`,
    webPreferences: {
      preload:         path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      // 不关闭 webSecurity，通过自定义协议安全加载本地图片
      webSecurity: true,
    },
  });

  if (isDev) {
    // 开发模式：加载 Vite 开发服务器
    const devPort = process.env.VITE_DEV_SERVER_PORT || 5173;
    mainWindow.loadURL(`http://localhost:${devPort}`);
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式：加载构建产物
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── 自定义协议 handler ───────────────────────────────────────────────────────

/**
 * 注册 sultan-asset:// 协议
 * sultan-asset://Sprite/2000001.png → <resourceDir>/Sprite/2000001.png
 */
function registerAssetProtocol() {
  protocol.handle('sultan-asset', (request) => {
    // 去掉协议前缀，得到相对路径（如 Sprite/2000001.png）
    const relativePath = decodeURIComponent(
      request.url.replace(/^sultan-asset:\/\//, '')
    );
    const resourceDir = settings ? settings.get('resourceDir') : '';
    if (!resourceDir) {
      return new Response('资源目录未配置', { status: 404 });
    }
    const fullPath = path.join(resourceDir, relativePath);
    // 使用 net.fetch 返回本地文件流
    return net.fetch(`file://${fullPath}`);
  });
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/** 获取当前 cacheDir 设置 */
function getCacheDir() {
  return settings ? settings.get('cacheDir') : path.join(app.getPath('userData'), 'cache');
}

/** 获取当前 resourceDir 设置 */
function getResourceDir() {
  return settings ? settings.get('resourceDir') : path.join(app.getPath('userData'), 'resource');
}

/** 确保目录存在 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── IPC Handlers：config: 组 ─────────────────────────────────────────────────

/**
 * config:setGameDir
 * 验证游戏路径包含 Sultan's Game_Data/StreamingAssets/config，存储到 settings
 * 返回 { configDir, success }
 */
ipcMain.handle('config:setGameDir', async (_event, gamePath) => {
  const configDir = path.join(gamePath, CONFIG_SUBPATH);
  if (!fs.existsSync(configDir)) {
    return { success: false, configDir: null, error: `路径无效：找不到 ${configDir}` };
  }
  settings.set('gamePath', gamePath);
  return { success: true, configDir };
});

/**
 * config:rebuildCache
 * 实例化 CacheManager，调用 scanAll() 带进度回调
 * 同时生成 cards_lite.json（id→name 映射）到 cache/single/
 * 返回 { total, errors }
 */
ipcMain.handle('config:rebuildCache', async (event) => {
  const gamePath  = settings.get('gamePath');
  const cacheDir  = getCacheDir();

  if (!gamePath) {
    return { total: 0, errors: ['游戏路径未设置'] };
  }

  const configDir = resolveConfigDir(gamePath);
  if (!fs.existsSync(configDir)) {
    return { total: 0, errors: [`配置目录不存在: ${configDir}`] };
  }

  ensureDir(cacheDir);
  const manager = new CacheManager(cacheDir, configDir);

  // 进度回调：通过 IPC 事件发送进度到 Renderer
  // 用 setImmediate 让出事件循环，避免主进程阻塞导致 UI 无响应
  const onProgress = (current, total, id) => {
    if (event.sender && !event.sender.isDestroyed()) {
      event.sender.send('config:progress', { current, total, id });
    }
  };

  // 将同步的 scanAll 包装为异步，每处理一批文件让出一次事件循环
  const { results, errors } = await new Promise((resolve) => {
    setImmediate(() => {
      resolve(manager.scanAll(onProgress));
    });
  });

  // 生成 cards_lite.json（id → name 精简映射，供前端 conditionParser 使用）
  try {
    const singleDir = path.join(cacheDir, 'single');
    ensureDir(singleDir);
    const cardsPath = path.join(singleDir, 'cards.json');
    if (fs.existsSync(cardsPath)) {
      const cardsData = JSON.parse(fs.readFileSync(cardsPath, 'utf-8'));
      const cardsLite = buildCardsLiteMap(cardsData);
      fs.writeFileSync(
        path.join(singleDir, 'cards_lite.json'),
        JSON.stringify(cardsLite, null, 2),
        'utf-8'
      );
    }
  } catch (e) {
    console.warn('生成 cards_lite.json 失败:', e.message);
  }

  try {
    writePersistentJson('contentNameMap', buildPersistentContentNameMap());
  } catch (e) {
    console.warn('生成内容名称映射缓存失败:', e.message);
  }

  // 统计总处理文件数
  let total = 0;
  for (const map of Object.values(results)) {
    total += map.size;
  }

  return {
    success: true,
    total,
    errors: errors.map(e => (typeof e === 'string' ? e : `${e.id}: ${e.error}`)),
  };
});

/**
 * config:clearCache
 * 调用 CacheManager.invalidate(type?)，返回 { success }
 */
ipcMain.handle('config:clearCache', async (_event, type) => {
  try {
    const cacheDir  = getCacheDir();
    const gamePath  = settings.get('gamePath');
    const configDir = gamePath ? resolveConfigDir(gamePath) : cacheDir;
    const manager   = new CacheManager(cacheDir, configDir);
    manager.invalidate(type);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

/**
 * config:readCache
 * 读取 <cacheDir>/<type>/<id>.json，返回解析后的 JSON
 */
ipcMain.handle('config:readCache', async (_event, type, id) => {
  if (type === 'card') {
    const cards = readCardsCatalog();
    return cards[String(id)] || null;
  }

  if (type === 'over') {
    const entries = readSingleAggregateFile('over.json');
    if (!entries) return null;
    const record = entries[String(id)];
    return record && typeof record === 'object' ? { id: String(id), ...record } : null;
  }

  // rite_template_mappings 是 config 根目录下的单文件，不在 cache 子目录中
  if (type === 'rite_template_mappings') {
    const gamePath = settings ? settings.get('gamePath') : null;
    if (!gamePath) return null;
    const configDir = resolveConfigDir(gamePath);
    const mappingsPath = path.join(configDir, 'rite_template_mappings.json');
    if (!fs.existsSync(mappingsPath)) return null;
    try {
      const { parseGameConfig } = require('./parser/gameConfigParser');
      const raw = fs.readFileSync(mappingsPath, 'utf-8');
      const { data } = parseGameConfig(raw);
      return data || null;
    } catch (e) {
      return { _parse_error: e.message };
    }
  }

  const cacheDir = getCacheDir();
  if (!type || id == null) return null;
  const filePath = path.join(cacheDir, type, `${id}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return { _parse_error: e.message };
  }
});

/**
 * config:listCache
 * 扫描 <cacheDir>/<type>/ 目录，返回 [{ id, name, text }]
 */
ipcMain.handle('config:listCache', async (_event, type) => {
  return listCacheEntriesByType(type);
});

ipcMain.handle('config:getContentNameMap', async (_event, forceRefresh = false) => {
  return readOrBuildContentNameMap(Boolean(forceRefresh));
});

/**
 * config:buildIndex
 * 在主进程内存中构建搜索索引（扫描所有缓存文件，提取 id/type/name/text）
 * 返回统计信息 { counts: { event: N, ... } }（不传输全量数据到 Renderer）
 */
ipcMain.handle('config:buildIndex', async () => {
  const cacheDir = getCacheDir();
  if (!fs.existsSync(cacheDir)) {
    return { counts: {} };
  }

  searchIndex = []; // 清空旧索引
  const counts = {};

  // 遍历所有类型目录
  const typeDirs = fs.readdirSync(cacheDir).filter(name => {
    const full = path.join(cacheDir, name);
    return fs.statSync(full).isDirectory();
  });

  for (const type of typeDirs) {
    if (type === 'single') continue;
    const typeDir = path.join(cacheDir, type);
    const files   = fs.readdirSync(typeDir).filter(f => f.endsWith('.json'));
    counts[type]  = 0;

    for (const file of files) {
      const id = path.basename(file, '.json');
      try {
        const data = JSON.parse(fs.readFileSync(path.join(typeDir, file), 'utf-8'));
        // 提取用于搜索的字段
        const entry = {
          id,
          type,
          name: String(data.name || data.dialog_tree_id || ''),
          text: String(data.text || data.description || data.result_text || ''),
        };
        searchIndex.push(entry);
        counts[type]++;
      } catch {
        // 跳过损坏的缓存文件
      }
    }
  }

  const cards = readCardsCatalog();
  const cardEntries = Object.values(cards)
    .filter((card) => card && card.id != null)
    .map((card) => ({
      id: String(card.id),
      type: 'card',
      name: String(card.name || ''),
      text: String(card.text || card.title || ''),
    }));
  if (cardEntries.length > 0) {
    searchIndex.push(...cardEntries);
    counts.card = cardEntries.length;
  }

  const overEntries = readOverEntries().map((entry) => ({
    id: entry.id,
    type: 'over',
    name: String(entry.name || ''),
    text: String(entry.text || ''),
  }));
  if (overEntries.length > 0) {
    searchIndex.push(...overEntries);
    counts.over = overEntries.length;
  }

  return { counts };
});

/**
 * config:search
 * 在内存索引中模糊匹配，返回最多 100 条 [{ id, type, name, text }]
 * @param {string}   query  - 搜索关键字
 * @param {string[]} types  - 类型过滤（可选）
 */
ipcMain.handle('config:search', async (_event, query, types) => {
  if (!query || !query.trim()) return [];

  const q = query.trim().toLowerCase();
  const typeSet = types && types.length ? new Set(types) : null;

  const results = [];
  for (const entry of searchIndex) {
    // 类型过滤
    if (typeSet && !typeSet.has(entry.type)) continue;
    // 模糊匹配：id、name、text 任一包含关键字
    if (
      entry.id.toLowerCase().includes(q) ||
      entry.name.toLowerCase().includes(q) ||
      entry.text.toLowerCase().includes(q)
    ) {
      results.push(entry);
      if (results.length >= 100) break;
    }
  }

  return results;
});

/**
 * config:getCardsLite
 * 读取并返回 cache/single/cards_lite.json 内容（id → name 映射）
 */
ipcMain.handle('config:getCardsLite', async () => {
  const filePath = path.join(getCacheDir(), 'single', 'cards_lite.json');
  if (!fs.existsSync(filePath)) {
    return buildCardsLiteMap(readCardsCatalog());
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (data && Object.keys(data).length > 0) {
      return data;
    }
    return buildCardsLiteMap(readCardsCatalog());
  } catch {
    return buildCardsLiteMap(readCardsCatalog());
  }
});

// ─── IPC Handlers：asset: 组 ──────────────────────────────────────────────────

/**
 * asset:setCliPath
 * 存储 AssetStudio CLI 路径到 settings，返回 { success }
 */
ipcMain.handle('asset:setCliPath', async (_event, cliPath) => {
  settings.set('cliPath', cliPath);
  return { success: true };
});

/**
 * asset:extract
 * 使用 child_process.spawn 数组参数调用 AssetStudio CLI
 * 执行两次：Sprite:Both 和 Texture2D
 * 发送进度事件，返回 { success, log }
 */
ipcMain.handle('asset:extract', async (event, { gamePath, outputDir }) => {
  const cliPath = settings.get('cliPath');
  if (!cliPath || !fs.existsSync(cliPath)) {
    return { success: false, log: 'AssetStudio CLI 路径无效或未设置' };
  }

  ensureDir(outputDir);

  // 游戏数据目录（含 _Data 后缀）
  const gameDataPath = path.join(gamePath, "Sultan's Game_Data");
  const log = [];

  /**
   * 执行单次 AssetStudio CLI 调用
   * 使用数组参数，避免路径含空格/特殊字符时的命令行断裂
   */
  const runCli = (types) => new Promise((resolve, reject) => {
    const args = [
      gameDataPath,
      outputDir,
      '--game',         'Normal',
      '--types',        types,
      '--group_assets', 'ByType',
      '--image_format', 'Png',
    ];

    const proc = spawn(cliPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.stdout.on('data', (chunk) => {
      const line = chunk.toString();
      log.push(line);
      if (event.sender && !event.sender.isDestroyed()) {
        event.sender.send('asset:progress', { line, types });
      }
    });

    proc.stderr.on('data', (chunk) => {
      const line = chunk.toString();
      log.push(`[stderr] ${line}`);
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`CLI 退出码 ${code}`));
    });

    proc.on('error', reject);
  });

  try {
    // 第一次：提取 Sprite
    await runCli('Sprite:Both');
    // 第二次：提取 Texture2D
    await runCli('Texture2D');
    return { success: true, log: log.join('') };
  } catch (e) {
    return { success: false, log: log.join('') + '\n错误: ' + e.message };
  }
});

/**
 * asset:resolveImage
 * 4 步回退链：
 *   1. Texture2D/{name}.png
 *   2. Texture2D/{name}.png.png
 *   3. Sprite/{name}.png
 *   4. Sprite/{name}.png.png
 * 返回 sultan-asset:// 协议 URL 或 null
 */
ipcMain.handle('asset:resolveImage', async (_event, pic) => {
  if (!pic) return null;

  const configuredResourceDir = getResourceDir();

  // 提取文件名（去掉 "cards/" 等前缀目录）
  const name = path.basename(pic);

  // 4 步回退链
  const candidates = [
    { rel: `Texture2D/${name}.png`,      url: `sultan-asset://Texture2D/${name}.png` },
    { rel: `Texture2D/${name}.png.png`,  url: `sultan-asset://Texture2D/${name}.png.png` },
    { rel: `Sprite/${name}.png`,         url: `sultan-asset://Sprite/${name}.png` },
    { rel: `Sprite/${name}.png.png`,     url: `sultan-asset://Sprite/${name}.png.png` },
  ];

  const resourceRoots = [];
  if (configuredResourceDir) resourceRoots.push(configuredResourceDir);
  if (WORKSPACE_ROOT) resourceRoots.push(path.join(WORKSPACE_ROOT, 'resource'));

  for (const root of resourceRoots) {
    for (const { rel, url } of candidates) {
      if (fs.existsSync(path.join(root, rel))) {
        // workspace/resource 命中时也通过 sultan-asset 协议返回
        if (root === configuredResourceDir) {
          return url;
        }

        return pathToFileURL(path.join(root, rel)).toString();
      }
    }
  }

  return null;
});

/**
 * asset:checkDotnet
 * 执行 dotnet --list-runtimes，检查 .NET 8.0+
 * 返回 { available, version? }
 */
ipcMain.handle('asset:checkDotnet', async () => {
  return new Promise((resolve) => {
    exec('dotnet --list-runtimes', (error, stdout) => {
      if (error) {
        resolve({ available: false });
        return;
      }
      // 查找 .NET 8.0+ 运行时（如 Microsoft.NETCore.App 8.0.x）
      const lines = stdout.split('\n');
      for (const line of lines) {
        const match = line.match(/Microsoft\.NETCore\.App\s+(\d+)\.(\d+)/);
        if (match) {
          const major = parseInt(match[1], 10);
          if (major >= 8) {
            resolve({ available: true, version: `${match[1]}.${match[2]}` });
            return;
          }
        }
      }
      resolve({ available: false });
    });
  });
});

// ─── IPC Handlers：file: 组 ───────────────────────────────────────────────────

/**
 * file:readRaw
 * 读取文件返回 UTF-8 字符串
 */
ipcMain.handle('file:readRaw', async (_event, filePath) => {
  try {
    const candidates = [];
    const gamePath = settings?.get('gamePath');

    const appendConfigFallbacks = (relativeLikePath) => {
      const normalized = relativeLikePath
        .replace(/^.*?[\\/]config[\\/]/i, '')
        .replace(/^config[\\/]/i, '');

      if (gamePath) {
        candidates.push(path.join(resolveConfigDir(gamePath), normalized));
      }

      if (WORKSPACE_ROOT) {
        candidates.push(path.join(WORKSPACE_ROOT, 'config', normalized));
      }
    };

    if (path.isAbsolute(filePath)) {
      candidates.push(filePath);
      if (!fs.existsSync(filePath) && /[\\/]config[\\/]/i.test(filePath)) {
        appendConfigFallbacks(filePath);
      }
    } else {
      appendConfigFallbacks(filePath);

      candidates.push(path.resolve(process.cwd(), filePath));
    }

    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) {
        return fs.readFileSync(candidate, 'utf-8');
      }
    }

    throw new Error(`ENOENT: no such file or directory, open '${candidates[0] || filePath}'`);
  } catch (e) {
    throw new Error(`读取文件失败: ${e.message}`);
  }
});

ipcMain.handle('file:pickPath', async (_event, options = {}) => {
  const {
    kind = 'directory',
    title = '选择路径',
    defaultPath = '',
    filters = [],
  } = options || {};

  const properties = kind === 'file'
    ? ['openFile']
    : ['openDirectory', 'createDirectory'];

  const result = await dialog.showOpenDialog(mainWindow, {
    title,
    defaultPath: defaultPath || undefined,
    properties,
    filters: kind === 'file' ? filters : undefined,
  });

  if (result.canceled || !result.filePaths?.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('file:openFolder', async (_event, targetPath) => {
  if (!targetPath) return { success: false, error: '路径为空' };

  const normalizedPath = path.normalize(targetPath);
  const folderPath = fs.existsSync(normalizedPath) && fs.statSync(normalizedPath).isDirectory()
    ? normalizedPath
    : path.dirname(normalizedPath);

  const error = await shell.openPath(folderPath);
  if (error) {
    return { success: false, error };
  }

  return { success: true };
});

// ─── IPC Handlers：settings: 组 ──────────────────────────────────────────────

/**
 * settings:get
 * 从 electron-store 读取指定 key
 */
ipcMain.handle('settings:get', async (_event, key) => {
  return settings ? settings.get(key) : undefined;
});

/**
 * settings:set
 * 写入 electron-store
 */
ipcMain.handle('settings:set', async (_event, key, value) => {
  if (settings) settings.set(key, value);
});

ipcMain.handle('storage:getJson', async (_event, key) => {
  return readPersistentJson(key, null);
});

ipcMain.handle('storage:setJson', async (_event, key, value) => {
  return writePersistentJson(key, value);
});

ipcMain.handle('storage:removeJson', async (_event, key) => {
  return removePersistentJson(key);
});

// ─── 应用生命周期 ─────────────────────────────────────────────────────────────

/**
 * 检查目录下是否有 .json 文件（递归一层）
 */
function hasJsonFiles(dir) {
  if (!fs.existsSync(dir)) return false;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const sub = path.join(dir, entry.name);
        if (fs.readdirSync(sub).some(f => f.endsWith('.json'))) return true;
      } else if (entry.name.endsWith('.json')) {
        return true;
      }
    }
  } catch {}
  return false;
}

/**
 * 递归复制目录（目标已有文件不覆盖）
 */
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else if (!fs.existsSync(destPath)) {
      // 不覆盖已有文件
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 启动时自动迁移缓存：
 * 如果新 cacheDir 为空，但工作区 cache/ 有数据，复制过去
 */
async function migrateCacheIfNeeded() {
  if (!settings) return;
  const currentCacheDir = settings.get('cacheDir');
  if (hasJsonFiles(currentCacheDir)) return; // 已有缓存，不需要迁移

  // 查找工作区根目录的 cache/
  const candidates = [
    path.resolve(__dirname, '..', '..', 'cache'),
    path.resolve(__dirname, '..', 'cache'),
    path.resolve(process.cwd(), 'cache'),
  ];

  for (const srcCache of candidates) {
    if (hasJsonFiles(srcCache)) {
      console.log(`[迁移] 发现缓存：${srcCache} → ${currentCacheDir}`);
      try {
        copyDirSync(srcCache, currentCacheDir);
        console.log('[迁移] 缓存复制完成');
      } catch (e) {
        console.warn('[迁移] 复制失败:', e.message);
      }
      break;
    }
  }
}

app.whenReady().then(async () => {
  // 初始化 store
  await initStore();

  // 自动迁移缓存：如果 userData/cache 为空但运行目录下有 cache/，复制过去并更新设置
  await migrateCacheIfNeeded();

  // 注册自定义协议 handler（必须在 app.ready 之后）
  registerAssetProtocol();

  // 创建主窗口
  await createWindow();

  app.on('activate', async () => {
    // macOS：点击 Dock 图标时重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // macOS 以外的平台：所有窗口关闭时退出应用
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

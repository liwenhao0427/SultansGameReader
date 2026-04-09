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

const { app, BrowserWindow, ipcMain, protocol, net, dialog } = require('electron');
const path   = require('path');
const fs     = require('fs');
const { spawn, exec } = require('child_process');

// 动态 require electron-store（ESM 包，需要用 import() 或 createRequire）
let Store;

// 解析器模块（已完成，直接集成）
const { CacheManager, resolveConfigDir } = require('./parser/cacheManager');

// ─── 常量 ─────────────────────────────────────────────────────────────────────

/** 游戏配置目录相对路径片段，用于路径验证 */
const CONFIG_SUBPATH = path.join("Sultan's Game_Data", 'StreamingAssets', 'config');

/** 开发模式判断 */
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

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

// ─── 初始化 electron-store ────────────────────────────────────────────────────

/**
 * 动态加载 electron-store（ESM 模块）
 * electron-store v8+ 是纯 ESM，需要动态 import
 */
async function initStore() {
  if (settings) return settings;
  try {
    // electron-store v8 是 ESM，使用动态 import
    const { default: ElectronStore } = await import('electron-store');
    settings = new ElectronStore({
      name: 'sultan-reader-settings',
      defaults: {
        gamePath:    '',
        cliPath:     '',
        resourceDir: path.join(app.getPath('userData'), 'resource'),
        cacheDir:    path.join(app.getPath('userData'), 'cache'),
      },
    });
  } catch (e) {
    // 降级：使用简单 JSON 文件存储
    console.warn('electron-store 加载失败，使用 JSON 降级存储:', e.message);
    settings = createFallbackStore();
  }
  return settings;
}

/**
 * 降级存储：基于 JSON 文件的简单 key-value store
 */
function createFallbackStore() {
  const storePath = path.join(app.getPath('userData'), 'settings.json');
  let data = {};
  const defaults = {
    gamePath:    '',
    cliPath:     '',
    resourceDir: path.join(app.getPath('userData'), 'resource'),
    cacheDir:    path.join(app.getPath('userData'), 'cache'),
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
      const cardsLite = {};
      // cards.json 结构：{ card: [...] } 或直接是数组
      const cardList = Array.isArray(cardsData) ? cardsData
        : (cardsData.card || cardsData.cards || []);
      for (const card of cardList) {
        if (card && card.id != null && card.name != null) {
          cardsLite[String(card.id)] = card.name;
        }
      }
      fs.writeFileSync(
        path.join(singleDir, 'cards_lite.json'),
        JSON.stringify(cardsLite, null, 2),
        'utf-8'
      );
    }
  } catch (e) {
    console.warn('生成 cards_lite.json 失败:', e.message);
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
  const cacheDir = getCacheDir();
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
  const cacheDir = getCacheDir();
  const typeDir  = path.join(cacheDir, type);
  if (!fs.existsSync(typeDir)) return [];

  const files = fs.readdirSync(typeDir).filter(f => f.endsWith('.json'));
  const result = [];

  for (const file of files) {
    const id = path.basename(file, '.json');
    try {
      const data = JSON.parse(fs.readFileSync(path.join(typeDir, file), 'utf-8'));
      result.push({
        id,
        name: data.name || data.dialog_tree_id || null,
        text: data.text || data.description || null,
      });
    } catch {
      result.push({ id, name: null, text: null });
    }
  }

  return result;
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
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return {};
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
 *   1. Sprite/{name}.png
 *   2. Sprite/{name}.png.png
 *   3. Texture2D/{name}.png
 *   4. Texture2D/{name}.png.png
 * 返回 sultan-asset:// 协议 URL 或 null
 */
ipcMain.handle('asset:resolveImage', async (_event, pic) => {
  if (!pic) return null;

  const resourceDir = getResourceDir();
  if (!resourceDir) return null;

  // 提取文件名（去掉 "cards/" 等前缀目录）
  const name = path.basename(pic);

  // 4 步回退链
  const candidates = [
    { rel: `Sprite/${name}.png`,         url: `sultan-asset://Sprite/${name}.png` },
    { rel: `Sprite/${name}.png.png`,     url: `sultan-asset://Sprite/${name}.png.png` },
    { rel: `Texture2D/${name}.png`,      url: `sultan-asset://Texture2D/${name}.png` },
    { rel: `Texture2D/${name}.png.png`,  url: `sultan-asset://Texture2D/${name}.png.png` },
  ];

  for (const { rel, url } of candidates) {
    if (fs.existsSync(path.join(resourceDir, rel))) {
      return url;
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
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    throw new Error(`读取文件失败: ${e.message}`);
  }
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

// ─── 应用生命周期 ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // 初始化 store
  await initStore();

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

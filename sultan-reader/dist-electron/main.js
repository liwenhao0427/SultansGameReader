"use strict";
const { app, BrowserWindow, ipcMain, protocol, net, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { spawn, exec } = require("child_process");
const { CacheManager, resolveConfigDir } = require("./parser/cacheManager");
const CONFIG_SUBPATH = path.join("Sultan's Game_Data", "StreamingAssets", "config");
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
const WORKSPACE_ROOT = isDev ? path.resolve(__dirname, "..", "..") : null;
protocol.registerSchemesAsPrivileged([
  {
    scheme: "sultan-asset",
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);
let settings = null;
let searchIndex = [];
let mainWindow = null;
async function initStore() {
  if (settings) return settings;
  const dataRoot = path.join(app.getPath("appData"), "sultan-reader-data");
  const defaultCacheDir = path.join(dataRoot, "cache");
  const defaultResourceDir = path.join(dataRoot, "resource");
  try {
    const { default: ElectronStore } = await Promise.resolve().then(() => require("./index-Xn56FFjk.js")).then((n) => n.index);
    settings = new ElectronStore({
      name: "sultan-reader-settings",
      defaults: {
        gamePath: "",
        cliPath: "",
        resourceDir: defaultResourceDir,
        cacheDir: defaultCacheDir
      }
    });
    const savedCacheDir = settings.get("cacheDir");
    const oldUserDataCache = path.join(app.getPath("userData"), "cache");
    if (savedCacheDir === oldUserDataCache || savedCacheDir.toLowerCase() === oldUserDataCache.toLowerCase()) {
      if (fs.existsSync(savedCacheDir) && hasJsonFiles(savedCacheDir)) {
        console.log(`[迁移] 旧缓存路径 ${savedCacheDir} → ${defaultCacheDir}`);
        copyDirSync(savedCacheDir, defaultCacheDir);
      }
      settings.set("cacheDir", defaultCacheDir);
    }
    const savedResourceDir = settings.get("resourceDir");
    const oldUserDataResource = path.join(app.getPath("userData"), "resource");
    if (savedResourceDir === oldUserDataResource || savedResourceDir.toLowerCase() === oldUserDataResource.toLowerCase()) {
      settings.set("resourceDir", defaultResourceDir);
    }
  } catch (e) {
    console.warn("electron-store 加载失败，使用 JSON 降级存储:", e.message);
    settings = createFallbackStore(defaultCacheDir, defaultResourceDir);
  }
  return settings;
}
function createFallbackStore(defaultCacheDir, defaultResourceDir) {
  const storePath = path.join(app.getPath("userData"), "settings.json");
  let data = {};
  const defaults = {
    gamePath: "",
    cliPath: "",
    resourceDir: defaultResourceDir || path.join(app.getPath("userData"), "resource"),
    cacheDir: defaultCacheDir || path.join(app.getPath("userData"), "cache")
  };
  try {
    if (fs.existsSync(storePath)) {
      data = JSON.parse(fs.readFileSync(storePath, "utf-8"));
    }
  } catch {
    data = {};
  }
  const save = () => {
    try {
      fs.writeFileSync(storePath, JSON.stringify(data, null, 2), "utf-8");
    } catch {
    }
  };
  return {
    get: (key) => key in data ? data[key] : defaults[key],
    set: (key, value) => {
      data[key] = value;
      save();
    },
    store: data
  };
}
async function createWindow() {
  await initStore();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // 不关闭 webSecurity，通过自定义协议安全加载本地图片
      webSecurity: true
    }
  });
  if (isDev) {
    const devPort = process.env.VITE_DEV_SERVER_PORT || 5173;
    mainWindow.loadURL(`http://localhost:${devPort}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function registerAssetProtocol() {
  protocol.handle("sultan-asset", (request) => {
    const relativePath = decodeURIComponent(
      request.url.replace(/^sultan-asset:\/\//, "")
    );
    const resourceDir = settings ? settings.get("resourceDir") : "";
    if (!resourceDir) {
      return new Response("资源目录未配置", { status: 404 });
    }
    const fullPath = path.join(resourceDir, relativePath);
    return net.fetch(`file://${fullPath}`);
  });
}
function getCacheDir() {
  return settings ? settings.get("cacheDir") : path.join(app.getPath("userData"), "cache");
}
function getResourceDir() {
  return settings ? settings.get("resourceDir") : path.join(app.getPath("userData"), "resource");
}
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
ipcMain.handle("config:setGameDir", async (_event, gamePath) => {
  const configDir = path.join(gamePath, CONFIG_SUBPATH);
  if (!fs.existsSync(configDir)) {
    return { success: false, configDir: null, error: `路径无效：找不到 ${configDir}` };
  }
  settings.set("gamePath", gamePath);
  return { success: true, configDir };
});
ipcMain.handle("config:rebuildCache", async (event) => {
  const gamePath = settings.get("gamePath");
  const cacheDir = getCacheDir();
  if (!gamePath) {
    return { total: 0, errors: ["游戏路径未设置"] };
  }
  const configDir = resolveConfigDir(gamePath);
  if (!fs.existsSync(configDir)) {
    return { total: 0, errors: [`配置目录不存在: ${configDir}`] };
  }
  ensureDir(cacheDir);
  const manager = new CacheManager(cacheDir, configDir);
  const onProgress = (current, total2, id) => {
    if (event.sender && !event.sender.isDestroyed()) {
      event.sender.send("config:progress", { current, total: total2, id });
    }
  };
  const { results, errors } = await new Promise((resolve) => {
    setImmediate(() => {
      resolve(manager.scanAll(onProgress));
    });
  });
  try {
    const singleDir = path.join(cacheDir, "single");
    ensureDir(singleDir);
    const cardsPath = path.join(singleDir, "cards.json");
    if (fs.existsSync(cardsPath)) {
      const cardsData = JSON.parse(fs.readFileSync(cardsPath, "utf-8"));
      const cardsLite = {};
      const cardList = Array.isArray(cardsData) ? cardsData : cardsData.card || cardsData.cards || [];
      for (const card of cardList) {
        if (card && card.id != null && card.name != null) {
          cardsLite[String(card.id)] = card.name;
        }
      }
      fs.writeFileSync(
        path.join(singleDir, "cards_lite.json"),
        JSON.stringify(cardsLite, null, 2),
        "utf-8"
      );
    }
  } catch (e) {
    console.warn("生成 cards_lite.json 失败:", e.message);
  }
  let total = 0;
  for (const map of Object.values(results)) {
    total += map.size;
  }
  return {
    success: true,
    total,
    errors: errors.map((e) => typeof e === "string" ? e : `${e.id}: ${e.error}`)
  };
});
ipcMain.handle("config:clearCache", async (_event, type) => {
  try {
    const cacheDir = getCacheDir();
    const gamePath = settings.get("gamePath");
    const configDir = gamePath ? resolveConfigDir(gamePath) : cacheDir;
    const manager = new CacheManager(cacheDir, configDir);
    manager.invalidate(type);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle("config:readCache", async (_event, type, id) => {
  const cacheDir = getCacheDir();
  const filePath = path.join(cacheDir, type, `${id}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) {
    return { _parse_error: e.message };
  }
});
ipcMain.handle("config:listCache", async (_event, type) => {
  const cacheDir = getCacheDir();
  const typeDir = path.join(cacheDir, type);
  if (!fs.existsSync(typeDir)) return [];
  const files = fs.readdirSync(typeDir).filter((f) => f.endsWith(".json"));
  const result = [];
  for (const file of files) {
    const id = path.basename(file, ".json");
    try {
      const data = JSON.parse(fs.readFileSync(path.join(typeDir, file), "utf-8"));
      result.push({
        id,
        name: data.name || data.dialog_tree_id || null,
        text: data.text || data.description || null
      });
    } catch {
      result.push({ id, name: null, text: null });
    }
  }
  return result;
});
ipcMain.handle("config:buildIndex", async () => {
  const cacheDir = getCacheDir();
  if (!fs.existsSync(cacheDir)) {
    return { counts: {} };
  }
  searchIndex = [];
  const counts = {};
  const typeDirs = fs.readdirSync(cacheDir).filter((name) => {
    const full = path.join(cacheDir, name);
    return fs.statSync(full).isDirectory();
  });
  for (const type of typeDirs) {
    const typeDir = path.join(cacheDir, type);
    const files = fs.readdirSync(typeDir).filter((f) => f.endsWith(".json"));
    counts[type] = 0;
    for (const file of files) {
      const id = path.basename(file, ".json");
      try {
        const data = JSON.parse(fs.readFileSync(path.join(typeDir, file), "utf-8"));
        const entry = {
          id,
          type,
          name: String(data.name || data.dialog_tree_id || ""),
          text: String(data.text || data.description || data.result_text || "")
        };
        searchIndex.push(entry);
        counts[type]++;
      } catch {
      }
    }
  }
  return { counts };
});
ipcMain.handle("config:search", async (_event, query, types) => {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const typeSet = types && types.length ? new Set(types) : null;
  const results = [];
  for (const entry of searchIndex) {
    if (typeSet && !typeSet.has(entry.type)) continue;
    if (entry.id.toLowerCase().includes(q) || entry.name.toLowerCase().includes(q) || entry.text.toLowerCase().includes(q)) {
      results.push(entry);
      if (results.length >= 100) break;
    }
  }
  return results;
});
ipcMain.handle("config:getCardsLite", async () => {
  const filePath = path.join(getCacheDir(), "single", "cards_lite.json");
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
});
ipcMain.handle("asset:setCliPath", async (_event, cliPath) => {
  settings.set("cliPath", cliPath);
  return { success: true };
});
ipcMain.handle("asset:extract", async (event, { gamePath, outputDir }) => {
  const cliPath = settings.get("cliPath");
  if (!cliPath || !fs.existsSync(cliPath)) {
    return { success: false, log: "AssetStudio CLI 路径无效或未设置" };
  }
  ensureDir(outputDir);
  const gameDataPath = path.join(gamePath, "Sultan's Game_Data");
  const log = [];
  const runCli = (types) => new Promise((resolve, reject) => {
    const args = [
      gameDataPath,
      outputDir,
      "--game",
      "Normal",
      "--types",
      types,
      "--group_assets",
      "ByType",
      "--image_format",
      "Png"
    ];
    const proc = spawn(cliPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    proc.stdout.on("data", (chunk) => {
      const line = chunk.toString();
      log.push(line);
      if (event.sender && !event.sender.isDestroyed()) {
        event.sender.send("asset:progress", { line, types });
      }
    });
    proc.stderr.on("data", (chunk) => {
      const line = chunk.toString();
      log.push(`[stderr] ${line}`);
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`CLI 退出码 ${code}`));
    });
    proc.on("error", reject);
  });
  try {
    await runCli("Sprite:Both");
    await runCli("Texture2D");
    return { success: true, log: log.join("") };
  } catch (e) {
    return { success: false, log: log.join("") + "\n错误: " + e.message };
  }
});
ipcMain.handle("asset:resolveImage", async (_event, pic) => {
  if (!pic) return null;
  const configuredResourceDir = getResourceDir();
  const name = path.basename(pic);
  const candidates = [
    { rel: `Sprite/${name}.png`, url: `sultan-asset://Sprite/${name}.png` },
    { rel: `Sprite/${name}.png.png`, url: `sultan-asset://Sprite/${name}.png.png` },
    { rel: `Texture2D/${name}.png`, url: `sultan-asset://Texture2D/${name}.png` },
    { rel: `Texture2D/${name}.png.png`, url: `sultan-asset://Texture2D/${name}.png.png` }
  ];
  const resourceRoots = [];
  if (configuredResourceDir) resourceRoots.push(configuredResourceDir);
  if (WORKSPACE_ROOT) resourceRoots.push(path.join(WORKSPACE_ROOT, "resource"));
  for (const root of resourceRoots) {
    for (const { rel, url } of candidates) {
      if (fs.existsSync(path.join(root, rel))) {
        if (root === configuredResourceDir) {
          return url;
        }
        return pathToFileURL(path.join(root, rel)).toString();
      }
    }
  }
  return null;
});
ipcMain.handle("asset:checkDotnet", async () => {
  return new Promise((resolve) => {
    exec("dotnet --list-runtimes", (error, stdout) => {
      if (error) {
        resolve({ available: false });
        return;
      }
      const lines = stdout.split("\n");
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
ipcMain.handle("file:readRaw", async (_event, filePath) => {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (e) {
    throw new Error(`读取文件失败: ${e.message}`);
  }
});
ipcMain.handle("settings:get", async (_event, key) => {
  return settings ? settings.get(key) : void 0;
});
ipcMain.handle("settings:set", async (_event, key, value) => {
  if (settings) settings.set(key, value);
});
function hasJsonFiles(dir) {
  if (!fs.existsSync(dir)) return false;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const sub = path.join(dir, entry.name);
        if (fs.readdirSync(sub).some((f) => f.endsWith(".json"))) return true;
      } else if (entry.name.endsWith(".json")) {
        return true;
      }
    }
  } catch {
  }
  return false;
}
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
async function migrateCacheIfNeeded() {
  if (!settings) return;
  const currentCacheDir = settings.get("cacheDir");
  if (hasJsonFiles(currentCacheDir)) return;
  const candidates = [
    path.resolve(__dirname, "..", "..", "cache"),
    path.resolve(__dirname, "..", "cache"),
    path.resolve(process.cwd(), "cache")
  ];
  for (const srcCache of candidates) {
    if (hasJsonFiles(srcCache)) {
      console.log(`[迁移] 发现缓存：${srcCache} → ${currentCacheDir}`);
      try {
        copyDirSync(srcCache, currentCacheDir);
        console.log("[迁移] 缓存复制完成");
      } catch (e) {
        console.warn("[迁移] 复制失败:", e.message);
      }
      break;
    }
  }
}
app.whenReady().then(async () => {
  await initStore();
  await migrateCacheIfNeeded();
  registerAssetProtocol();
  await createWindow();
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

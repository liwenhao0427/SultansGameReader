/**
 * IPC Handler 核心逻辑单元测试（任务 1.5）
 * 测试可独立运行的纯函数逻辑（不依赖 Electron app/ipcMain）
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

// ── 从 main.js 提取的可测试纯函数 ────────────────────────────────────────────

/**
 * config:setGameDir 的路径验证逻辑
 * @param {string} gamePath
 * @param {function} existsSync - fs.existsSync 的注入（便于 mock）
 * @returns {{ success, configDir, error? }}
 */
function validateGameDir(gamePath, existsSync) {
  const CONFIG_SUBPATH = path.join("Sultan's Game_Data", 'StreamingAssets', 'config');
  const configDir = path.join(gamePath, CONFIG_SUBPATH);
  if (!existsSync(configDir)) {
    return { success: false, configDir: null, error: `路径无效：找不到 ${configDir}` };
  }
  return { success: true, configDir };
}

/**
 * asset:resolveImage 的 4 步回退链逻辑
 * @param {string} pic - 配置中的 pic 字段
 * @param {string} resourceDir - 资源目录
 * @param {function} existsSync - fs.existsSync 的注入
 * @returns {string|null} sultan-asset:// URL 或 null
 */
function resolveImageLogic(pic, resourceDir, existsSync) {
  if (!pic) return null;
  if (!resourceDir) return null;

  const name = path.basename(pic);
  const candidates = [
    { rel: `Sprite/${name}.png`,        url: `sultan-asset://Sprite/${name}.png` },
    { rel: `Sprite/${name}.png.png`,    url: `sultan-asset://Sprite/${name}.png.png` },
    { rel: `Texture2D/${name}.png`,     url: `sultan-asset://Texture2D/${name}.png` },
    { rel: `Texture2D/${name}.png.png`, url: `sultan-asset://Texture2D/${name}.png.png` },
  ];

  for (const { rel, url } of candidates) {
    if (existsSync(path.join(resourceDir, rel))) {
      return url;
    }
  }
  return null;
}

/**
 * config:search 的内存搜索逻辑
 */
function searchInMemory(index, query, types) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const typeSet = types && types.length ? new Set(types) : null;
  const results = [];
  for (const entry of index) {
    if (typeSet && !typeSet.has(entry.type)) continue;
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
}

// ── 测试：config:setGameDir 路径验证 ─────────────────────────────────────────

describe('validateGameDir (config:setGameDir)', () => {
  let tmpDir;

  beforeEach(() => {
    // 创建临时目录模拟游戏路径
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sultan-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('有效路径：存在 config 目录时返回 success: true', () => {
    // 创建模拟的游戏配置目录
    const configPath = path.join(tmpDir, "Sultan's Game_Data", 'StreamingAssets', 'config');
    fs.mkdirSync(configPath, { recursive: true });

    const result = validateGameDir(tmpDir, fs.existsSync);
    expect(result.success).toBe(true);
    expect(result.configDir).toBe(configPath);
  });

  it('无效路径：不存在 config 目录时返回 success: false', () => {
    const result = validateGameDir(tmpDir, fs.existsSync);
    expect(result.success).toBe(false);
    expect(result.configDir).toBeNull();
    expect(result.error).toContain('路径无效');
  });

  it('不存在的路径返回 success: false', () => {
    const result = validateGameDir('/不存在的路径/游戏', fs.existsSync);
    expect(result.success).toBe(false);
  });
});

// ── 测试：asset:resolveImage 4 步回退链 ──────────────────────────────────────

describe('resolveImageLogic (asset:resolveImage)', () => {
  // Windows 路径分隔符兼容：将路径统一转为正斜杠后比较
  const normalize = (p) => p.replace(/\\/g, '/');

  it('第 1 步命中：Sprite/{name}.png 存在时返回对应 URL', () => {
    const existsSync = (p) => normalize(p).endsWith('Sprite/yrl.png');
    const url = resolveImageLogic('cards/yrl', '/resource', existsSync);
    expect(url).toBe('sultan-asset://Sprite/yrl.png');
  });

  it('第 2 步命中：Sprite/{name}.png.png 存在时回退', () => {
    const existsSync = (p) => normalize(p).endsWith('Sprite/yrl.png.png');
    const url = resolveImageLogic('cards/yrl', '/resource', existsSync);
    expect(url).toBe('sultan-asset://Sprite/yrl.png.png');
  });

  it('第 3 步命中：Texture2D/{name}.png 存在时回退', () => {
    const existsSync = (p) => normalize(p).endsWith('Texture2D/yrl.png');
    const url = resolveImageLogic('cards/yrl', '/resource', existsSync);
    expect(url).toBe('sultan-asset://Texture2D/yrl.png');
  });

  it('第 4 步命中：Texture2D/{name}.png.png 存在时回退', () => {
    const existsSync = (p) => normalize(p).endsWith('Texture2D/yrl.png.png');
    const url = resolveImageLogic('cards/yrl', '/resource', existsSync);
    expect(url).toBe('sultan-asset://Texture2D/yrl.png.png');
  });

  it('所有路径都不存在时返回 null', () => {
    const existsSync = () => false;
    const url = resolveImageLogic('cards/yrl', '/resource', existsSync);
    expect(url).toBeNull();
  });

  it('pic 为空时返回 null', () => {
    const existsSync = () => true;
    expect(resolveImageLogic(null, '/resource', existsSync)).toBeNull();
    expect(resolveImageLogic('', '/resource', existsSync)).toBeNull();
  });

  it('resourceDir 为空时返回 null', () => {
    const existsSync = () => true;
    expect(resolveImageLogic('cards/yrl', '', existsSync)).toBeNull();
    expect(resolveImageLogic('cards/yrl', null, existsSync)).toBeNull();
  });

  it('正确提取文件名（去掉 cards/ 前缀）', () => {
    const normalize = (p) => p.replace(/\\/g, '/');
    const existsSync = (p) => normalize(p).endsWith('Sprite/2000001.png');
    const url = resolveImageLogic('cards/2000001', '/resource', existsSync);
    expect(url).toBe('sultan-asset://Sprite/2000001.png');
  });
});

// ── 测试：config:search 关键字搜索 ───────────────────────────────────────────

describe('searchInMemory (config:search)', () => {
  const index = [
    { id: '5300000', type: 'event', name: '', text: '开场介绍' },
    { id: '6000004', type: 'loot',  name: '情报掉落', text: '' },
    { id: '2000001', type: 'after_story', name: '主角', text: '' },
  ];

  it('按 id 搜索', () => {
    const results = searchInMemory(index, '5300000', null);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('5300000');
  });

  it('按 name 搜索', () => {
    const results = searchInMemory(index, '情报', null);
    expect(results[0].id).toBe('6000004');
  });

  it('按 text 搜索', () => {
    const results = searchInMemory(index, '开场', null);
    expect(results[0].id).toBe('5300000');
  });

  it('类型过滤生效', () => {
    const results = searchInMemory(index, '0', ['loot']);
    expect(results.every(r => r.type === 'loot')).toBe(true);
  });

  it('空查询返回空数组', () => {
    expect(searchInMemory(index, '', null)).toEqual([]);
  });
});

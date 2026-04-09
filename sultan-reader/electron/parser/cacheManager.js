/**
 * 缓存管理器
 *
 * 配置目录路径由调用方传入，不硬编码。
 * 游戏路径示例：D:\Steam\steamapps\common\Sultan's Game
 * 配置目录偏移：<gamePath>\Sultan's Game_Data\StreamingAssets\config
 *
 * 缓存文件格式：
 * {
 *   _source_path: string,       // 原始文件绝对路径
 *   _cached_at: number,         // 缓存时间戳
 *   _source_mtime: number,      // 原始文件 mtime（用于失效判断）
 *   _comments_raw: Array,       // 原始注释列表（调试用）
 *   _parse_error: string|null,
 *   ...data                     // 解析后的配置数据（注释已内联为 __c/__ca/__ci 字段）
 * }
 */

const fs   = require('fs');
const path = require('path');
const { parseGameConfig } = require('./gameConfigParser');

// 游戏配置目录相对于游戏根目录的偏移路径
const CONFIG_SUBPATH = path.join("Sultan's Game_Data", 'StreamingAssets', 'config');

/**
 * 根据游戏根目录路径推导配置目录路径
 * @param {string} gamePath - 游戏根目录，如 D:\Steam\steamapps\common\Sultan's Game
 * @returns {string} 配置目录绝对路径
 */
function resolveConfigDir(gamePath) {
  return path.join(gamePath, CONFIG_SUBPATH);
}

class CacheManager {
  /**
   * @param {string} cacheDir  - 缓存目录绝对路径（由 Electron userData 或用户指定）
   * @param {string} configDir - 游戏配置目录绝对路径（由用户选择游戏路径后推导）
   */
  constructor(cacheDir, configDir) {
    this.cacheDir  = cacheDir;
    this.configDir = configDir;
    this._ensureDir(cacheDir);
  }

  /** 更新配置目录（用户重新选择游戏路径后调用） */
  setConfigDir(configDir) {
    this.configDir = configDir;
  }

  _ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  _cachePath(type, id) {
    const typeDir = path.join(this.cacheDir, type);
    this._ensureDir(typeDir);
    return path.join(typeDir, `${id}.json`);
  }

  _isCacheValid(cachePath, sourcePath) {
    if (!fs.existsSync(cachePath)) return false;
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      const sourceStat = fs.statSync(sourcePath);
      return cached._source_mtime === sourceStat.mtimeMs;
    } catch {
      return false;
    }
  }

  /**
   * 读取单个配置文件，优先使用缓存
   * @param {string} sourcePath - 原始文件绝对路径
   * @param {string} type       - 配置类型（event/rite/loot 等）
   * @param {string} id         - 文件 ID（不含扩展名）
   */
  read(sourcePath, type, id) {
    const cachePath = this._cachePath(type, id);
    if (this._isCacheValid(cachePath, sourcePath)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        return { data: cached, fromCache: true, error: cached._parse_error || null };
      } catch { /* 缓存损坏，重新解析 */ }
    }
    return this._parseAndCache(sourcePath, type, id, cachePath);
  }

  _parseAndCache(sourcePath, type, id, cachePath) {
    let source;
    try {
      source = fs.readFileSync(sourcePath, 'utf-8');
    } catch (e) {
      return { data: null, fromCache: false, error: `读取文件失败: ${e.message}` };
    }

    const sourceStat = fs.statSync(sourcePath);
    const { data, comments, error } = parseGameConfig(source);

    const cacheEntry = {
      _source_path:  sourcePath,
      _cached_at:    Date.now(),
      _source_mtime: sourceStat.mtimeMs,
      _parse_error:  error,
      ...(data || {}),
    };

    try {
      fs.writeFileSync(cachePath, JSON.stringify(cacheEntry, null, 2), 'utf-8');
    } catch (e) {
      console.warn(`写缓存失败 ${cachePath}: ${e.message}`);
    }

    return { data: cacheEntry, fromCache: false, error };
  }

  /**
   * 批量扫描目录，解析所有配置文件
   * @param {string}   sourceDir  - 源目录绝对路径
   * @param {string}   type       - 配置类型
   * @param {function} onProgress - 进度回调 (current, total, id)
   */
  scanDirectory(sourceDir, type, onProgress) {
    if (!fs.existsSync(sourceDir)) {
      return { results: new Map(), errors: [`目录不存在: ${sourceDir}`] };
    }
    const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.json'));
    const results = new Map();
    const errors  = [];
    let current = 0;

    for (const file of files) {
      const id         = path.basename(file, '.json');
      const sourcePath = path.join(sourceDir, file);
      current++;
      if (onProgress) onProgress(current, files.length, id);

      const { data, error } = this.read(sourcePath, type, id);
      if (data)  results.set(id, data);
      if (error) errors.push({ id, file, error });
    }

    return { results, errors };
  }

  /**
   * 清除指定类型的缓存（或全部）
   * 用户手动定位新游戏路径后调用，或主动触发重新生成时调用
   * @param {string} [type] - 不传则清除全部缓存
   */
  invalidate(type) {
    const target = type ? path.join(this.cacheDir, type) : this.cacheDir;
    if (!fs.existsSync(target)) return;
    const files = fs.readdirSync(target);
    for (const f of files) {
      const fp = path.join(target, f);
      if (fs.statSync(fp).isDirectory()) {
        this.invalidate(path.join(type || '', f));
      } else {
        fs.unlinkSync(fp);
      }
    }
  }

  /**
   * 扫描全部游戏配置目录（基于 this.configDir）
   * 返回所有类型的解析结果
   */
  scanAll(onProgress) {
    const DIRS = [
      { type: 'event',         dir: 'event' },
      { type: 'rite',          dir: 'rite' },
      { type: 'loot',          dir: 'loot' },
      { type: 'after_story',   dir: 'after_story' },
      { type: 'dt',            dir: 'dt' },
      { type: 'init',          dir: 'init' },
      { type: 'wizard',        dir: 'wizard' },
      { type: 'rite_template', dir: 'rite_template' },
    ];
    const SINGLES = [
      { type: 'single', file: 'cards.json',    id: 'cards' },
      { type: 'single', file: 'upgrade.json',  id: 'upgrade' },
      { type: 'single', file: 'over.json',     id: 'over' },
      { type: 'single', file: 'quest.json',    id: 'quest' },
      { type: 'single', file: 'variable.json', id: 'variable' },
      { type: 'single', file: 'tag.json',      id: 'tag' },
    ];

    const allResults = {};
    const allErrors  = [];

    for (const { type, dir } of DIRS) {
      const { results, errors } = this.scanDirectory(
        path.join(this.configDir, dir), type, onProgress
      );
      allResults[type] = results;
      allErrors.push(...errors);
    }

    for (const { type, file, id } of SINGLES) {
      const fp = path.join(this.configDir, file);
      if (!fs.existsSync(fp)) continue;
      const { data, error } = this.read(fp, type, id);
      if (!allResults[type]) allResults[type] = new Map();
      if (data)  allResults[type].set(id, data);
      if (error) allErrors.push({ id, file, error });
    }

    return { results: allResults, errors: allErrors };
  }
}

module.exports = { CacheManager, resolveConfigDir };

'use strict';

/**
 * Preload 脚本
 * 通过 contextBridge 将 IPC 通道安全暴露为 window.electronAPI
 * Renderer 进程无法直接访问 Node.js / Electron API，只能通过此对象调用
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  // ── config: 组 ──────────────────────────────────────────────────────────────

  /** 设置游戏目录，验证路径有效性 */
  configSetGameDir: (gamePath) =>
    ipcRenderer.invoke('config:setGameDir', gamePath),

  /**
   * 重建缓存，支持可选进度回调
   * @param {(current: number, total: number, id: string) => void} [onProgress]
   */
  configRebuildCache: (onProgress) => {
    // 注册进度监听器（如有回调）
    const listener = onProgress
      ? (_event, data) => onProgress(data.current, data.total, data.id)
      : null;
    if (listener) ipcRenderer.on('config:progress', listener);

    return ipcRenderer.invoke('config:rebuildCache').finally(() => {
      // 调用完成后清理监听器，避免泄漏
      if (listener) ipcRenderer.removeListener('config:progress', listener);
    });
  },

  /** 清除缓存，type 可选（不传则清除全部） */
  configClearCache: (type) =>
    ipcRenderer.invoke('config:clearCache', type),

  /** 读取单个缓存文件 */
  configReadCache: (type, id) =>
    ipcRenderer.invoke('config:readCache', type, id),

  /** 列出某类型下所有缓存条目 */
  configListCache: (type) =>
    ipcRenderer.invoke('config:listCache', type),

  /** 在主进程构建搜索索引，返回各类型数量统计 */
  configBuildIndex: () =>
    ipcRenderer.invoke('config:buildIndex'),

  /** 主进程侧模糊搜索，返回最多 100 条匹配结果 */
  configSearch: (query, types) =>
    ipcRenderer.invoke('config:search', query, types),

  /** 获取 id→name 精简卡牌映射表（供 conditionParser 使用） */
  configGetCardsLite: () =>
    ipcRenderer.invoke('config:getCardsLite'),

  // ── asset: 组 ───────────────────────────────────────────────────────────────

  /** 设置 AssetStudio CLI 路径 */
  assetSetCliPath: (cliPath) =>
    ipcRenderer.invoke('asset:setCliPath', cliPath),

  /**
   * 执行资源提取，支持可选进度回调
   * @param {{ gamePath: string, outputDir: string }} params
   * @param {(data: { line: string, types: string }) => void} [onProgress]
   */
  assetExtract: (params, onProgress) => {
    // 注册进度监听器（如有回调）
    const listener = onProgress
      ? (_event, data) => onProgress(data)
      : null;
    if (listener) ipcRenderer.on('asset:progress', listener);

    return ipcRenderer.invoke('asset:extract', params).finally(() => {
      // 调用完成后清理监听器，避免泄漏
      if (listener) ipcRenderer.removeListener('asset:progress', listener);
    });
  },

  /** 图片路径解析，返回 sultan-asset:// URL 或 null */
  assetResolveImage: (pic) =>
    ipcRenderer.invoke('asset:resolveImage', pic),

  /** 检测 .NET 运行时是否可用 */
  assetCheckDotnet: () =>
    ipcRenderer.invoke('asset:checkDotnet'),

  // ── file: 组 ────────────────────────────────────────────────────────────────

  /** 读取文件原始内容（UTF-8 字符串） */
  fileReadRaw: (filePath) =>
    ipcRenderer.invoke('file:readRaw', filePath),

  // ── settings: 组 ────────────────────────────────────────────────────────────

  /** 读取用户设置 */
  settingsGet: (key) =>
    ipcRenderer.invoke('settings:get', key),

  /** 写入用户设置 */
  settingsSet: (key, value) =>
    ipcRenderer.invoke('settings:set', key, value),
});

/**
 * imageResolver.js
 * 图片路径解析服务
 * 将配置中的 pic 字段映射到可用的 sultan-asset:// 协议 URL
 * 实际的 4 步回退链逻辑在主进程 IPC handler 中实现
 */

import { useState, useEffect } from 'react';

/**
 * 解析图片路径，返回 sultan-asset:// URL 或 null
 * @param {string|null|undefined} pic - 配置中的 pic 字段值（如 "cards/yrl"）
 * @returns {Promise<string|null>} sultan-asset:// URL 或 null
 */
export async function resolveImage(pic) {
  // pic 为空时直接返回 null
  if (!pic) return null;

  try {
    return await window.electronAPI.assetResolveImage(pic);
  } catch {
    // IPC 调用失败时返回 null，不抛出错误
    return null;
  }
}

/**
 * React Hook：解析图片路径
 * @param {string|null|undefined} pic - 配置中的 pic 字段值
 * @returns {{ url: string|null, loading: boolean }}
 */
export function useResolvedImage(pic) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // pic 为空时重置状态
    if (!pic) {
      setUrl(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    resolveImage(pic).then((resolved) => {
      if (!cancelled) {
        setUrl(resolved);
        setLoading(false);
      }
    });

    // 清理函数：组件卸载或 pic 变化时取消更新
    return () => {
      cancelled = true;
    };
  }, [pic]);

  return { url, loading };
}

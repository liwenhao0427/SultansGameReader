import { useState, useEffect } from 'react'

/**
 * 设置页组件
 * 负责：游戏目录、AssetStudio CLI 路径、资源目录、缓存目录的配置
 * 以及缓存管理（重建/清除）和资源提取操作
 */
export default function SettingsPage({ onNavigate }) {
  // ── 路径状态 ──────────────────────────────────────────────────────────────
  const [gamePath, setGamePath] = useState('')
  const [cliPath, setCliPath] = useState('')
  const [resourceDir, setResourceDir] = useState('')
  const [cacheDir, setCacheDir] = useState('')

  // ── 验证与状态 ────────────────────────────────────────────────────────────
  const [gamePathValid, setGamePathValid] = useState(null) // null | true | false
  const [dotnetStatus, setDotnetStatus] = useState(null)  // null | { available, version }

  // ── 缓存重建进度 ──────────────────────────────────────────────────────────
  const [rebuildProgress, setRebuildProgress] = useState(null) // null | { current, total }
  const [rebuildResult, setRebuildResult] = useState(null)     // null | { success, counts }
  const [rebuilding, setRebuilding] = useState(false)

  // ── 资源提取状态 ──────────────────────────────────────────────────────────
  const [extracting, setExtracting] = useState(false)
  const [extractLog, setExtractLog] = useState([])

  // ── 组件挂载：读取已保存设置，检测 .NET ──────────────────────────────────
  useEffect(() => {
    async function loadSettings() {
      const api = window.electronAPI
      if (!api) return

      const [gp, cp, rd, cd] = await Promise.all([
        api.settingsGet('gamePath'),
        api.settingsGet('cliPath'),
        api.settingsGet('resourceDir'),
        api.settingsGet('cacheDir'),
      ])
      if (gp) setGamePath(gp)
      if (cp) setCliPath(cp)
      if (rd) setResourceDir(rd)
      if (cd) setCacheDir(cd)

      // 检测 .NET 运行时
      try {
        const result = await api.assetCheckDotnet()
        setDotnetStatus(result)
      } catch {
        setDotnetStatus({ available: false })
      }
    }
    loadSettings()
  }, [])

  // ── 游戏目录：失焦时验证并保存 ───────────────────────────────────────────
  async function handleGamePathBlur() {
    if (!gamePath.trim()) return
    await window.electronAPI.settingsSet('gamePath', gamePath.trim())
    try {
      const result = await window.electronAPI.configSetGameDir(gamePath.trim())
      setGamePathValid(result.success)
    } catch {
      setGamePathValid(false)
    }
  }

  // ── AssetStudio CLI 路径：通过 file input 选择 .exe ───────────────────────
  function handleCliFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    // Electron 中 file.path 包含完整本地路径
    const path = file.path || file.name
    setCliPath(path)
    window.electronAPI.settingsSet('cliPath', path)
    window.electronAPI.assetSetCliPath(path)
  }

  // ── 资源目录：失焦时保存 ──────────────────────────────────────────────────
  async function handleResourceDirBlur() {
    await window.electronAPI.settingsSet('resourceDir', resourceDir)
  }

  // ── 缓存目录：失焦时保存 ──────────────────────────────────────────────────
  async function handleCacheDirBlur() {
    await window.electronAPI.settingsSet('cacheDir', cacheDir)
  }

  // ── 更新配置缓存 ──────────────────────────────────────────────────────────
  async function handleRebuildCache() {
    setRebuilding(true)
    setRebuildProgress({ current: 0, total: 0 })
    setRebuildResult(null)
    try {
      const result = await window.electronAPI.configRebuildCache((current, total) => {
        setRebuildProgress({ current, total })
      })
      // 兼容：result 可能没有 success 字段，有 total 就算成功
      setRebuildResult({ success: result.success !== false, total: result.total, errors: result.errors })
    } catch (err) {
      setRebuildResult({ success: false, error: err.message })
    } finally {
      setRebuilding(false)
    }
  }

  // ── 提取游戏资源 ──────────────────────────────────────────────────────────
  async function handleExtract() {
    setExtracting(true)
    setExtractLog([])
    try {
      await window.electronAPI.assetExtract(
        { gamePath, outputDir: resourceDir },
        (data) => setExtractLog(prev => [...prev.slice(-99), data.line || JSON.stringify(data)])
      )
    } catch (err) {
      setExtractLog(prev => [...prev, `错误: ${err.message}`])
    } finally {
      setExtracting(false)
    }
  }

  // ── 清除缓存 ──────────────────────────────────────────────────────────────
  async function handleClearCache() {
    if (!window.confirm('确认清除所有缓存文件？此操作不可撤销。')) return
    try {
      await window.electronAPI.configClearCache()
      setRebuildResult(null)
      setRebuildProgress(null)
      alert('缓存已清除')
    } catch (err) {
      alert(`清除失败: ${err.message}`)
    }
  }

  // ── 样式常量 ──────────────────────────────────────────────────────────────
  const sectionStyle = {
    marginBottom: 24,
    padding: '16px 20px',
    background: '#1e1e2e',
    borderRadius: 8,
    border: '1px solid #313244',
  }
  const labelStyle = { display: 'block', marginBottom: 6, color: '#cdd6f4', fontSize: 13 }
  const inputStyle = {
    width: '100%', padding: '7px 10px', background: '#181825',
    border: '1px solid #45475a', borderRadius: 4, color: '#cdd6f4',
    fontSize: 13, boxSizing: 'border-box',
  }
  const btnStyle = {
    padding: '7px 16px', borderRadius: 4, border: 'none',
    cursor: 'pointer', fontSize: 13, fontWeight: 500,
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflowY: 'auto', background: '#11111b', color: '#cdd6f4' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>

        {/* 标题 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#cba6f7' }}>⚙ 设置</h2>
          <button
            style={{ ...btnStyle, background: '#89b4fa', color: '#1e1e2e' }}
            onClick={() => onNavigate('main')}
          >
            进入主界面 →
          </button>
        </div>

        {/* 游戏目录 */}
        <div style={sectionStyle}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#89b4fa' }}>游戏目录</h3>
          <label style={labelStyle}>游戏安装路径（包含 Sultan's Game_Data 的目录）</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={gamePath}
              onChange={e => setGamePath(e.target.value)}
              onBlur={handleGamePathBlur}
              placeholder="例：C:\Games\Sultan's Game"
            />
          </div>
          {/* 验证结果 */}
          {gamePathValid === true && (
            <div style={{ marginTop: 6, color: '#a6e3a1', fontSize: 12 }}>✓ 路径有效，已找到配置目录</div>
          )}
          {gamePathValid === false && (
            <div style={{ marginTop: 6, color: '#f38ba8', fontSize: 12 }}>✗ 路径无效，未找到 Sultan's Game_Data/StreamingAssets/config</div>
          )}
        </div>

        {/* AssetStudio CLI 路径 */}
        <div style={sectionStyle}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#89b4fa' }}>AssetStudio CLI</h3>
          <label style={labelStyle}>AssetStudio.CLI.exe 路径</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={cliPath}
              onChange={e => setCliPath(e.target.value)}
              onBlur={() => {
                window.electronAPI.settingsSet('cliPath', cliPath)
                window.electronAPI.assetSetCliPath(cliPath)
              }}
              placeholder="例：C:\Tools\AssetStudio.CLI.exe"
            />
            <label style={{ ...btnStyle, background: '#45475a', color: '#cdd6f4', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              浏览
              <input
                type="file"
                accept=".exe"
                style={{ display: 'none' }}
                onChange={handleCliFileChange}
              />
            </label>
          </div>

          {/* .NET 状态指示 */}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#a6adc8' }}>.NET 8.0 运行时：</span>
            {dotnetStatus === null && <span style={{ fontSize: 12, color: '#a6adc8' }}>检测中…</span>}
            {dotnetStatus?.available === true && (
              <span style={{ fontSize: 12, color: '#a6e3a1' }}>✓ 已安装 {dotnetStatus.version || ''}</span>
            )}
            {dotnetStatus?.available === false && (
              <span style={{ fontSize: 12, color: '#f38ba8' }}>✗ 未检测到</span>
            )}
          </div>

          {/* .NET 说明文字 */}
          <div style={{ marginTop: 10, padding: '10px 12px', background: '#181825', borderRadius: 4, fontSize: 12, color: '#a6adc8', lineHeight: 1.6 }}>
            AssetStudio CLI 需要 .NET 8.0 运行时，请从{' '}
            <a href="https://dotnet.microsoft.com/download" target="_blank" rel="noreferrer" style={{ color: '#89b4fa' }}>
              https://dotnet.microsoft.com/download
            </a>{' '}
            下载安装。
          </div>
        </div>

        {/* 资源目录 & 缓存目录 */}
        <div style={sectionStyle}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#89b4fa' }}>目录配置</h3>
          <label style={labelStyle}>资源目录（AssetStudio 提取输出目录）</label>
          <input
            style={{ ...inputStyle, marginBottom: 12 }}
            value={resourceDir}
            onChange={e => setResourceDir(e.target.value)}
            onBlur={handleResourceDirBlur}
            placeholder="默认：<appData>/resource/"
          />
          <label style={labelStyle}>缓存目录（解析结果存储目录）</label>
          <input
            style={inputStyle}
            value={cacheDir}
            onChange={e => setCacheDir(e.target.value)}
            onBlur={handleCacheDirBlur}
            placeholder="默认：<appData>/cache/"
          />
        </div>

        {/* 缓存与资源管理 */}
        <div style={sectionStyle}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#89b4fa' }}>缓存与资源管理</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              style={{ ...btnStyle, background: rebuilding ? '#45475a' : '#a6e3a1', color: '#1e1e2e' }}
              onClick={handleRebuildCache}
              disabled={rebuilding}
            >
              {rebuilding ? '更新中…' : '更新配置缓存'}
            </button>
            <button
              style={{ ...btnStyle, background: extracting ? '#45475a' : '#fab387', color: '#1e1e2e' }}
              onClick={handleExtract}
              disabled={extracting}
            >
              {extracting ? '提取中…' : '提取游戏资源'}
            </button>
            <button
              style={{ ...btnStyle, background: '#f38ba8', color: '#1e1e2e' }}
              onClick={handleClearCache}
            >
              清除缓存
            </button>
          </div>

          {/* 缓存重建进度条 */}
          {rebuildProgress && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: '#a6adc8', marginBottom: 4 }}>
                {rebuildProgress.total > 0
                  ? `${rebuildProgress.current} / ${rebuildProgress.total} 文件`
                  : '准备中…'}
              </div>
              {rebuildProgress.total > 0 && (
                <div style={{ height: 6, background: '#313244', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.round((rebuildProgress.current / rebuildProgress.total) * 100)}%`,
                    background: '#a6e3a1',
                    transition: 'width 0.2s',
                  }} />
                </div>
              )}
            </div>
          )}

          {/* 缓存重建结果摘要 */}
          {rebuildResult && (
            <div style={{
              marginTop: 10, padding: '8px 12px', borderRadius: 4, fontSize: 12,
              background: rebuildResult.success ? '#1e3a2f' : '#3a1e1e',
              color: rebuildResult.success ? '#a6e3a1' : '#f38ba8',
            }}>
              {rebuildResult.success
                ? `✓ 缓存更新完成${rebuildResult.counts ? `，共处理 ${Object.values(rebuildResult.counts).reduce((a, b) => a + b, 0)} 个文件` : ''}`
                : `✗ 更新失败：${rebuildResult.error || '未知错误'}`}
            </div>
          )}

          {/* 资源提取日志 */}
          {extractLog.length > 0 && (
            <div style={{
              marginTop: 10, padding: '8px 10px', background: '#181825',
              borderRadius: 4, maxHeight: 120, overflowY: 'auto',
              fontSize: 11, color: '#a6adc8', fontFamily: 'monospace',
            }}>
              {extractLog.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

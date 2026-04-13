import { useEffect, useMemo, useState } from 'react'
import Pagination from 'rc-pagination'
import 'rc-pagination/assets/index.css'
import useReadingStateStore from '../stores/useReadingStateStore'
import { APP_TITLE_WITH_VERSION } from '../appMeta'
import donateSupportImage from '../assets/donate-support.jpeg'

const GITHUB_REPOSITORY_URL = 'https://github.com/liwenhao0427/SultansGameReader'
const MOD_TAG_LABELS = {
  'Alternative Storyline': '剧情',
  'Numerical Tuning': '数值修改',
  'Balance': '难度调整',
  'Utilities': '便利功能',
  'Original Creation': '原创内容',
  'Appearance': '立绘修改',
  'Characters': '新增角色',
  'Equipment': '装备',
  'Romantic Content': '浪漫内容',
}
const MOD_PAGE_SIZE = 20

const MOD_TABLE_COLUMNS = {
  select: 56,
  preview: 132,
  name: 250,
  description: 360,
  tags: 280,
  version: 96,
  content: 132,
  detail: 92,
}

/**
 * 设置页组件
 * 负责：游戏目录、AssetStudio CLI 路径、资源目录、缓存目录的配置
 * 以及缓存管理（重建/清除）和资源提取操作
 */
export default function SettingsPage({ onNavigate }) {
  const resetReadingState = useReadingStateStore((state) => state.resetAll)

  // 路径状态
  const [gamePath, setGamePath] = useState('')
  const [cliPath, setCliPath] = useState('')
  const [resourceDir, setResourceDir] = useState('')
  const [cacheDir, setCacheDir] = useState('')
  const [modRootPath, setModRootPath] = useState('')

  // 验证与状态
  const [gamePathValid, setGamePathValid] = useState(null)
  const [dotnetStatus, setDotnetStatus] = useState(null)

  // 缓存重建进度
  const [rebuildProgress, setRebuildProgress] = useState(null)
  const [rebuildResult, setRebuildResult] = useState(null)
  const [rebuilding, setRebuilding] = useState(false)

  // 资源提取状态
  const [extracting, setExtracting] = useState(false)
  const [extractLog, setExtractLog] = useState([])
  const [importingMod, setImportingMod] = useState(false)
  const [loadingMods, setLoadingMods] = useState(false)
  const [modImportResult, setModImportResult] = useState(null)
  const [modList, setModList] = useState([])
  const [selectedModPaths, setSelectedModPaths] = useState([])
  const [modKeyword, setModKeyword] = useState('')
  const [modTagFilter, setModTagFilter] = useState('all')
  const [modContentFilter, setModContentFilter] = useState('all')
  const [modSort, setModSort] = useState('nameAsc')
  const [modPage, setModPage] = useState(1)
  const [modDetailState, setModDetailState] = useState({
    visible: false,
    loading: false,
    detail: null,
    error: '',
  })
  const [showDonateImage, setShowDonateImage] = useState(false)

  useEffect(() => {
    document.title = APP_TITLE_WITH_VERSION
  }, [])

  useEffect(() => {
    async function loadSettings() {
      const api = window.electronAPI
      if (!api) return

      let [gp, cp, rd, cd, mp, modRootPathManual] = await Promise.all([
        api.settingsGet('gamePath'),
        api.settingsGet('cliPath'),
        api.settingsGet('resourceDir'),
        api.settingsGet('cacheDir'),
        api.settingsGet('modRootPath'),
        api.settingsGet('modRootPathManual'),
      ])

      if (!gp) {
        try {
          const detected = await api.configDetectDefaultPaths?.()
          if (detected?.gamePath) {
            const result = await api.configSetGameDir(detected.gamePath)
            if (result?.success) {
              gp = detected.gamePath
              await api.settingsSet('gamePath', gp)
              if (!modRootPathManual && (result?.suggestedModRootPath || detected?.modRootPath)) {
                mp = result?.suggestedModRootPath || detected.modRootPath
                await api.settingsSet('modRootPath', mp)
                await api.settingsSet('modRootPathManual', false)
              }
            }
          }
          if (!mp && detected?.modRootPath) {
            mp = detected.modRootPath
            await api.settingsSet('modRootPath', mp)
            await api.settingsSet('modRootPathManual', false)
          }
        } catch {
          // 忽略自动探测失败，保留手动选择入口
        }
      }

      if (gp) setGamePath(gp)
      if (cp) setCliPath(cp)
      if (rd) setResourceDir(rd)
      if (cd) setCacheDir(cd)
      if (gp) {
        try {
          const result = await api.configSetGameDir(gp)
          setGamePathValid(Boolean(result?.success))
        } catch {
          setGamePathValid(false)
        }
      }
      if (mp) {
        setModRootPath(mp)
        try {
          const mods = await api.configListMods(mp)
          setModList(mods || [])
          setSelectedModPaths([])
        } catch {
          setModList([])
          setSelectedModPaths([])
        }
      }

      try {
        const result = await api.assetCheckDotnet()
        setDotnetStatus(result)
      } catch {
        setDotnetStatus({ available: false })
      }
    }

    loadSettings()
  }, [])

  async function handleGamePathBlur() {
    if (!gamePath.trim()) return

    await window.electronAPI.settingsSet('gamePath', gamePath.trim())

    try {
      const result = await window.electronAPI.configSetGameDir(gamePath.trim())
      setGamePathValid(result.success)
      if (result?.success) {
        const modRootPathManual = await window.electronAPI.settingsGet('modRootPathManual')
        const suggestedModRootPath = result?.suggestedModRootPath || ''
        if (!modRootPathManual && suggestedModRootPath) {
          setModRootPath(suggestedModRootPath)
          await window.electronAPI.settingsSet('modRootPath', suggestedModRootPath)
          await window.electronAPI.settingsSet('modRootPathManual', false)
          await loadModsFromRoot(suggestedModRootPath)
        }
      }
    } catch {
      setGamePathValid(false)
    }
  }

  async function handleResourceDirBlur() {
    await window.electronAPI.settingsSet('resourceDir', resourceDir)
  }

  async function handleCacheDirBlur() {
    await window.electronAPI.settingsSet('cacheDir', cacheDir)
  }

  async function handleBrowsePath(kind, currentValue, setter, options = {}) {
    const {
      settingKey,
      onPick,
      ...dialogOptions
    } = options

    const selectedPath = await window.electronAPI.filePickPath({
      kind,
      defaultPath: currentValue,
      ...dialogOptions,
    })
    if (!selectedPath) return
    setter(selectedPath)

    if (settingKey) {
      await window.electronAPI.settingsSet(settingKey, selectedPath)
    }
    if (onPick) {
      await onPick(selectedPath)
    }
  }

  async function handleOpenFolder(targetPath) {
    if (!targetPath) return
    await window.electronAPI.fileOpenFolder(targetPath)
  }

  function handleOpenGithub() {
    window.electronAPI?.appOpenExternal?.(GITHUB_REPOSITORY_URL)
  }

  async function handleRebuildCache() {
    setRebuilding(true)
    setRebuildProgress({ current: 0, total: 0 })
    setRebuildResult(null)

    try {
      const result = await window.electronAPI.configRebuildCache((current, total) => {
        setRebuildProgress({ current, total })
      })

      setRebuildResult({
        success: result.success !== false,
        total: result.total,
        errors: result.errors,
        counts: result.counts,
      })
    } catch (err) {
      setRebuildResult({ success: false, error: err.message })
    } finally {
      setRebuilding(false)
    }
  }

  async function handleExtract() {
    setExtracting(true)
    setExtractLog([])

    try {
      await window.electronAPI.assetExtract(
        { gamePath, outputDir: resourceDir },
        (data) => setExtractLog((prev) => [...prev.slice(-99), data.line || JSON.stringify(data)])
      )
    } catch (err) {
      setExtractLog((prev) => [...prev, `错误: ${err.message}`])
    } finally {
      setExtracting(false)
    }
  }

  async function loadModsFromRoot(rootPath) {
    const normalizedRootPath = rootPath.trim()
    if (!normalizedRootPath) {
      setModList([])
      setSelectedModPaths([])
      return
    }

    setLoadingMods(true)
    try {
      const mods = await window.electronAPI.configListMods(normalizedRootPath)
      setModList(mods || [])
      setSelectedModPaths([])
      setModPage(1)
    } catch (err) {
      setModList([])
      setSelectedModPaths([])
      alert(`读取 Mod 列表失败：${err.message}`)
    } finally {
      setLoadingMods(false)
    }
  }

  async function handleModRootPathBlur() {
    await window.electronAPI.settingsSet('modRootPath', modRootPath)
    await window.electronAPI.settingsSet('modRootPathManual', true)
    await loadModsFromRoot(modRootPath)
  }

  function toggleModSelection(modPath) {
    setSelectedModPaths((prev) => (
      prev.includes(modPath)
        ? prev.filter((item) => item !== modPath)
        : [...prev, modPath]
    ))
  }

  function handleToggleSelectAllMods() {
    const filteredPaths = filteredSortedMods.map((mod) => mod.path)

    setSelectedModPaths((prev) => {
      const prevSet = new Set(prev)
      const isAllFilteredSelected = filteredPaths.length > 0 && filteredPaths.every((modPath) => prevSet.has(modPath))

      if (isAllFilteredSelected) {
        return prev.filter((modPath) => !filteredPaths.includes(modPath))
      }

      for (const modPath of filteredPaths) {
        prevSet.add(modPath)
      }

      return [...prevSet]
    })
  }

  async function handleImportMod() {
    const normalizedRootPath = modRootPath.trim()
    if (!normalizedRootPath) {
      alert('请先选择 Mod 根目录')
      return
    }
    if (selectedModPaths.length === 0) {
      alert('请至少勾选一个 Mod')
      return
    }

    const shouldContinue = window.confirm(
      '读取 Mod 会直接按 key 覆盖或新增当前 cache 与 resource 内容，此操作不可逆。\n\n如果之后需要查看原版游戏资源，请先清除缓存，再重新读取游戏配置与提取游戏资源。\n\n确认继续吗？'
    )
    if (!shouldContinue) return

    setImportingMod(true)
    setModImportResult(null)

    try {
      await window.electronAPI.settingsSet('modRootPath', normalizedRootPath)
      const result = await window.electronAPI.configImportMods(selectedModPaths)
      setModImportResult(result)

      if (!result?.success) {
        alert(`Mod 导入失败：${result?.error || '未知错误'}`)
        return
      }

      const warningText = result.warnings?.length
        ? `\n\n警告：\n${result.warnings.slice(0, 5).join('\n')}`
        : ''
      alert(`Mod 导入完成：已导入 ${result.imported?.length || 0} 个 Mod${warningText}`)
    } catch (err) {
      const result = { success: false, error: err.message }
      setModImportResult(result)
      alert(`Mod 导入失败：${err.message}`)
    } finally {
      setImportingMod(false)
    }
  }

  async function handleOpenModDetail(modPath) {
    setModDetailState({
      visible: true,
      loading: true,
      detail: null,
      error: '',
    })

    try {
      const result = await window.electronAPI.configGetModDetail(modPath)
      if (!result?.success || !result?.detail) {
        throw new Error(result?.error || '读取 Mod 详情失败')
      }

      setModDetailState({
        visible: true,
        loading: false,
        detail: result.detail,
        error: '',
      })
    } catch (err) {
      setModDetailState({
        visible: true,
        loading: false,
        detail: null,
        error: err.message,
      })
    }
  }

  function handleCloseModDetail() {
    setModDetailState({
      visible: false,
      loading: false,
      detail: null,
      error: '',
    })
  }

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

  async function handleClearReadingState() {
    if (!window.confirm('确认清空全部已读、未读与收藏状态吗？此操作不会清除缓存。')) return

    resetReadingState()
    await window.electronAPI.storageRemoveJson?.('readingState')
    await useReadingStateStore.persist?.rehydrate?.()
    alert('阅读状态已清空')
  }

  const sectionStyle = {
    marginBottom: 24,
    padding: '16px 20px',
    background: '#1e1e2e',
    borderRadius: 8,
    border: '1px solid #313244',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: 6,
    color: '#cdd6f4',
    fontSize: 13,
  }

  const inputStyle = {
    width: '100%',
    padding: '7px 10px',
    background: '#181825',
    border: '1px solid #45475a',
    borderRadius: 4,
    color: '#cdd6f4',
    fontSize: 13,
    boxSizing: 'border-box',
  }

  const btnStyle = {
    padding: '7px 16px',
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  }

  const availableTags = useMemo(() => {
    const tags = new Set()
    for (const mod of modList) {
      for (const tag of (mod.tags || [])) {
        if (tag) tags.add(tag)
      }
    }
    return [...tags].sort((a, b) => a.localeCompare(b, 'en'))
  }, [modList])

  const filteredSortedMods = useMemo(() => {
    const keyword = modKeyword.trim().toLowerCase()
    const list = modList.filter((mod) => {
      const matchesKeyword = !keyword || [
        mod.name,
        mod.dirName,
        mod.description,
        ...(mod.tags || []),
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(keyword))

      const matchesTag = modTagFilter === 'all' || (mod.tags || []).includes(modTagFilter)

      const matchesContent = modContentFilter === 'all'
        || (modContentFilter === 'config' && mod.hasConfig)
        || (modContentFilter === 'image' && mod.hasImage)
        || (modContentFilter === 'bgm' && mod.hasBgm)
        || (modContentFilter === 'preview' && mod.previewUrl)

      return matchesKeyword && matchesTag && matchesContent
    })

    const getContentScore = (mod) => (
      (mod.hasConfig ? 4 : 0)
      + (mod.hasImage ? 2 : 0)
      + (mod.hasBgm ? 1 : 0)
      + (mod.previewUrl ? 1 : 0)
    )

    list.sort((left, right) => {
      switch (modSort) {
        case 'nameDesc':
          return String(right.name || right.dirName).localeCompare(String(left.name || left.dirName), 'zh-CN')
        case 'dirAsc':
          return String(left.dirName).localeCompare(String(right.dirName), 'en')
        case 'dirDesc':
          return String(right.dirName).localeCompare(String(left.dirName), 'en')
        case 'versionDesc':
          return String(right.version || '').localeCompare(String(left.version || ''), 'en')
        case 'contentDesc':
          return getContentScore(right) - getContentScore(left)
        case 'nameAsc':
        default:
          return String(left.name || left.dirName).localeCompare(String(right.name || right.dirName), 'zh-CN')
      }
    })

    return list
  }, [modContentFilter, modKeyword, modList, modSort, modTagFilter])

  const totalModPages = Math.max(1, Math.ceil(filteredSortedMods.length / MOD_PAGE_SIZE))
  const selectedModPathSet = useMemo(() => new Set(selectedModPaths), [selectedModPaths])
  const pagedMods = useMemo(() => {
    const safePage = Math.min(modPage, totalModPages)
    const start = (safePage - 1) * MOD_PAGE_SIZE
    return filteredSortedMods.slice(start, start + MOD_PAGE_SIZE)
  }, [filteredSortedMods, modPage, totalModPages])

  useEffect(() => {
    if (modPage > totalModPages) {
      setModPage(totalModPages)
    }
  }, [modPage, totalModPages])

  useEffect(() => {
    setModPage(1)
  }, [modKeyword, modTagFilter, modContentFilter, modSort])

  const allModsSelected = filteredSortedMods.length > 0
    && filteredSortedMods.every((mod) => selectedModPathSet.has(mod.path))

  return (
    <div style={{ width: '100vw', height: '100vh', overflowY: 'auto', background: '#11111b', color: '#cdd6f4' }}>
      <div style={{ width: 'min(96vw, 1520px)', margin: '0 auto', padding: '32px 24px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#cba6f7', flex: '1 1 240px' }}>{APP_TITLE_WITH_VERSION}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              style={{ ...btnStyle, background: '#45475a', color: '#cdd6f4' }}
              onClick={handleOpenGithub}
            >
              GitHub 页面
            </button>
            <button
              type="button"
              style={{ ...btnStyle, background: '#f9e2af', color: '#1e1e2e' }}
              onClick={() => setShowDonateImage(true)}
            >
              支持作者
            </button>
            <button
              style={{ ...btnStyle, background: '#89b4fa', color: '#1e1e2e' }}
              onClick={() => onNavigate('main')}
            >
              进入主界面 →
            </button>
          </div>
        </div>

        <div style={sectionStyle}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#89b4fa' }}>游戏目录</h3>
          <label style={labelStyle}>游戏安装路径（包含 Sultan&apos;s Game_Data 的目录）</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={gamePath}
              onChange={(event) => setGamePath(event.target.value)}
              onBlur={handleGamePathBlur}
              placeholder={`例：C:\\Games\\Sultan's Game`}
            />
            <button
              type="button"
              style={{ ...btnStyle, background: '#45475a', color: '#cdd6f4', whiteSpace: 'nowrap' }}
              onClick={() => handleBrowsePath('directory', gamePath, setGamePath, {
                title: '选择游戏安装目录',
                settingKey: 'gamePath',
                onPick: async (selectedPath) => {
                  const result = await window.electronAPI.configSetGameDir(selectedPath)
                  setGamePathValid(Boolean(result?.success))
                },
              })}
            >
              浏览
            </button>
            <button
              type="button"
              style={{ ...btnStyle, background: '#313244', color: '#cdd6f4', whiteSpace: 'nowrap' }}
              onClick={() => handleOpenFolder(gamePath)}
            >
              打开文件夹
            </button>
          </div>
          {gamePathValid === true && (
            <div style={{ marginTop: 6, color: '#a6e3a1', fontSize: 12 }}>✓ 路径有效，已找到配置目录</div>
          )}
          {gamePathValid === false && (
            <div style={{ marginTop: 6, color: '#f38ba8', fontSize: 12 }}>✗ 路径无效，未找到 Sultan&apos;s Game_Data/StreamingAssets/config</div>
          )}
        </div>

        <div style={sectionStyle}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#89b4fa' }}>AssetStudio CLI</h3>
          <label style={labelStyle}>AssetStudio.CLI.exe 路径</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={cliPath}
              onChange={(event) => setCliPath(event.target.value)}
              onBlur={() => {
                window.electronAPI.settingsSet('cliPath', cliPath)
                window.electronAPI.assetSetCliPath(cliPath)
              }}
              placeholder="例：C:\Tools\AssetStudio.CLI.exe"
            />
            <button
              type="button"
              style={{ ...btnStyle, background: '#45475a', color: '#cdd6f4', whiteSpace: 'nowrap' }}
              onClick={() => handleBrowsePath('file', cliPath, setCliPath, {
                title: '选择 AssetStudio CLI',
                settingKey: 'cliPath',
                filters: [{ name: '可执行文件', extensions: ['exe'] }],
                onPick: async (selectedPath) => {
                  await window.electronAPI.assetSetCliPath(selectedPath)
                },
              })}
            >
              浏览
            </button>
            <button
              type="button"
              style={{ ...btnStyle, background: '#313244', color: '#cdd6f4', whiteSpace: 'nowrap' }}
              onClick={() => handleOpenFolder(cliPath)}
            >
              打开文件夹
            </button>
          </div>

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

          <div style={{ marginTop: 10, padding: '10px 12px', background: '#181825', borderRadius: 4, fontSize: 12, color: '#a6adc8', lineHeight: 1.6 }}>
            AssetStudio CLI 需要 .NET 8.0 运行时，请从{' '}
            <a href="https://dotnet.microsoft.com/download" target="_blank" rel="noreferrer" style={{ color: '#89b4fa' }}>
              https://dotnet.microsoft.com/download
            </a>{' '}
            下载安装。
          </div>
        </div>

        <div style={sectionStyle}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#89b4fa' }}>目录配置</h3>
          <label style={labelStyle}>资源目录（AssetStudio 提取输出目录）</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={resourceDir}
              onChange={(event) => setResourceDir(event.target.value)}
              onBlur={handleResourceDirBlur}
              placeholder="默认：<appData>/resource/"
            />
            <button
              type="button"
              style={{ ...btnStyle, background: '#45475a', color: '#cdd6f4', whiteSpace: 'nowrap' }}
              onClick={() => handleBrowsePath('directory', resourceDir, setResourceDir, {
                title: '选择资源目录',
                settingKey: 'resourceDir',
              })}
            >
              浏览
            </button>
            <button
              type="button"
              style={{ ...btnStyle, background: '#313244', color: '#cdd6f4', whiteSpace: 'nowrap' }}
              onClick={() => handleOpenFolder(resourceDir)}
            >
              打开文件夹
            </button>
          </div>
          <label style={labelStyle}>缓存目录（解析结果存储目录）</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={cacheDir}
              onChange={(event) => setCacheDir(event.target.value)}
              onBlur={handleCacheDirBlur}
              placeholder="默认：<appData>/cache/"
            />
            <button
              type="button"
              style={{ ...btnStyle, background: '#45475a', color: '#cdd6f4', whiteSpace: 'nowrap' }}
              onClick={() => handleBrowsePath('directory', cacheDir, setCacheDir, {
                title: '选择缓存目录',
                settingKey: 'cacheDir',
              })}
            >
              浏览
            </button>
            <button
              type="button"
              style={{ ...btnStyle, background: '#313244', color: '#cdd6f4', whiteSpace: 'nowrap' }}
              onClick={() => handleOpenFolder(cacheDir)}
            >
              打开文件夹
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#6c7086' }}>
            提示：如果搜索无结果，请确认缓存目录路径正确，或点击“更新配置缓存”重新生成。
          </div>
        </div>

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
            <button
              style={{ ...btnStyle, background: '#f9e2af', color: '#1e1e2e' }}
              onClick={handleClearReadingState}
            >
              清空阅读状态
            </button>
          </div>

          {rebuildProgress && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: '#a6adc8', marginBottom: 4 }}>
                {rebuildProgress.total > 0
                  ? `${rebuildProgress.current} / ${rebuildProgress.total} 文件`
                  : '准备中…'}
              </div>
              {rebuildProgress.total > 0 && (
                <div style={{ height: 6, background: '#313244', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.round((rebuildProgress.current / rebuildProgress.total) * 100)}%`,
                      background: '#a6e3a1',
                      transition: 'width 0.2s',
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {rebuildResult && (
            <div
              style={{
                marginTop: 10,
                padding: '8px 12px',
                borderRadius: 4,
                fontSize: 12,
                background: rebuildResult.success ? '#1e3a2f' : '#3a1e1e',
                color: rebuildResult.success ? '#a6e3a1' : '#f38ba8',
              }}
            >
              {rebuildResult.success
                ? `✓ 缓存更新完成${rebuildResult.counts ? `，共处理 ${Object.values(rebuildResult.counts).reduce((sum, count) => sum + count, 0)} 个文件` : ''}`
                : `✗ 更新失败：${rebuildResult.error || '未知错误'}`}
            </div>
          )}

          {extractLog.length > 0 && (
            <div
              style={{
                marginTop: 10,
                padding: '8px 10px',
                background: '#181825',
                borderRadius: 4,
                maxHeight: 120,
                overflowY: 'auto',
                fontSize: 11,
                color: '#a6adc8',
                fontFamily: 'monospace',
              }}
            >
              {extractLog.map((line, index) => <div key={index}>{line}</div>)}
            </div>
          )}
        </div>

        <div style={sectionStyle}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#89b4fa' }}>Mod 导入</h3>
          <label style={labelStyle}>Mod 根目录（可自定义，目录下可包含多个 Mod 文件夹）</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={modRootPath}
              onChange={(event) => setModRootPath(event.target.value)}
              onBlur={handleModRootPathBlur}
              placeholder="例：C:\\Users\\你的名字\\Documents\\DoubleCross\\SultansGame\\Mod"
            />
            <button
              type="button"
              style={{ ...btnStyle, background: '#45475a', color: '#cdd6f4', whiteSpace: 'nowrap' }}
              onClick={() => handleBrowsePath('directory', modRootPath, setModRootPath, {
                title: '选择 Mod 根目录',
                settingKey: 'modRootPath',
                onPick: async (selectedPath) => {
                  await window.electronAPI.settingsSet('modRootPathManual', true)
                  await loadModsFromRoot(selectedPath)
                },
              })}
            >
              浏览
            </button>
            <button
              type="button"
              style={{ ...btnStyle, background: '#313244', color: '#cdd6f4', whiteSpace: 'nowrap' }}
              onClick={() => handleOpenFolder(modRootPath)}
            >
              打开文件夹
            </button>
            <button
              type="button"
              style={{ ...btnStyle, background: '#585b70', color: '#cdd6f4', whiteSpace: 'nowrap' }}
              onClick={() => loadModsFromRoot(modRootPath)}
              disabled={loadingMods}
            >
              {loadingMods ? '扫描中…' : '扫描 Mod'}
            </button>
          </div>

          <div style={{ marginBottom: 12, padding: '12px 14px', background: '#181825', borderRadius: 6, border: '1px solid #313244', fontSize: 12, color: '#f9e2af', lineHeight: 1.7 }}>
            读取 Mod 会直接按 key 覆盖或新增当前 `cache` 与 `resource` 内容，此操作不可逆。
            如果你之后想恢复查看原版游戏资源，需要先清除缓存，再重新读取游戏配置，并重新提取游戏资源。
          </div>

          <div style={{ marginBottom: 12, fontSize: 12, color: '#a6adc8', lineHeight: 1.7 }}>
            会读取每个 Mod 的 `info.json` / `Info.json`，展示名称、描述、标签和版本。勾选后才会导入。
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 2fr) minmax(180px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr)', gap: 10, marginBottom: 12 }}>
            <input
              style={inputStyle}
              value={modKeyword}
              onChange={(event) => setModKeyword(event.target.value)}
              placeholder="筛选名称、目录名、说明或标签"
            />
            <select
              style={inputStyle}
              value={modTagFilter}
              onChange={(event) => setModTagFilter(event.target.value)}
            >
              <option value="all">全部标签</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {MOD_TAG_LABELS[tag] ? `${tag}（${MOD_TAG_LABELS[tag]}）` : tag}
                </option>
              ))}
            </select>
            <select
              style={inputStyle}
              value={modContentFilter}
              onChange={(event) => setModContentFilter(event.target.value)}
            >
              <option value="all">全部内容</option>
              <option value="config">仅看含 config</option>
              <option value="image">仅看含 image</option>
              <option value="bgm">仅看含 bgm</option>
              <option value="preview">仅看有预览图</option>
            </select>
            <select
              style={inputStyle}
              value={modSort}
              onChange={(event) => setModSort(event.target.value)}
            >
              <option value="nameAsc">按名称升序</option>
              <option value="nameDesc">按名称降序</option>
              <option value="dirAsc">按目录升序</option>
              <option value="dirDesc">按目录降序</option>
              <option value="versionDesc">按版本降序</option>
              <option value="contentDesc">按内容丰富度</option>
            </select>
          </div>

          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: '#a6adc8' }}>
              {loadingMods
                ? '正在扫描 Mod 列表…'
                : filteredSortedMods.length > 0
                  ? `筛选后共 ${filteredSortedMods.length} 个 Mod，当前第 ${Math.min(modPage, totalModPages)} / ${totalModPages} 页，已勾选 ${selectedModPaths.length} 个`
                  : '当前未扫描到可导入的 Mod'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {filteredSortedMods.length > 0 && (
                <button
                  type="button"
                  style={{ ...btnStyle, background: '#585b70', color: '#cdd6f4', padding: '6px 12px' }}
                  onClick={handleToggleSelectAllMods}
                >
                  {allModsSelected ? '取消全选' : '全选当前筛选结果'}
                </button>
              )}
            </div>
          </div>

          {filteredSortedMods.length > 0 && (
            <div style={{ marginBottom: 12, border: '1px solid #45475a', borderRadius: 8, overflow: 'hidden', background: '#0f1020' }}>
              <div style={{ maxHeight: 520, overflow: 'auto', background: '#11111b' }}>
                <table style={{ width: '100%', minWidth: 1400, borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ background: '#181825', color: '#89b4fa' }}>
                      <th style={{ padding: '10px 8px', borderBottom: '1px solid #313244', width: MOD_TABLE_COLUMNS.select }}>导入</th>
                      <th style={{ padding: '10px 8px', borderBottom: '1px solid #313244', textAlign: 'left', width: MOD_TABLE_COLUMNS.preview }}>预览</th>
                      <th style={{ padding: '10px 8px', borderBottom: '1px solid #313244', textAlign: 'left', width: MOD_TABLE_COLUMNS.name }}>名称</th>
                      <th style={{ padding: '10px 8px', borderBottom: '1px solid #313244', textAlign: 'left', width: MOD_TABLE_COLUMNS.description }}>说明</th>
                      <th style={{ padding: '10px 8px', borderBottom: '1px solid #313244', textAlign: 'left', width: MOD_TABLE_COLUMNS.tags }}>标签</th>
                      <th style={{ padding: '10px 8px', borderBottom: '1px solid #313244', textAlign: 'left', width: MOD_TABLE_COLUMNS.version }}>版本</th>
                      <th style={{ padding: '10px 8px', borderBottom: '1px solid #313244', textAlign: 'left', width: MOD_TABLE_COLUMNS.content }}>内容</th>
                      <th style={{ padding: '10px 8px', borderBottom: '1px solid #313244', textAlign: 'left', width: MOD_TABLE_COLUMNS.detail }}>详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedMods.map((mod) => {
                      const checked = selectedModPathSet.has(mod.path)
                      const contentFlags = [
                        mod.hasConfig ? 'config' : null,
                        mod.hasImage ? 'image' : null,
                        mod.hasBgm ? 'bgm' : null,
                      ].filter(Boolean)

                      return (
                        <tr key={mod.path} style={{ borderBottom: '1px solid #1e1e2e' }}>
                          <td style={{ padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleModSelection(mod.path)}
                            />
                          </td>
                          <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                            {mod.previewUrl ? (
                              <img
                                src={mod.previewUrl}
                                alt={`${mod.name || mod.dirName} 预览图`}
                                style={{
                                  display: 'block',
                                  width: 104,
                                  height: 104,
                                  objectFit: 'cover',
                                  borderRadius: 6,
                                  border: '1px solid #313244',
                                  background: '#181825',
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 104,
                                  height: 104,
                                  borderRadius: 6,
                                  border: '1px solid #313244',
                                  background: '#181825',
                                  color: '#6c7086',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 11,
                                }}
                              >
                                无图
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 10px', verticalAlign: 'top', color: '#cdd6f4' }}>
                            <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.5 }}>{mod.name || mod.dirName}</div>
                            <div style={{ marginTop: 4, fontSize: 11, color: '#6c7086', wordBreak: 'break-all', lineHeight: 1.5 }}>{mod.dirName}</div>
                          </td>
                          <td style={{ padding: '10px 10px', verticalAlign: 'top', color: '#bac2de', wordBreak: 'break-word' }}>
                            <div
                              title={mod.description || '无描述'}
                              style={{
                                lineHeight: 1.7,
                                minHeight: 84,
                                maxHeight: 118,
                                overflow: 'hidden',
                                display: '-webkit-box',
                                WebkitBoxOrient: 'vertical',
                                WebkitLineClamp: 4,
                              }}
                            >
                              {mod.description || '无描述'}
                            </div>
                          </td>
                          <td style={{ padding: '10px 10px', verticalAlign: 'top', color: '#a6adc8', lineHeight: 1.7, wordBreak: 'break-word' }}>
                            {mod.tags?.length
                              ? mod.tags.map((tag) => (MOD_TAG_LABELS[tag] ? `${tag}（${MOD_TAG_LABELS[tag]}）` : tag)).join(' / ')
                              : '无'}
                          </td>
                          <td style={{ padding: '10px 10px', verticalAlign: 'top', color: '#a6adc8', lineHeight: 1.6 }}>
                            {mod.version || '未填写'}
                          </td>
                          <td style={{ padding: '10px 10px', verticalAlign: 'top', color: '#a6adc8', lineHeight: 1.7 }}>
                            {contentFlags.length ? contentFlags.join(' + ') : '无'}
                          </td>
                          <td style={{ padding: '10px 10px', verticalAlign: 'top' }}>
                            <button
                              type="button"
                              style={{ ...btnStyle, background: '#585b70', color: '#cdd6f4', padding: '6px 10px', width: '100%' }}
                              onClick={() => handleOpenModDetail(mod.path)}
                            >
                              详情
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              style={{ ...btnStyle, background: importingMod ? '#45475a' : '#94e2d5', color: '#1e1e2e' }}
              onClick={handleImportMod}
              disabled={importingMod || selectedModPaths.length === 0}
            >
              {importingMod ? '读取中…' : `读取勾选的 Mod 到缓存与资源${selectedModPaths.length > 0 ? `（${selectedModPaths.length}）` : ''}`}
            </button>

            {totalModPages > 1 && (
              <Pagination
                className="mod-pagination"
                current={Math.min(modPage, totalModPages)}
                total={filteredSortedMods.length}
                pageSize={MOD_PAGE_SIZE}
                showTitle={false}
                showLessItems
                onChange={(page) => setModPage(page)}
              />
            )}
          </div>

          {modImportResult && (
            <div
              style={{
                marginTop: 12,
                padding: '8px 12px',
                borderRadius: 4,
                fontSize: 12,
                background: modImportResult.success ? '#1e3a2f' : '#3a1e1e',
                color: modImportResult.success ? '#a6e3a1' : '#f38ba8',
                lineHeight: 1.7,
              }}
            >
              {modImportResult.success
                ? `✓ 已导入 ${modImportResult.imported?.length || 0} 个 Mod。缓存新增 ${modImportResult.counts?.cacheAdded || 0} 项，缓存替换 ${modImportResult.counts?.cacheReplaced || 0} 项，资源新增 ${modImportResult.counts?.resourceAdded || 0} 项，资源替换 ${modImportResult.counts?.resourceReplaced || 0} 项。${modImportResult.failed?.length ? ` 另有 ${modImportResult.failed.length} 个导入失败。` : ''}`
                : `✗ 导入失败：${modImportResult.error || '未知错误'}`}
              {modImportResult.success && modImportResult.warnings?.length > 0 && (
                <div style={{ marginTop: 6, color: '#f9e2af' }}>
                  {`警告：${modImportResult.warnings.slice(0, 5).join('；')}`}
                </div>
              )}
              {modImportResult.failed?.length > 0 && (
                <div style={{ marginTop: 6, color: '#f38ba8' }}>
                  {`失败：${modImportResult.failed.slice(0, 5).map((item) => `${item.modPath}（${item.error}）`).join('；')}`}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {modDetailState.visible && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={handleCloseModDetail}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(17, 17, 27, 0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(94vw, 1100px)',
              maxHeight: '88vh',
              overflow: 'auto',
              background: '#1e1e2e',
              border: '1px solid #45475a',
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#f9e2af' }}>
                  {modDetailState.detail?.name || 'Mod 详情'}
                </div>
                {modDetailState.detail?.dirName && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#9399b2', wordBreak: 'break-all' }}>
                    {modDetailState.detail.dirName}
                  </div>
                )}
              </div>
              <button
                type="button"
                style={{ ...btnStyle, background: '#45475a', color: '#cdd6f4', padding: '6px 12px' }}
                onClick={handleCloseModDetail}
              >
                关闭
              </button>
            </div>

            {modDetailState.loading && (
              <div style={{ padding: '18px 0', color: '#a6adc8', fontSize: 13 }}>正在读取 Mod 详情…</div>
            )}

            {!modDetailState.loading && modDetailState.error && (
              <div style={{ padding: '12px 14px', borderRadius: 8, background: '#3a1e1e', color: '#f38ba8', fontSize: 13 }}>
                {modDetailState.error}
              </div>
            )}

            {!modDetailState.loading && modDetailState.detail && (
              <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
                <div>
                  {modDetailState.detail.previewUrl ? (
                    <img
                      src={modDetailState.detail.previewUrl}
                      alt={`${modDetailState.detail.name || modDetailState.detail.dirName} 预览图`}
                      style={{
                        display: 'block',
                        width: '100%',
                        maxWidth: 280,
                        aspectRatio: '1 / 1',
                        objectFit: 'cover',
                        borderRadius: 10,
                        border: '1px solid #313244',
                        background: '#11111b',
                        marginBottom: 14,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        maxWidth: 280,
                        aspectRatio: '1 / 1',
                        borderRadius: 10,
                        border: '1px solid #313244',
                        background: '#11111b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#6c7086',
                        fontSize: 12,
                        marginBottom: 14,
                      }}
                    >
                      无预览图
                    </div>
                  )}

                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ padding: '10px 12px', borderRadius: 8, background: '#181825', border: '1px solid #313244', fontSize: 12, lineHeight: 1.7 }}>
                      <div style={{ color: '#89b4fa', marginBottom: 4 }}>版本</div>
                      <div style={{ color: '#cdd6f4' }}>{modDetailState.detail.version || '未填写'}</div>
                    </div>
                    <div style={{ padding: '10px 12px', borderRadius: 8, background: '#181825', border: '1px solid #313244', fontSize: 12, lineHeight: 1.7 }}>
                      <div style={{ color: '#89b4fa', marginBottom: 4 }}>内容</div>
                      <div style={{ color: '#cdd6f4' }}>
                        {[
                          modDetailState.detail.hasConfig ? 'config' : null,
                          modDetailState.detail.hasImage ? 'image' : null,
                          modDetailState.detail.hasBgm ? 'bgm' : null,
                        ].filter(Boolean).join(' + ') || '无'}
                      </div>
                    </div>
                    <button
                      type="button"
                      style={{ ...btnStyle, background: '#585b70', color: '#cdd6f4' }}
                      onClick={() => handleOpenFolder(modDetailState.detail.path)}
                    >
                      打开目录
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 14 }}>
                  <div style={{ padding: '12px 14px', borderRadius: 8, background: '#181825', border: '1px solid #313244' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#89b4fa', marginBottom: 8 }}>标签</div>
                    <div style={{ fontSize: 13, color: '#cdd6f4', lineHeight: 1.8, wordBreak: 'break-word' }}>
                      {modDetailState.detail.tags?.length
                        ? modDetailState.detail.tags.map((tag) => (MOD_TAG_LABELS[tag] ? `${tag}（${MOD_TAG_LABELS[tag]}）` : tag)).join(' / ')
                        : '无'}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 8, background: '#181825', border: '1px solid #313244' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#89b4fa', marginBottom: 8 }}>说明</div>
                    <div style={{ fontSize: 13, color: '#cdd6f4', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {modDetailState.detail.description || '无描述'}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 8, background: '#181825', border: '1px solid #313244' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#89b4fa', marginBottom: 8 }}>目录结构</div>
                    <pre
                      style={{
                        margin: 0,
                        maxHeight: 300,
                        overflow: 'auto',
                        padding: 12,
                        borderRadius: 8,
                        background: '#11111b',
                        border: '1px solid #313244',
                        color: '#bac2de',
                        fontSize: 12,
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {(modDetailState.detail.structureLines || []).join('\n') || '未读取到目录内容'}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showDonateImage && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowDonateImage(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(17, 17, 27, 0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(92vw, 560px)',
              background: '#1e1e2e',
              border: '1px solid #45475a',
              borderRadius: 12,
              padding: 18,
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#f9e2af' }}>支持作者开发</div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#a6adc8' }}>如果这个工具对你有帮助，欢迎请作者喝杯咖啡。</div>
              </div>
              <button
                type="button"
                style={{ ...btnStyle, background: '#45475a', color: '#cdd6f4', padding: '6px 12px' }}
                onClick={() => setShowDonateImage(false)}
              >
                关闭
              </button>
            </div>
            <img
              src={donateSupportImage}
              alt="支持作者开发"
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                borderRadius: 8,
                border: '1px solid #313244',
                background: '#11111b',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import SettingsPage from './components/SettingsPage'
import MainLayout from './components/MainLayout'
import { APP_TITLE_WITH_VERSION } from './appMeta'

/**
 * 应用根组件
 * 使用 useState 管理页面路由：'settings' | 'main'
 */
export default function App() {
  const [page, setPage] = useState('main')

  useEffect(() => {
    document.title = APP_TITLE_WITH_VERSION
  }, [])

  useEffect(() => {
    async function decideEntry() {
      try {
        let gamePath = await window.electronAPI.settingsGet('gamePath')
        if (!gamePath) {
          const detected = await window.electronAPI.configDetectDefaultPaths?.()
          if (detected?.gamePath) {
            const result = await window.electronAPI.configSetGameDir(detected.gamePath)
            if (result?.success) {
              gamePath = detected.gamePath
              await window.electronAPI.settingsSet('gamePath', detected.gamePath)
              if (result?.suggestedModRootPath || detected.modRootPath) {
                await window.electronAPI.settingsSet('modRootPath', result?.suggestedModRootPath || detected.modRootPath)
                await window.electronAPI.settingsSet('modRootPathManual', false)
              }
            }
          }
        }

        if (!gamePath) {
          setPage('settings')
        }
      } catch {
        setPage('settings')
      }
    }

    decideEntry()
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {page === 'settings'
        ? <SettingsPage onNavigate={setPage} />
        : <MainLayout onNavigate={setPage} />
      }
    </div>
  )
}

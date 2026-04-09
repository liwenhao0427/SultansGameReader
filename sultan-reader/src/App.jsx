import { useEffect, useState } from 'react'
import SettingsPage from './components/SettingsPage'
import MainLayout from './components/MainLayout'

/**
 * 应用根组件
 * 使用 useState 管理页面路由：'settings' | 'main'
 */
export default function App() {
  const [page, setPage] = useState('main')

  useEffect(() => {
    async function decideEntry() {
      try {
        const gamePath = await window.electronAPI.settingsGet('gamePath')
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

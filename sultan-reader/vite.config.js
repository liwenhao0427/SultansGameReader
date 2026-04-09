import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

// Vite 配置：集成 React 和 Electron 插件
export default defineConfig({
  base: './',
  plugins: [
    react(),
    electron([
      {
        // Electron 主进程入口
        entry: 'electron/main.js',
      },
    ]),
  ],
  build: {
    outDir: 'dist',
  },
})

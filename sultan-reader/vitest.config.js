import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vitest 配置：支持 node 环境（服务层）和 jsdom 环境（React 组件）
export default defineConfig({
  plugins: [react()],
  test: {
    // 默认 node 环境，组件测试文件通过 @vitest-environment 注释指定 jsdom
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}', 'electron/**/*.test.js'],
  },
});

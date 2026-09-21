/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { getBuildInfo } from './scripts/version.ts'

const build = getBuildInfo()

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD__: JSON.stringify(build),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
  },
})

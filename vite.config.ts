/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { getBuildInfo } from './scripts/version.ts'

const build = getBuildInfo()

export default defineConfig({
  base: '/capito/',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectManifest: {
        // Precache the app shell only; audio mp3's are handled by runtime caching
        globPatterns: ['**/*.{js,css,html,json,woff2}'],
      },
      manifest: {
        name: 'Capito',
        short_name: 'Capito',
        description: 'Leer Italiaans — persoonlijke woordenschattrainer',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        lang: 'nl',
        scope: '/capito/',
        start_url: '/capito/',
        icons: [],
      },
    }),
  ],
  define: {
    __BUILD__: JSON.stringify(build),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
  },
})

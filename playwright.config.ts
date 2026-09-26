import { defineConfig } from '@playwright/test'

// Smoke tests run against the production build (vite preview), like the installed PWA.
// Structure and conventions: e2e/README.md
// Own port and no server reuse, so a running `npm run preview` (4173) with an old build is never tested.
const PORT = 4175
const BASE_URL = `http://localhost:${PORT}/capito/`
const PREVIEW = `npx vite preview --port ${PORT} --strictPort`

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'nl-NL',
    timezoneId: 'Europe/Amsterdam',
    // The service worker would serve audio and app files from its cache, out of reach of
    // page routes; without it every run behaves the same locally and in CI
    serviceWorkers: 'block',
  },
  projects: [
    {
      // Mobile-first baseline from .claude/rules/ui.md: 360px wide, touch
      name: 'mobile-chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    // CI has just built the app in its own step
    command: process.env.CI ? PREVIEW : `npm run build && ${PREVIEW}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})

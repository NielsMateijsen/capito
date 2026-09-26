import { test as base, expect, type ConsoleMessage } from '@playwright/test'
import { App } from './app.ts'

/** Generated mp3's (npm run audio) are not in git, so CI never has them. Locally they are refused too. */
const AUDIO = /\/audio\/[^/]+\.mp3$/

/**
 * Console output that is expected and harmless. Add an entry only with a reason;
 * everything else fails the test.
 */
const ALLOWED_CONSOLE: { reason: string; matches: (msg: ConsoleMessage) => boolean }[] = [
  {
    reason: 'audio is refused (see AUDIO); the app falls back to speech synthesis',
    matches: msg => msg.text().startsWith('Failed to load resource') && AUDIO.test(msg.location().url),
  },
]

export const test = base.extend<{ app: App; consoleGuard: void }>({
  app: async ({ page }, use) => {
    await use(new App(page))
  },
  // Every test fails on uncaught errors and console errors, so a smoke test also catches crashes
  consoleGuard: [async ({ context, page }, use) => {
    await context.route(AUDIO, route => route.fulfill({ status: 404 }))
    const errors: string[] = []
    page.on('pageerror', err => errors.push(`pageerror: ${err.message}`))
    page.on('console', msg => {
      if (msg.type() !== 'error') return
      if (ALLOWED_CONSOLE.some(a => a.matches(msg))) return
      errors.push(`console.error: ${msg.text()} (${msg.location().url})`)
    })
    await use()
    expect(errors, 'errors in the browser console').toEqual([])
  }, { auto: true }],
})

export { expect }

import { test, expect } from '../support/fixtures.ts'
import { S } from '../support/app.ts'
import { runSession } from '../support/session-driver.ts'
import { readProgress } from '../support/storage.ts'

test.describe('lesson', () => {
  test('a new learner starts the first lesson with Verder and finishes it', async ({ app }) => {
    await app.goto()
    await app.startContinue()
    await expect(app.session()).toHaveAttribute('data-mode', 'lesson')
    await expect(app.session()).toHaveAttribute('data-phase', 'intro')

    const run = await runSession(app.page, { input: 'keyboard' })
    expect(run.intros).toBeGreaterThan(0)
    expect(run.answered).toBeGreaterThan(0)

    // Every answer is logged with its lesson, and the log survives a reload
    const progress = await readProgress(app.page)
    expect(progress?.reviewLog).toHaveLength(run.answered)
    expect(new Set(progress?.reviewLog.map(e => e.mode))).toEqual(new Set(['lesson']))
    expect(progress?.reviewLog.every(e => typeof e.lesson === 'string')).toBe(true)

    await app.finishSession()
    await app.reload()
    expect((await readProgress(app.page))?.reviewLog).toHaveLength(run.answered)
  })

  test('stopping halfway returns home and keeps what was done', async ({ app }) => {
    await app.goto()
    await app.startContinue()
    await expect(app.session()).toHaveAttribute('data-phase', 'intro')
    await app.button(S.INTRO_DONE).click()
    await expect(app.session()).toHaveAttribute('data-phase', 'question')

    await app.stopSession()
    expect((await readProgress(app.page))?.introduced).toHaveLength(1)
  })

  test('Verder on the end screen goes straight on along the path', async ({ app }) => {
    await app.goto()
    await app.startContinue()
    await runSession(app.page)

    await app.continueFromEndScreen()
    await expect(app.session()).toHaveAttribute('data-mode', 'lesson')
    const second = await runSession(app.page)
    expect(second.answered).toBeGreaterThan(0)
  })
})

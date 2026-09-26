import { test, expect } from '../support/fixtures.ts'
import { runSession } from '../support/session-driver.ts'
import { readProgress } from '../support/storage.ts'

test.describe('daily session', () => {
  test('a new learner starts with an introduction and finishes the session', async ({ app }) => {
    // Session length follows config/app.json (maxReviewsPerSession)
    test.slow()
    await app.goto()
    await app.startToday()
    await expect(app.session()).toHaveAttribute('data-phase', 'intro')

    const run = await runSession(app.page, { input: 'keyboard' })
    expect(run.intros).toBeGreaterThan(0)
    expect(run.answered).toBeGreaterThan(0)

    // Every answer is logged, and the log survives a reload
    const progress = await readProgress(app.page)
    expect(progress?.reviewLog).toHaveLength(run.answered)
    expect(new Set(progress?.reviewLog.map(e => e.mode))).toEqual(new Set(['daily']))

    await app.finishSession()
    await app.reload()
    expect((await readProgress(app.page))?.reviewLog).toHaveLength(run.answered)
  })
})

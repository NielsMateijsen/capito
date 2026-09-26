import { test, expect } from '../support/fixtures.ts'
import { S } from '../support/app.ts'
import { runSession } from '../support/session-driver.ts'
import { registeredExerciseTypes } from '../support/exercise-types.ts'
import { readProgress } from '../support/storage.ts'

// The test session (Settings → Testen) shows one card of every exercise type, so this
// covers every exercise screen. A new type is picked up automatically; it fails here when
// the content has no card of that type that can be built.
test.describe('exercise types (test session)', () => {
  for (const input of ['click', 'keyboard'] as const) {
    test(`every registered type is shown once and can be answered (${input})`, async ({ app }) => {
      await app.goto()
      await app.startExerciseTest()
      const run = await runSession(app.page, { input })

      expect(run.intros).toBe(1)
      expect([...run.types].sort()).toEqual(registeredExerciseTypes())
      expect(run.answered).toBe(registeredExerciseTypes().length)
      // The driver answers typed cards wrong first, so the wrong-answer flow is covered too
      expect(run.results).toContain('wrong')
      expect(run.retypes).toBeGreaterThan(0)
      await expect(app.heading(S.SESSION_DONE)).toBeVisible()
    })
  }

  test('saves no answers or introductions', async ({ app }) => {
    await app.goto()
    const before = await readProgress(app.page)
    await app.startExerciseTest()
    await runSession(app.page)

    const after = await readProgress(app.page)
    expect(after?.reviewLog ?? []).toEqual(before?.reviewLog ?? [])
    expect(after?.introduced ?? []).toEqual(before?.introduced ?? [])
  })

  test('a reported error is kept and listed', async ({ app }) => {
    await app.goto()
    await app.startExerciseTest()
    let reported = false
    await runSession(app.page, {
      onQuestion: async () => {
        if (reported) return
        reported = true
        await app.reportCurrentCard()
      },
    })
    await app.finishSession()
    await expect(app.navButton(S.NAV_REPORTS)).toContainText('1')

    await app.openReports()
    await expect(app.reportCards()).toHaveCount(1)
  })
})

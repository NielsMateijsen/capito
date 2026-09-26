import { test, expect } from '../support/fixtures.ts'
import { S } from '../support/app.ts'
import { runSession } from '../support/session-driver.ts'

test.describe('unit', () => {
  test('shows can-do goals and words', async ({ app }) => {
    await app.goto()
    await app.openFirstUnit()
    await expect(app.canDoGoals().first()).toBeVisible()
    await expect(app.heading(S.UNIT_WORDS_HEADER)).toBeVisible()
  })

  test('a dialogue opens, shows the translation and returns', async ({ app }) => {
    await app.goto()
    const unitTitle = await app.openFirstUnit()
    const dialogues = app.unitLinks(S.UNIT_DIALOGUES_HEADER)
    test.skip(await dialogues.count() === 0, 'first unit has no dialogues')

    const title = (await dialogues.first().textContent()) ?? ''
    await dialogues.first().click()
    await expect(app.heading(title)).toBeVisible()
    await expect(app.dialogueLines().first()).toBeVisible()

    await app.button(S.DIALOGUE_NL_TOGGLE).click()
    await expect(app.dialogueTranslations().first()).toBeVisible()

    await app.back()
    await expect(app.heading(unitTitle)).toBeVisible()
  })

  test('a grammar lesson opens and returns', async ({ app }) => {
    await app.goto()
    const unitTitle = await app.openFirstUnit()
    const lessons = app.unitLinks(S.UNIT_GRAMMAR_HEADER)
    test.skip(await lessons.count() === 0, 'first unit has no grammar lessons yet')

    await lessons.first().click()
    await expect(app.grammarScreen()).toBeVisible()
    await app.back()
    await expect(app.heading(unitTitle)).toBeVisible()
  })

  test('practising the unit runs a session to the end', async ({ app }) => {
    // Session length follows config/app.json (maxReviewsPerSession)
    test.slow()
    await app.goto()
    await app.openFirstUnit()
    await app.startUnitPractice()

    const run = await runSession(app.page)
    expect(run.answered).toBeGreaterThan(0)
  })
})

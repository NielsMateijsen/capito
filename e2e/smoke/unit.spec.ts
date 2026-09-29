import { test, expect } from '../support/fixtures.ts'
import { S } from '../support/app.ts'
import { runSession } from '../support/session-driver.ts'
import { readProgress } from '../support/storage.ts'

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

  test('the exam can be taken right away (test-out) and shows a result with the can-do goals', async ({ app }) => {
    // Two whole sessions: the exam and the refresh of every missed question
    test.slow()
    await app.goto()
    await app.openFirstUnit()
    await app.startExam()

    // The driver answers every typed question wrong the first time, so the exam is not passed
    const run = await runSession(app.page)
    expect(run.answered).toBeGreaterThan(0)
    await expect(app.session()).toHaveAttribute('data-passed', 'false')
    await expect(app.page.getByText(S.CANDO_QUESTION)).toBeVisible()

    // Exam answers carry the unit and the exam size, so the result can be derived from the log
    const log = (await readProgress(app.page))?.reviewLog ?? []
    expect(log.every(e => e.mode === 'exam' && e.unit && e.examSize === run.answered)).toBe(true)

    // A can-do answer is kept
    await app.button(S.CANDO_YES).first().click()
    await expect.poll(async () => Object.values((await readProgress(app.page))?.unitMeta ?? {})[0]?.canDo?.[0]).toBe(true)

    // The missed questions can be practised straight away
    await app.button(S.EXAM_REFRESH_MISSED).click()
    await expect(app.session()).toHaveAttribute('data-mode', 'refresh')
    const refresh = await runSession(app.page)
    expect(refresh.answered).toBeGreaterThan(0)
    await expect(app.heading(S.REFRESH_DONE_TITLE)).toBeVisible()

    // The refresh adds to the log: the exam answers and the can-do answer are still there
    const after = await readProgress(app.page)
    expect(after?.reviewLog.filter(e => e.mode === 'exam')).toHaveLength(run.answered)
    expect(after?.reviewLog.filter(e => e.mode === 'refresh')).toHaveLength(refresh.answered)
    expect(Object.values(after?.unitMeta ?? {})[0]?.canDo?.[0]).toBe(true)
  })
})

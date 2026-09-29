import { test, expect } from '../support/fixtures.ts'
import { S } from '../support/app.ts'
import { runSession } from '../support/session-driver.ts'

test.describe('home', () => {
  test('loads with units and navigation', async ({ app }) => {
    await app.goto()
    await expect(app.heading(S.UNIT_LIST_HEADER)).toBeVisible()
    await expect(app.unitCards().first()).toBeVisible()
    for (const name of [S.NAV_SETTINGS, S.NAV_REPORTS, S.NAV_LEECH]) {
      await expect(app.navButton(name)).toBeVisible()
    }
  })

  test('the path shows the lessons of the first unit and starts the one that is open', async ({ app }) => {
    await app.goto()
    // At least one lesson with words, the final lesson and the exam
    expect(await app.lessonSteps().count()).toBeGreaterThanOrEqual(3)
    await expect(app.doneLessons()).toHaveCount(0)
    await app.startCurrentLesson()

    const run = await runSession(app.page)
    expect(run.answered).toBeGreaterThan(0)
  })

  test('fits a 360px screen without horizontal scrolling', async ({ app }) => {
    await app.goto()
    const overflow = await app.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('screens open and return, also with the browser back button', async ({ app }) => {
    await app.goto()

    await app.openSettings()
    await app.back()
    await app.expectHome()

    await app.openReports()
    await expect(app.page.getByText(S.REPORTS_EMPTY)).toBeVisible()
    await app.back()
    await app.expectHome()

    await app.openLeech()
    await expect(app.page.getByText(S.LEECH_EMPTY)).toBeVisible()
    await app.page.goBack()
    await app.expectHome()
  })
})

import { expect, type Page } from '@playwright/test'
import { S } from '../../src/ui/strings.nl.ts'

export { S }

/**
 * Everything the smoke tests know about the app's screens: how to reach them and where things
 * are on them. Specs describe *what* they check and use only this class (plus the session
 * driver and storage helpers). When a screen, route or markup changes, update it here.
 */
export class App {
  constructor(readonly page: Page) {}

  // ── Generic ──

  button(name: string) {
    return this.page.getByRole('button', { name, exact: true })
  }

  heading(name: string) {
    return this.page.getByRole('heading', { name, exact: true })
  }

  async back() {
    await this.button(S.BACK).click()
  }

  /** Accepts the next window.confirm() the app shows. */
  acceptNextConfirm() {
    this.page.once('dialog', dialog => void dialog.accept())
  }

  // ── Home ──

  /** Opens the app on the home screen (fresh IndexedDB per test). */
  async goto() {
    await this.page.goto('./')
    await this.expectHome()
  }

  async reload() {
    await this.page.reload()
    await this.expectHome()
  }

  async expectHome() {
    await expect(this.heading(S.APP_NAME)).toBeVisible()
    await expect(this.button(S.CONTINUE)).toBeVisible()
  }

  /** Home navigation buttons; their name can include a badge count. */
  navButton(name: string) {
    return this.page.locator('.home-nav').getByRole('button', { name })
  }

  /** Unit cards on home that can be opened. */
  unitCards() {
    return this.page.locator('.unit-card:not(.unit-card--locked)')
  }

  async openSettings() {
    await this.navButton(S.NAV_SETTINGS).click()
    await expect(this.heading(S.SETTINGS)).toBeVisible()
  }

  async openReports() {
    await this.navButton(S.NAV_REPORTS).click()
    await expect(this.heading(S.REPORTS)).toBeVisible()
  }

  async openLeech() {
    await this.navButton(S.NAV_LEECH).click()
    await expect(this.heading(S.LEECH)).toBeVisible()
  }

  // ── Settings ──

  versionInfo() {
    return this.page.locator('.settings-version')
  }

  // ── Reports ──

  reportCards() {
    return this.page.locator('.report-card')
  }

  // ── Unit ──

  /** Opens the first unit that is unlocked and returns its title. */
  async openFirstUnit(): Promise<string> {
    const card = this.unitCards().first()
    const title = (await card.locator('.unit-card-title').textContent()) ?? ''
    await card.click()
    await expect(this.heading(title)).toBeVisible()
    return title
  }

  /** The section under a unit-screen header, e.g. S.UNIT_DIALOGUES_HEADER. */
  unitSection(header: string) {
    return this.page.locator('section', { has: this.heading(header) })
  }

  canDoGoals() {
    return this.unitSection(S.UNIT_CANDO_HEADER).getByRole('listitem')
  }

  /** The lessons on the unit's path, in order. */
  lessonSteps() {
    return this.unitSection(S.UNIT_PATH_HEADER).getByRole('listitem')
  }

  /** The lesson that is open now (the only one that can be started). */
  currentLesson() {
    return this.unitSection(S.UNIT_PATH_HEADER).locator('[aria-current="step"]')
  }

  /** Lessons marked as done. */
  doneLessons() {
    return this.unitSection(S.UNIT_PATH_HEADER).locator('.lesson-step--done')
  }

  /** Buttons that open a dialogue or grammar lesson from the unit screen. */
  unitLinks(header: typeof S.UNIT_DIALOGUES_HEADER | typeof S.UNIT_GRAMMAR_HEADER) {
    return this.unitSection(header).getByRole('button')
  }

  // ── Dialogue and grammar ──

  dialogueLines() {
    return this.page.locator('.dialogue-line')
  }

  dialogueTranslations() {
    return this.page.locator('.dialogue-nl')
  }

  grammarScreen() {
    return this.page.locator('.grammar-screen')
  }

  // ── Session ──

  /** The session screen (question card or end screen); carries the data-* attributes. */
  session() {
    return this.page.getByTestId('session')
  }

  /** "Verder" on home: the next step on the path. */
  async startContinue() {
    await this.button(S.CONTINUE).click()
    await expect(this.session()).toBeVisible()
  }

  /** From the unit screen. */
  async startCurrentLesson() {
    await this.currentLesson().click()
    await expect(this.session()).toHaveAttribute('data-mode', 'lesson')
  }

  /** From the unit screen. */
  async startExam() {
    await this.button(S.EXAM).click()
    await expect(this.session()).toHaveAttribute('data-mode', 'exam')
  }

  async startExerciseTest() {
    await this.openSettings()
    await this.button(S.SETTINGS_TEST_START).click()
    await expect(this.session()).toHaveAttribute('data-mode', 'test')
  }

  /** Reports the card on screen with the default kind and an empty note. */
  async reportCurrentCard() {
    await this.session().getByRole('button', { name: S.REPORT, exact: true }).click()
    const dialog = this.page.getByRole('dialog')
    await dialog.getByRole('button', { name: S.REPORT_SUBMIT, exact: true }).click()
    await expect(dialog).toBeHidden()
  }

  /** From the end screen back to home. */
  async finishSession() {
    await this.button(S.TO_HOME).click()
    await this.expectHome()
  }

  /** "Verder" on the end screen: straight on to the next session. */
  async continueFromEndScreen() {
    const before = await this.session().getAttribute('data-phase')
    if (before !== 'done') throw new Error('continueFromEndScreen() needs the end screen')
    await this.session().getByRole('button', { name: S.CONTINUE, exact: true }).click()
    await expect(this.session()).not.toHaveAttribute('data-phase', 'done')
  }
}

import { expect, type Locator, type Page } from '@playwright/test'
import { S } from '../../src/ui/strings.nl.ts'

/**
 * Plays a session from the current screen until the end screen, whatever the cards are.
 *
 * It follows the session through the data-* attributes on [data-testid="session"]
 * (data-phase, data-pos, data-card-key, data-exercise-type, data-result; see SessionScreen.tsx)
 * and recognises the question UI by its shape, not by exercise type: choice options
 * ([data-option]), the answer text box or a flashcard. A new exercise type that reuses one of
 * those shapes needs no change here.
 *
 * Strategy: the first time a card is seen it is answered wrong on purpose (typed) or with
 * the first option (choice), so feedback and retyping are exercised too. The correct answer
 * shown in the feedback is remembered and used when the card comes back.
 */

export type InputMode = 'click' | 'keyboard'

export interface SessionRun {
  /** Exercise type of every question shown, in order. */
  types: string[]
  intros: number
  /** Feedback result per answered typed/choice card: correct, almost or wrong. */
  results: string[]
  /** Times the correct answer had to be retyped after a wrong answer. */
  retypes: number
  /** Answer count shown by the end screen. */
  answered: number
}

export interface DriverOptions {
  input?: InputMode
  maxSteps?: number
  /** Called on every question before it is answered, e.g. to report an error. */
  onQuestion?: (info: { type: string; cardKey: string }) => Promise<void>
  /** Stop early (without answering) as soon as this returns true for the current step. */
  until?: (info: { phase: string; type: string }) => boolean
}

/** Answer that is never correct, to trigger the wrong-answer flow. */
const WRONG_ANSWER = 'x'

export async function runSession(page: Page, options: DriverOptions = {}): Promise<SessionRun> {
  const { input = 'click', maxSteps = 200, onQuestion, until } = options
  const session = page.getByTestId('session')
  const button = (name: string) => session.getByRole('button', { name, exact: true })
  const known = new Map<string, string>()
  const run: SessionRun = { types: [], intros: 0, results: [], retypes: 0, answered: 0 }

  // Keyboard-first (.claude/rules/ui.md): after every step the focus is inside the session.
  // Waiting for it also avoids pressing a key before React has moved the focus.
  const press = async (key: string) => {
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.closest('[data-testid="session"]')), {
        message: 'focus is not inside the session',
      })
      .toBe(true)
    await page.keyboard.press(key)
  }

  let current = ''
  for (let step = 0; step < maxSteps; step++) {
    const phase = await session.getAttribute('data-phase')
    const cardKey = (await session.getAttribute('data-card-key')) ?? ''
    const type = (await session.getAttribute('data-exercise-type')) ?? ''
    current = await stateOf(session)

    if (until?.({ phase: phase ?? '', type })) return run

    if (phase === 'done') {
      run.answered = Number(await session.getAttribute('data-answered'))
      return run
    }

    if (phase === 'intro') {
      run.intros++
      if (input === 'keyboard') await press('Enter')
      else await button(S.INTRO_DONE).click()
    } else if (phase === 'question' && !type) {
      // A card that cannot be built is skipped by the app itself
      await expect.poll(() => stateOf(session), { message: `unbuildable card not skipped at "${current}"` }).not.toBe(current)
      continue
    } else if (phase === 'question') {
      run.types.push(type)
      await onQuestion?.({ type, cardKey })
      await answerQuestion(session, cardKey, type, known.get(cardKey), input, press)
    } else if (phase === 'flashcard-reveal') {
      if (input === 'keyboard') await press('2')
      else await button(S.FLASHCARD_GOOD).click()
    } else if (phase === 'feedback') {
      run.results.push(await feedbackResult(session))
      const answer = await shownAnswer(session)
      if (answer !== null) known.set(cardKey, answer)
      if (input === 'keyboard') await press('Enter')
      else await button(S.NEXT).click()
    } else if (phase === 'lapse-retype') {
      run.retypes++
      const answer = (await session.locator('[data-correct-answer]').textContent()) ?? ''
      known.set(cardKey, answer)
      await session.getByRole('textbox', { name: S.LAPSE_RETYPE, exact: true }).fill(answer)
      if (input === 'keyboard') await press('Enter')
      else await button(S.LAPSE_CONFIRM).click()
    } else {
      throw new Error(`Unknown session phase "${phase}": extend runSession in e2e/support/session-driver.ts`)
    }

    // Every action moves the session to another phase or position; wait for that before reading again
    await expect.poll(() => stateOf(session), { message: `session stuck at "${current}"` }).not.toBe(current)
  }
  throw new Error(`Session did not finish within ${maxSteps} steps (last state "${current}")`)
}

async function stateOf(session: Locator): Promise<string> {
  const attrs = await Promise.all(['data-phase', 'data-pos', 'data-card-key'].map(a => session.getAttribute(a)))
  return attrs.map(a => a ?? '').join(' ')
}

async function answerQuestion(
  session: Locator,
  cardKey: string,
  type: string,
  answer: string | undefined,
  input: InputMode,
  press: (key: string) => Promise<void>,
) {
  const choices = session.locator('[data-option]')
  const textInput = session.getByRole('textbox', { name: S.ANSWER_LABEL, exact: true })
  const reveal = session.getByRole('button', { name: S.FLASHCARD_REVEAL, exact: true })

  if (await choices.count() > 0) {
    const labels = await session.locator('[data-option-label]').allTextContents()
    const index = answer === undefined ? 0 : Math.max(0, labels.indexOf(answer))
    if (input === 'keyboard') await press(String(index + 1))
    else await choices.nth(index).click()
  } else if (await textInput.count() > 0) {
    if (input === 'keyboard') await expect(textInput).toBeFocused()
    await textInput.fill(answer ?? WRONG_ANSWER)
    if (input === 'keyboard') await press('Enter')
    else await session.getByRole('button', { name: S.CHECK, exact: true }).click()
  } else if (await reveal.count() > 0) {
    if (input === 'keyboard') await press('Enter')
    else await reveal.click()
  } else {
    throw new Error(`No known question UI for "${type}" (${cardKey}): extend answerQuestion in e2e/support/session-driver.ts`)
  }
}

async function feedbackResult(session: Locator): Promise<string> {
  return (await session.getAttribute('data-result')) ?? ''
}

/** The correct answer as the feedback shows it, or null when it is not shown (correct answer). */
async function shownAnswer(session: Locator): Promise<string | null> {
  const choice = session.locator('[data-state="ok"] [data-option-label], [data-state="answer"] [data-option-label]')
  if (await choice.count() > 0) return (await choice.first().textContent()) ?? null
  const typed = session.locator('[data-correct-answer]')
  if (await typed.count() > 0) return (await typed.textContent()) ?? null
  return null
}

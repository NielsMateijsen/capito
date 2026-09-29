import { describe, it, expect } from 'vitest'
import { overview, type OverviewInput } from '../../src/engine/overview.ts'
import type { SessionBuilderConfig } from '../../src/engine/session-builder.ts'
import type { ReviewEntry } from '../../src/engine/review-log.ts'
import type { ProgressState } from '../../src/storage/types.ts'
import type { CardState } from '../../src/engine/srs.ts'

const NOW = Date.parse('2026-09-27T10:00:00Z')
const DAY = 86_400_000
const STAGES = ['mc-sentence', 'mc-word', 'cloze-word', 'translate-nl-it']

const CONFIG: SessionBuilderConfig & { streak: { minRefreshAnswers: number } } = {
  session: { maxSameTypeInRow: 3, excludedTypes: ['mc-sentence', 'mc-word'], timeZone: 'Europe/Amsterdam' },
  lesson: {
    itemsPerLesson: 2, minItemsPerLesson: 1, maxItemsPerLesson: 8, maxStepsPerItemPerLesson: 2,
    maxFinishItemsPerLesson: 6, maxReviewsPerLesson: 4, newReviewCardsPerLesson: 2,
  },
  refresh: { maxCards: 15, prominentAboveDueItems: 2 },
  lapse: { retypeCorrectAnswer: true, reinsertInSession: true, reinsertAfterCards: 4 },
  leech: { lapseThreshold: 6, showExtraContext: true },
  grading: { correct: 4, almost: 3, hintUsed: 3, wrong: 1, flashcard: { again: 1, good: 4, easy: 5 } },
  ladder: {
    stages: STAGES, passResults: ['correct'], dropOnWrong: 1, minGapSameItem: 2,
    optionCount: 4, minSentencesPerItem: 3, introAutoplay: true,
  },
  exam: { passThreshold: 0.8, passResults: ['correct', 'almost'] },
  streak: { minRefreshAnswers: 3 },
}

const UNITS = [
  { id: 'u01', order: 1, requires: [] },
  { id: 'u02', order: 2, requires: ['u01'] },
]
const UNIT_ITEMS = new Map([['u01', ['w_a', 'w_b']], ['u02', ['w_c']]])
const LADDER_ITEMS = ['w_a', 'w_b', 'w_c'].map(id => ({ itemId: id, stageKeys: STAGES.map(s => `${s}:${id}`) }))
const REVIEW_KEYS = ['w_a', 'w_b', 'w_c'].map(id => `translate-it-nl:${id}`)

function entry(key: string, t: number, extra: Partial<ReviewEntry> = {}): ReviewEntry {
  return { t: new Date(t).toISOString(), key, result: 'correct', grade: 4, ms: 1, hint: false, session: 's', mode: 'lesson', cv: 'x', ...extra }
}

function progress(reviewLog: ReviewEntry[], cards: Record<string, CardState> = {}): ProgressState {
  return { schema: 3, cards, reviewLog, introduced: [], unitMeta: {}, flags: [], settings: {}, meta: {} }
}

function input(p: ProgressState, overrides: Partial<OverviewInput> = {}): OverviewInput {
  return {
    now: NOW,
    units: UNITS,
    unitItems: UNIT_ITEMS,
    ladderItems: LADDER_ITEMS,
    allCardKeys: [...LADDER_ITEMS.flatMap(i => i.stageKeys), ...REVIEW_KEYS],
    cardRequires: new Map(),
    progress: p,
    config: CONFIG,
    unlockAll: false,
    ...overrides,
  }
}

function lesson1(t: number): ReviewEntry[] {
  return ['w_a', 'w_b'].flatMap(id => STAGES.slice(0, 2).map((s, i) => entry(`${s}:${id}`, t + i, { lesson: 'u01#1' })))
}

function passedExam(t: number): ReviewEntry[] {
  return ['w_a', 'w_b'].map(id => entry(`translate-nl-it:${id}`, t, { mode: 'exam', session: 'e1', unit: 'u01', examSize: 2 }))
}

describe('overview()', () => {
  it('sends a new learner to the first lesson of the first unit and keeps later units locked', () => {
    const o = overview(input(progress([])))
    expect(o.next).toMatchObject({ kind: 'lesson', lesson: { id: 'u01#1' } })
    expect([...o.unlocked]).toEqual(['u01'])
    expect(o.paths.get('u01')?.lessons.map(s => s.lesson.id)).toEqual(['u01#1', 'u01#final'])
  })

  it('moves on to the next lesson once a lesson is done', () => {
    const o = overview(input(progress(lesson1(NOW - DAY))))
    expect(o.next).toMatchObject({ kind: 'lesson', lesson: { id: 'u01#final' } })
  })

  it('sends the learner to the exam when every lesson is done', () => {
    const log = ['w_a', 'w_b'].flatMap(id => STAGES.map((s, i) => entry(`${s}:${id}`, NOW - DAY + i, { lesson: 'u01#1' })))
    expect(overview(input(progress(log))).next).toEqual({ kind: 'exam', unitId: 'u01' })
  })

  it('opens the next unit after a passed exam, also as a test-out', () => {
    const o = overview(input(progress(passedExam(NOW - DAY))))
    expect(o.passed).toEqual(new Set(['u01']))
    expect(o.unlocked).toEqual(new Set(['u01', 'u02']))
    expect(o.bestScore.get('u01')).toBe(1)
    expect(o.next).toMatchObject({ kind: 'lesson', lesson: { id: 'u02#1' } })
  })

  it('opens every unit with unlockAll, but still points to the first unit not passed', () => {
    const o = overview(input(progress([]), { unlockAll: true }))
    expect(o.unlocked).toEqual(new Set(['u01', 'u02']))
    expect(o.next).toMatchObject({ kind: 'lesson', lesson: { unitId: 'u01' } })
  })

  it('has no next step when every unit is passed', () => {
    const log = [...passedExam(NOW - DAY), entry('translate-nl-it:w_c', NOW - 10, { mode: 'exam', session: 'e2', unit: 'u02', examSize: 1 })]
    expect(overview(input(progress(log))).next).toEqual({ kind: 'none' })
  })

  it('counts due review cards and words, and marks refresh as prominent above the threshold', () => {
    const cards = { 'translate-it-nl:w_a': { ease: 2.5, interval: 1, due: NOW - DAY, reps: 1, lapses: 0 } }
    const one = overview(input(progress(passedExam(NOW - 3 * DAY), cards)))
    expect(one.refresh).toEqual({ dueCards: 1, dueItems: 1, prominent: false })
    const both = { ...cards, 'translate-it-nl:w_b': { ...cards['translate-it-nl:w_a'] } }
    expect(overview(input(progress(passedExam(NOW - 3 * DAY), both))).refresh.prominent).toBe(true)
  })

  it('counts a finished lesson today for the streak', () => {
    const o = overview(input(progress(lesson1(NOW - 1000))))
    expect(o.streak).toEqual({ current: 1, longest: 1, today: true })
  })
})

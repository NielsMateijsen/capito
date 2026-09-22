import { describe, it, expect } from 'vitest'
import {
  buildSession,
  isLeech,
  gradeFromResult,
  lapseReinsertAt,
  type SessionBuilderConfig,
  type SessionInput,
} from '../../src/engine/session-builder.ts'
import type { ProgressState } from '../../src/storage/types.ts'
import type { CardState } from '../../src/engine/srs.ts'
import type { ReviewEntry } from '../../src/engine/review-log.ts'

const NOW = 1_700_000_000_000
const DAY = 86_400_000

const CONFIG: SessionBuilderConfig = {
  session: { maxReviewsPerSession: 30, newCardsPerDay: 10, minOldMaterialRatio: 0.3, maxSameTypeInRow: 3 },
  backlog: { maxDueShownPerDay: 40, pauseNewCardsAboveDue: 60, returnAfterDays: 7, returnMaxSessionReviews: 20 },
  lapse: { retypeCorrectAnswer: true, reinsertInSession: true, reinsertAfterCards: 4 },
  leech: { lapseThreshold: 6, showExtraContext: true },
  grading: { correct: 4, almost: 3, hintUsed: 3, wrong: 1, flashcard: { again: 1, good: 4, easy: 5 } },
}

function makeCard(due: number): CardState {
  return { ease: 2.5, interval: 1, due, reps: 1, lapses: 0 }
}

function makeProgress(overrides: Partial<ProgressState> = {}): ProgressState {
  return {
    schema: 1,
    cards: {},
    reviewLog: [],
    introduced: [],
    unitMeta: {},
    flags: [],
    settings: {},
    meta: {},
    ...overrides,
  }
}

function makeEntry(key: string, t: number): ReviewEntry {
  return {
    t: new Date(t).toISOString(),
    key,
    result: 'correct',
    grade: 4,
    ms: 1000,
    hint: false,
    session: 'test-session',
    mode: 'daily',
    cv: 'abc12345',
  }
}

function makeInput(overrides: Partial<SessionInput> = {}): SessionInput {
  return {
    now: NOW,
    allCardKeys: [],
    cardToUnit: new Map(),
    progress: makeProgress(),
    config: CONFIG,
    ...overrides,
  }
}

function exerciseKeys(session: ReturnType<typeof buildSession>): string[] {
  return session.queue
    .filter((item): item is { kind: 'exercise'; cardKey: string; isNew: boolean } => item.kind === 'exercise')
    .map(item => item.cardKey)
}

function cardType(key: string): string {
  return key.split(':')[0]
}

// ─── Due selection ───────────────────────────────────────────────────────────

describe('due card selection', () => {
  it('includes cards with due <= now', () => {
    const session = buildSession(makeInput({
      allCardKeys: ['translate-it-nl:w_a'],
      progress: makeProgress({ cards: { 'translate-it-nl:w_a': makeCard(NOW - DAY) } }),
    }))
    expect(exerciseKeys(session)).toContain('translate-it-nl:w_a')
  })

  it('excludes cards with due > now', () => {
    const session = buildSession(makeInput({
      allCardKeys: ['translate-it-nl:w_a'],
      progress: makeProgress({ cards: { 'translate-it-nl:w_a': makeCard(NOW + DAY) } }),
    }))
    expect(exerciseKeys(session)).not.toContain('translate-it-nl:w_a')
  })
})

// ─── Ordering ────────────────────────────────────────────────────────────────

describe('backlog order', () => {
  it('places most-overdue card before less-overdue card', () => {
    const session = buildSession(makeInput({
      allCardKeys: ['translate-it-nl:w_a', 'translate-it-nl:w_b'],
      progress: makeProgress({
        cards: {
          'translate-it-nl:w_a': makeCard(NOW - DAY),        // 1 day overdue
          'translate-it-nl:w_b': makeCard(NOW - 3 * DAY),    // 3 days overdue
        },
      }),
    }))
    const keys = exerciseKeys(session)
    expect(keys.indexOf('translate-it-nl:w_b')).toBeLessThan(keys.indexOf('translate-it-nl:w_a'))
  })
})

// ─── maxDueShownPerDay ───────────────────────────────────────────────────────

describe('backlog.maxDueShownPerDay', () => {
  it('caps the number of due cards shown per day', () => {
    const cfg: SessionBuilderConfig = {
      ...CONFIG,
      backlog: { ...CONFIG.backlog, maxDueShownPerDay: 2 },
    }
    const keys = ['translate-it-nl:w_a', 'translate-it-nl:w_b', 'translate-it-nl:w_c',
      'translate-it-nl:w_d', 'translate-it-nl:w_e']
    const cards: ProgressState['cards'] = Object.fromEntries(
      keys.map(k => [k, makeCard(NOW - DAY)])
    )
    const session = buildSession(makeInput({ allCardKeys: keys, progress: makeProgress({ cards }), config: cfg }))
    expect(exerciseKeys(session)).toHaveLength(2)
  })
})

// ─── pauseNewCardsAboveDue ───────────────────────────────────────────────────

describe('backlog.pauseNewCardsAboveDue', () => {
  it('blocks new cards when total due exceeds threshold', () => {
    const dueKeys = Array.from({ length: 65 }, (_, i) => `translate-it-nl:w_due_${i}`)
    const newKey = 'translate-it-nl:w_new'
    const cards: ProgressState['cards'] = Object.fromEntries(
      dueKeys.map(k => [k, makeCard(NOW - DAY)])
    )
    const session = buildSession(makeInput({
      allCardKeys: [...dueKeys, newKey],
      progress: makeProgress({ cards }),
    }))
    expect(exerciseKeys(session)).not.toContain(newKey)
  })
})

// ─── newCardsPerDay ──────────────────────────────────────────────────────────

describe('session.newCardsPerDay', () => {
  it('limits new cards based on how many were started today', () => {
    // 8 cards already first-seen today → only 2 new slots remain (limit = 10)
    const todayKeys = Array.from({ length: 8 }, (_, i) => `translate-it-nl:w_today_${i}`)
    const todayCards: ProgressState['cards'] = Object.fromEntries(
      todayKeys.map(k => [k, makeCard(NOW + 30 * DAY)])
    )
    const log: ReviewEntry[] = todayKeys.map(k => makeEntry(k, NOW - 1000))  // reviewed moments ago
    const newKeys = ['article:w_new_0', 'article:w_new_1', 'article:w_new_2', 'article:w_new_3']
    const session = buildSession(makeInput({
      allCardKeys: [...todayKeys, ...newKeys],
      progress: makeProgress({ cards: todayCards, reviewLog: log }),
    }))
    const newInSession = exerciseKeys(session).filter(k => !todayCards[k])
    expect(newInSession.length).toBeLessThanOrEqual(2)
  })
})

// ─── Return after pause ──────────────────────────────────────────────────────

describe('backlog.returnAfterDays', () => {
  it('sets isReturn=true after absence of returnAfterDays or more', () => {
    const log: ReviewEntry[] = [makeEntry('translate-it-nl:w_a', NOW - 8 * DAY)]
    const session = buildSession(makeInput({
      progress: makeProgress({ reviewLog: log }),
    }))
    expect(session.isReturn).toBe(true)
  })

  it('sets isReturn=false when last session was recent', () => {
    const log: ReviewEntry[] = [makeEntry('translate-it-nl:w_a', NOW - 2 * DAY)]
    const session = buildSession(makeInput({
      progress: makeProgress({ reviewLog: log }),
    }))
    expect(session.isReturn).toBe(false)
  })

  it('caps session at returnMaxSessionReviews when isReturn', () => {
    const dueKeys = Array.from({ length: 30 }, (_, i) => `translate-it-nl:w_${i}`)
    const cards: ProgressState['cards'] = Object.fromEntries(
      dueKeys.map(k => [k, makeCard(NOW - DAY)])
    )
    const log: ReviewEntry[] = [makeEntry('translate-it-nl:w_0', NOW - 8 * DAY)]
    const session = buildSession(makeInput({
      allCardKeys: dueKeys,
      progress: makeProgress({ cards, reviewLog: log }),
    }))
    expect(session.isReturn).toBe(true)
    expect(exerciseKeys(session).length).toBeLessThanOrEqual(CONFIG.backlog.returnMaxSessionReviews)
  })

  it('blocks new cards when isReturn', () => {
    const log: ReviewEntry[] = [makeEntry('translate-it-nl:w_seen', NOW - 8 * DAY)]
    const newKey = 'translate-it-nl:w_new'
    const session = buildSession(makeInput({
      allCardKeys: [newKey],
      progress: makeProgress({ reviewLog: log }),
    }))
    expect(session.isReturn).toBe(true)
    expect(exerciseKeys(session)).not.toContain(newKey)
  })
})

// ─── minOldMaterialRatio ─────────────────────────────────────────────────────

describe('session.minOldMaterialRatio', () => {
  it('adds other-unit cards when target unit dominates', () => {
    // 5 u01 cards due, 0 u02 due — but 3 u02 cards exist (not due)
    const u01Keys = Array.from({ length: 5 }, (_, i) => `translate-it-nl:w_u01_${i}`)
    const u02Keys = Array.from({ length: 3 }, (_, i) => `article:w_u02_${i}`)
    const u01Cards: ProgressState['cards'] = Object.fromEntries(
      u01Keys.map(k => [k, makeCard(NOW - DAY)])
    )
    const u02Cards: ProgressState['cards'] = Object.fromEntries(
      u02Keys.map(k => [k, makeCard(NOW + 30 * DAY)])  // not due
    )
    const cardToUnit = new Map([
      ...u01Keys.map(k => [k, 'u01'] as [string, string]),
      ...u02Keys.map(k => [k, 'u02'] as [string, string]),
    ])
    const session = buildSession(makeInput({
      allCardKeys: [...u01Keys, ...u02Keys],
      cardToUnit,
      progress: makeProgress({ cards: { ...u01Cards, ...u02Cards } }),
      targetUnitId: 'u01',
    }))
    const exercises = exerciseKeys(session)
    const otherCount = exercises.filter(k => cardToUnit.get(k) !== 'u01').length
    const total = exercises.length
    // At least 30% should be from other units
    expect(otherCount / total).toBeGreaterThanOrEqual(CONFIG.session.minOldMaterialRatio - 0.01)
  })

  it('does not require other cards when no target-unit cards in session', () => {
    const session = buildSession(makeInput({ targetUnitId: 'u01' }))
    expect(session.queue).toEqual([])
  })
})

// ─── maxSameTypeInRow ────────────────────────────────────────────────────────

describe('session.maxSameTypeInRow', () => {
  it('inserts a different-type card after 3 consecutive same-type cards', () => {
    // 4 translate-it-nl + 1 article; after mixing the article should break the run of 3
    const ttKeys = Array.from({ length: 4 }, (_, i) => `translate-it-nl:w_tt_${i}`)
    const arKey = 'article:w_ar_0'
    const cards: ProgressState['cards'] = Object.fromEntries(
      [...ttKeys, arKey].map(k => [k, makeCard(NOW - DAY)])
    )
    const session = buildSession(makeInput({
      allCardKeys: [...ttKeys, arKey],
      progress: makeProgress({ cards }),
    }))
    const exercises = exerciseKeys(session)
    // The 4th item (index 3) must not be type 'translate-it-nl'
    expect(cardType(exercises[3])).not.toBe('translate-it-nl')
  })
})

// ─── Session cap ─────────────────────────────────────────────────────────────

describe('session.maxReviewsPerSession', () => {
  it('caps total exercises at maxReviewsPerSession', () => {
    const dueKeys = Array.from({ length: 50 }, (_, i) => `translate-it-nl:w_${i}`)
    const cards: ProgressState['cards'] = Object.fromEntries(
      dueKeys.map(k => [k, makeCard(NOW - DAY)])
    )
    const session = buildSession(makeInput({
      allCardKeys: dueKeys,
      progress: makeProgress({ cards }),
    }))
    expect(exerciseKeys(session).length).toBeLessThanOrEqual(CONFIG.session.maxReviewsPerSession)
  })
})

// ─── Intro items ─────────────────────────────────────────────────────────────

describe('intro items', () => {
  it('prepends an intro item for new unseen content', () => {
    const session = buildSession(makeInput({
      allCardKeys: ['translate-it-nl:w_new'],
    }))
    const introItems = session.queue.filter(item => item.kind === 'intro')
    expect(introItems).toHaveLength(1)
    expect(introItems[0]).toMatchObject({ kind: 'intro', itemId: 'w_new' })
  })

  it('intro item appears before its exercise item', () => {
    const session = buildSession(makeInput({
      allCardKeys: ['translate-it-nl:w_new'],
    }))
    const introIdx = session.queue.findIndex(item => item.kind === 'intro')
    const exerciseIdx = session.queue.findIndex(item => item.kind === 'exercise')
    expect(introIdx).toBeLessThan(exerciseIdx)
  })

  it('no intro for item already in progress.introduced', () => {
    const session = buildSession(makeInput({
      allCardKeys: ['translate-it-nl:w_seen'],
      progress: makeProgress({ introduced: ['w_seen'] }),
    }))
    const introItems = session.queue.filter(item => item.kind === 'intro')
    expect(introItems).toHaveLength(0)
  })

  it('newItemIds lists item IDs of new unseen content', () => {
    const session = buildSession(makeInput({
      allCardKeys: ['translate-it-nl:w_new'],
    }))
    expect(session.newItemIds).toContain('w_new')
  })

  it('no duplicate intros for multiple cards of the same item', () => {
    // translate-it-nl:w_x and article:w_x share itemId 'w_x'
    const session = buildSession(makeInput({
      allCardKeys: ['translate-it-nl:w_x', 'article:w_x'],
    }))
    const introItems = session.queue.filter(item => item.kind === 'intro')
    const introIds = introItems.map(i => (i as { kind: 'intro'; itemId: string }).itemId)
    const unique = new Set(introIds)
    expect(unique.size).toBe(introIds.length)
  })
})

// ─── Unknown card in progress ─────────────────────────────────────────────────

describe('unknown cards in progress', () => {
  it('ignores cards in progress that are not in allCardKeys', () => {
    const session = buildSession(makeInput({
      allCardKeys: ['translate-it-nl:w_a'],
      progress: makeProgress({
        cards: {
          'translate-it-nl:w_a': makeCard(NOW - DAY),
          'translate-it-nl:w_ghost': makeCard(NOW - DAY),  // not in allCardKeys
        },
      }),
    }))
    expect(exerciseKeys(session)).not.toContain('translate-it-nl:w_ghost')
  })
})

// ─── isLeech ─────────────────────────────────────────────────────────────────

describe('isLeech()', () => {
  it('returns false when lapses < lapseThreshold', () => {
    const state: CardState = { ease: 2.5, interval: 1, due: NOW, reps: 5, lapses: 5 }
    expect(isLeech(state, { lapseThreshold: 6 })).toBe(false)
  })

  it('returns true when lapses >= lapseThreshold', () => {
    const state: CardState = { ease: 2.5, interval: 1, due: NOW, reps: 5, lapses: 6 }
    expect(isLeech(state, { lapseThreshold: 6 })).toBe(true)
  })

  it('returns true when lapses exceeds lapseThreshold', () => {
    const state: CardState = { ease: 2.5, interval: 1, due: NOW, reps: 10, lapses: 9 }
    expect(isLeech(state, { lapseThreshold: 6 })).toBe(true)
  })
})

// ─── gradeFromResult ─────────────────────────────────────────────────────────

describe('gradeFromResult()', () => {
  const g = CONFIG.grading

  it('correct without hint → grading.correct (4)', () => {
    expect(gradeFromResult('correct', false, g)).toBe(4)
  })

  it('almost without hint → grading.almost (3)', () => {
    expect(gradeFromResult('almost', false, g)).toBe(3)
  })

  it('correct with hint → grading.hintUsed (3), not grading.correct (4)', () => {
    expect(gradeFromResult('correct', true, g)).toBe(3)
  })

  it('almost with hint → grading.hintUsed (3)', () => {
    expect(gradeFromResult('almost', true, g)).toBe(3)
  })

  it('wrong → grading.wrong (1) regardless of hint', () => {
    expect(gradeFromResult('wrong', false, g)).toBe(1)
    expect(gradeFromResult('wrong', true, g)).toBe(1)
  })

  it('again → flashcard.again (1)', () => {
    expect(gradeFromResult('again', false, g)).toBe(1)
  })

  it('good → flashcard.good (4)', () => {
    expect(gradeFromResult('good', false, g)).toBe(4)
  })

  it('easy → flashcard.easy (5)', () => {
    expect(gradeFromResult('easy', false, g)).toBe(5)
  })
})

// ─── lapseReinsertAt ─────────────────────────────────────────────────────────

describe('lapseReinsertAt()', () => {
  it('returns currentIdx + reinsertAfterCards', () => {
    expect(lapseReinsertAt(2, { reinsertAfterCards: 4 })).toBe(6)
  })

  it('works at index 0', () => {
    expect(lapseReinsertAt(0, { reinsertAfterCards: 4 })).toBe(4)
  })
})

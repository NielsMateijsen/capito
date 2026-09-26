import { describe, it, expect } from 'vitest'
import {
  buildSession,
  isLeech,
  gradeFromResult,
  lapseReinsertAt,
  replanAfterWrong,
  scheduleChains,
  type SessionBuilderConfig,
  type SessionInput,
  type SessionItem,
} from '../../src/engine/session-builder.ts'
import { seededRandom } from '../../src/engine/distractors.ts'
import type { LadderItem } from '../../src/engine/ladder.ts'
import type { ProgressState } from '../../src/storage/types.ts'
import type { CardState } from '../../src/engine/srs.ts'
import type { ReviewEntry } from '../../src/engine/review-log.ts'

const NOW = 1_700_000_000_000
const DAY = 86_400_000

const STAGES = ['mc-sentence', 'mc-word', 'cloze-word', 'translate-nl-it']

const CONFIG: SessionBuilderConfig = {
  session: { maxReviewsPerSession: 30, newCardsPerDay: 10, minOldMaterialRatio: 0.3, maxSameTypeInRow: 3, excludedTypes: ['flashcard', 'mc-sentence', 'mc-word'], timeZone: 'UTC' },
  backlog: { maxDueShownPerDay: 40, pauseNewCardsAboveDue: 60, returnAfterDays: 7, returnMaxSessionReviews: 20 },
  lapse: { retypeCorrectAnswer: true, reinsertInSession: true, reinsertAfterCards: 4 },
  leech: { lapseThreshold: 6, showExtraContext: true },
  grading: { correct: 4, almost: 3, hintUsed: 3, wrong: 1, flashcard: { again: 1, good: 4, easy: 5 } },
  ladder: {
    stages: STAGES,
    passResults: ['correct', 'good', 'easy'],
    maxStepsPerItemPerDay: 2,
    dropOnWrong: 1,
    newItemsPerDay: 5,
    maxItemsInProgress: 15,
    reviewShare: 0.4,
    minGapSameItem: 2,
    optionCount: 4,
    minSentencesPerItem: 3,
    introAutoplay: true,
  },
}

function ladderItem(itemId: string): LadderItem {
  return { itemId, stageKeys: STAGES.map(t => `${t}:${itemId}`) }
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

function makeEntry(key: string, t: number, result: ReviewEntry['result'] = 'correct'): ReviewEntry {
  return {
    t: new Date(t).toISOString(),
    key,
    result,
    grade: result === 'wrong' ? 1 : 4,
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
  it('selects the most-overdue cards when the backlog is capped', () => {
    const cfg: SessionBuilderConfig = { ...CONFIG, backlog: { ...CONFIG.backlog, maxDueShownPerDay: 1 } }
    const session = buildSession(makeInput({
      allCardKeys: ['translate-it-nl:w_a', 'translate-it-nl:w_b'],
      progress: makeProgress({
        cards: {
          'translate-it-nl:w_a': makeCard(NOW - DAY),        // 1 day overdue
          'translate-it-nl:w_b': makeCard(NOW - 3 * DAY),    // 3 days overdue
        },
      }),
      config: cfg,
    }))
    expect(exerciseKeys(session)).toEqual(['translate-it-nl:w_b'])
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

function longestRun(keys: string[]): number {
  let best = 0
  let run = 0
  for (let i = 0; i < keys.length; i++) {
    run = i > 0 && cardType(keys[i]) === cardType(keys[i - 1]) ? run + 1 : 1
    best = Math.max(best, run)
  }
  return best
}

describe('session.maxSameTypeInRow', () => {
  it('never puts more than 3 cards of one type in a row when that is possible', () => {
    // 4 translate-it-nl + 1 article: only T T T A T (or similar) is valid
    const ttKeys = Array.from({ length: 4 }, (_, i) => `translate-it-nl:w_tt_${i}`)
    const arKey = 'article:w_ar_0'
    const cards: ProgressState['cards'] = Object.fromEntries(
      [...ttKeys, arKey].map(k => [k, makeCard(NOW - DAY)])
    )
    for (let seed = 0; seed < 50; seed++) {
      const session = buildSession(makeInput({
        allCardKeys: [...ttKeys, arKey],
        progress: makeProgress({ cards }),
        seed,
      }))
      expect(longestRun(exerciseKeys(session))).toBeLessThanOrEqual(3)
    }
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

// ─── Learning ladder ─────────────────────────────────────────────────────────

function ladderInput(itemIds: string[], overrides: Partial<SessionInput> = {}): SessionInput {
  const items = itemIds.map(ladderItem)
  const reviewKeys = itemIds.map(id => `translate-it-nl:${id}`)
  const { allCardKeys: extra = [], ...rest } = overrides
  return makeInput({
    allCardKeys: [...items.flatMap(i => i.stageKeys), ...reviewKeys, ...extra],
    ladderItems: items,
    ...rest,
  })
}

function ids(n: number, prefix = 'w'): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}_${i}`)
}

function passes(itemId: string, stageCount: number, t: number): ReviewEntry[] {
  return STAGES.slice(0, stageCount).map((type, i) => makeEntry(`${type}:${itemId}`, t + i))
}

describe('learning ladder', () => {
  it('puts the intro of a new item directly before its first stage', () => {
    for (let seed = 0; seed < 20; seed++) {
      const session = buildSession(ladderInput(['w_a', 'w_b'], { seed }))
      session.queue.forEach((item, i) => {
        if (item.kind !== 'intro') return
        expect(session.queue[i + 1]).toMatchObject({ kind: 'exercise', cardKey: `mc-sentence:${item.itemId}` })
      })
    }
  })

  it('introduces new items in learning order, whatever the seed', () => {
    for (let seed = 0; seed < 30; seed++) {
      const session = buildSession(ladderInput(ids(5), { seed }))
      const intros = session.queue.filter(i => i.kind === 'intro').map(i => (i as { itemId: string }).itemId)
      expect(intros).toEqual(ids(5))
    }
  })

  it('gives a new item at most maxStepsPerItemPerDay stages', () => {
    const keys = exerciseKeys(buildSession(ladderInput(['w_a'])))
    expect(keys).toEqual(['mc-sentence:w_a', 'mc-word:w_a'])
  })

  it('introduces at most ladder.newItemsPerDay items', () => {
    const session = buildSession(ladderInput(ids(8)))
    expect(session.newItemIds).toHaveLength(CONFIG.ladder.newItemsPerDay)
    expect(session.newItemIds).toEqual(['w_0', 'w_1', 'w_2', 'w_3', 'w_4'])
  })

  it('counts items started earlier today against the daily limit', () => {
    const log = ['w_0', 'w_1', 'w_2'].flatMap(id => passes(id, 1, NOW - 1000))
    const session = buildSession(ladderInput(ids(8), { progress: makeProgress({ reviewLog: log }) }))
    expect(session.newItemIds).toEqual(['w_3', 'w_4'])
  })

  it('adds no new items when ladder.maxItemsInProgress is reached', () => {
    const cfg = { ...CONFIG, ladder: { ...CONFIG.ladder, maxItemsInProgress: 2 } }
    const log = ['w_0', 'w_1'].flatMap(id => passes(id, 1, NOW - 2 * DAY))
    const session = buildSession(ladderInput(ids(5), { config: cfg, progress: makeProgress({ reviewLog: log }) }))
    expect(session.newItemIds).toEqual([])
  })

  it('continues an item from the stage derived from the log', () => {
    const log = passes('w_a', 2, NOW - DAY)
    const session = buildSession(ladderInput(['w_a'], { progress: makeProgress({ reviewLog: log }) }))
    expect(session.newItemIds).toEqual([])
    expect(exerciseKeys(session)).toEqual(['cloze-word:w_a', 'translate-nl-it:w_a'])
  })

  it('drops an item back after a wrong answer', () => {
    const log = [...passes('w_a', 2, NOW - DAY), makeEntry('cloze-word:w_a', NOW - DAY + 10, 'wrong')]
    const session = buildSession(ladderInput(['w_a'], { progress: makeProgress({ reviewLog: log }) }))
    expect(exerciseKeys(session)).toEqual(['mc-word:w_a', 'cloze-word:w_a'])
  })

  it('skips an item that already climbed maxStepsPerItemPerDay stages today', () => {
    const log = passes('w_a', 2, NOW - 1000)
    const session = buildSession(ladderInput(['w_a'], { progress: makeProgress({ reviewLog: log }) }))
    expect(exerciseKeys(session)).toEqual([])
  })

  it('mixes items on different stages in one session', () => {
    const log = [...passes('w_a', 2, NOW - DAY), ...passes('w_b', 1, NOW - DAY)]
    const keys = exerciseKeys(buildSession(ladderInput(['w_a', 'w_b', 'w_c'], { progress: makeProgress({ reviewLog: log }) })))
    expect(keys).toEqual(expect.arrayContaining(['cloze-word:w_a', 'mc-word:w_b', 'mc-sentence:w_c']))
  })

  it('keeps review cards of an unfinished item out of the session', () => {
    const log = passes('w_a', 1, NOW - DAY)
    const session = buildSession(ladderInput(['w_a'], { progress: makeProgress({ reviewLog: log }) }))
    expect(exerciseKeys(session)).not.toContain('translate-it-nl:w_a')
  })

  it('releases review cards once the item has finished the ladder', () => {
    const log = passes('w_a', 4, NOW - 3 * DAY)
    const session = buildSession(ladderInput(['w_a'], { progress: makeProgress({ reviewLog: log }) }))
    expect(exerciseKeys(session)).toContain('translate-it-nl:w_a')
    expect(session.ladderStages).not.toHaveProperty('w_a')
  })

  it('uses cardRequires to gate cards on several items', () => {
    const log = passes('w_a', 4, NOW - 3 * DAY)
    const dictation = 'dictation:s_1'
    const session = buildSession(ladderInput(['w_a', 'w_b'], {
      allCardKeys: [dictation],
      cardRequires: new Map([[dictation, ['w_a', 'w_b']]]),
      progress: makeProgress({ reviewLog: log }),
    }))
    expect(exerciseKeys(session)).not.toContain(dictation)
  })

  it('never uses excluded types as review cards', () => {
    const session = buildSession(makeInput({
      allCardKeys: ['flashcard:w_a', 'translate-it-nl:w_a'],
      progress: makeProgress({ cards: { 'flashcard:w_a': makeCard(NOW - DAY), 'translate-it-nl:w_a': makeCard(NOW - DAY) } }),
    }))
    expect(exerciseKeys(session)).toEqual(['translate-it-nl:w_a'])
  })

  it('adds no new items on a return after a pause', () => {
    const log = [makeEntry('translate-it-nl:w_old', NOW - 8 * DAY)]
    const session = buildSession(ladderInput(['w_a'], { progress: makeProgress({ reviewLog: log }) }))
    expect(session.isReturn).toBe(true)
    expect(session.newItemIds).toEqual([])
  })

  it('reserves ladder.reviewShare of the session for due reviews', () => {
    const items = ids(15)
    const log = items.flatMap(id => passes(id, 1, NOW - DAY))
    const dueKeys = Array.from({ length: 20 }, (_, i) => `article:w_old_${i}`)
    const cards = Object.fromEntries(dueKeys.map(k => [k, makeCard(NOW - DAY)]))
    const session = buildSession(ladderInput(items, {
      allCardKeys: dueKeys,
      progress: makeProgress({ reviewLog: log, cards }),
    }))
    const keys = exerciseKeys(session)
    expect(keys).toHaveLength(CONFIG.session.maxReviewsPerSession)
    expect(keys.filter(k => k.startsWith('article:')).length).toBeGreaterThanOrEqual(12)
  })

  it('keeps ladder.minGapSameItem cards between two stages of one item', () => {
    const dueKeys = Array.from({ length: 6 }, (_, i) => `article:w_old_${i}`)
    const cards = Object.fromEntries(dueKeys.map(k => [k, makeCard(NOW - DAY)]))
    for (let seed = 0; seed < 30; seed++) {
      const keys = exerciseKeys(buildSession(ladderInput(['w_a', 'w_b', 'w_c'], {
        allCardKeys: dueKeys,
        progress: makeProgress({ cards }),
        seed,
      })))
      for (const id of ['w_a', 'w_b', 'w_c']) {
        const gap = keys.indexOf(`mc-word:${id}`) - keys.indexOf(`mc-sentence:${id}`) - 1
        expect(gap).toBeGreaterThanOrEqual(CONFIG.ladder.minGapSameItem)
      }
    }
  })
})

// ─── Random order ────────────────────────────────────────────────────────────

describe('random order', () => {
  const dueKeys = Array.from({ length: 12 }, (_, i) => `${i % 2 ? 'article' : 'translate-it-nl'}:w_${i}`)
  const cards = Object.fromEntries(dueKeys.map(k => [k, makeCard(NOW - DAY)]))
  const input = (seed: number) => makeInput({ allCardKeys: dueKeys, progress: makeProgress({ cards }), seed })

  it('is the same for the same seed', () => {
    expect(exerciseKeys(buildSession(input(7)))).toEqual(exerciseKeys(buildSession(input(7))))
  })

  it('differs between seeds', () => {
    const orders = new Set([1, 2, 3, 4, 5].map(seed => exerciseKeys(buildSession(input(seed))).join()))
    expect(orders.size).toBeGreaterThan(1)
  })
})

describe('scheduleChains() properties', () => {
  it('outputs every item exactly once and keeps each chain in order, for many random inputs', () => {
    const types = ['article', 'translate-it-nl', 'cloze-word', 'mc-word']
    for (let seed = 0; seed < 200; seed++) {
      const rand = seededRandom(seed)
      const chains: SessionItem[][] = []
      const count = 1 + Math.floor(rand() * 12)
      for (let c = 0; c < count; c++) {
        const id = `w_${c}`
        const len = 1 + Math.floor(rand() * 3)
        const chain: SessionItem[] = rand() < 0.4 ? [{ kind: 'intro', itemId: id }] : []
        for (let i = 0; i < len; i++) chain.push({ kind: 'exercise', cardKey: `${types[Math.floor(rand() * types.length)]}:${id}:${i}`, isNew: false })
        chains.push(chain)
      }
      const out = scheduleChains(chains, seededRandom(seed + 1000), 2, 3)
      const all = chains.flat()
      expect(out).toHaveLength(all.length)
      expect(new Set(out)).toEqual(new Set(all))
      for (const chain of chains) {
        const positions = chain.map(item => out.indexOf(item))
        expect([...positions].sort((a, b) => a - b)).toEqual(positions)
      }
    }
  })
})

describe('unit practice with the ladder', () => {
  it('fills the target budget and adds at most the needed share of other-unit material', () => {
    const items = ids(15)
    const log = items.flatMap(id => passes(id, 1, NOW - DAY))
    const otherKeys = Array.from({ length: 20 }, (_, i) => `article:w_other_${i}`)
    const cards = Object.fromEntries(otherKeys.map(k => [k, makeCard(NOW - DAY)]))
    const input = ladderInput(items, { allCardKeys: otherKeys, progress: makeProgress({ reviewLog: log, cards }), targetUnitId: 'u01' })
    const cardToUnit = new Map(input.allCardKeys.map(k => [k, k.includes('w_other') ? 'u00' : 'u01'] as [string, string]))
    const keys = exerciseKeys(buildSession({ ...input, cardToUnit }))
    const other = keys.filter(k => cardToUnit.get(k) === 'u00').length
    expect(keys.length).toBeLessThanOrEqual(CONFIG.session.maxReviewsPerSession)
    expect(keys.length - other).toBe(Math.floor(CONFIG.session.maxReviewsPerSession * (1 - CONFIG.session.minOldMaterialRatio)))
    expect(other / keys.length).toBeGreaterThanOrEqual(CONFIG.session.minOldMaterialRatio - 0.01)
  })
})

describe('scheduleChains()', () => {
  it('keeps the order within a chain', () => {
    const chain: SessionItem[] = [
      { kind: 'intro', itemId: 'w_a' },
      { kind: 'exercise', cardKey: 'mc-sentence:w_a', isNew: true },
      { kind: 'exercise', cardKey: 'mc-word:w_a', isNew: true },
    ]
    const others: SessionItem[][] = ids(4).map(id => [{ kind: 'exercise', cardKey: `article:${id}`, isNew: false }])
    const out = scheduleChains([chain, ...others], seededRandom(3), 2, 3)
    const positions = chain.map(c => out.indexOf(c))
    expect(positions[1]).toBe(positions[0] + 1)
    expect(positions[2]).toBeGreaterThan(positions[1])
    expect(out).toHaveLength(7)
  })
})

// ─── replanAfterWrong ────────────────────────────────────────────────────────

describe('replanAfterWrong()', () => {
  const stages = { w_a: STAGES.map(t => `${t}:w_a`) }
  const ex = (cardKey: string): SessionItem => ({ kind: 'exercise', cardKey, isNew: false })
  const queue = [ex('mc-word:w_a'), ex('article:w_1'), ex('cloze-word:w_a'), ex('article:w_2'), ex('article:w_3'), ex('article:w_4')]

  it('removes later stages of the item and brings the lower stage back', () => {
    const next = replanAfterWrong(queue, 0, 'mc-word:w_a', stages, CONFIG)
    const keys = next.map(i => (i as { cardKey: string }).cardKey)
    expect(keys).not.toContain('cloze-word:w_a')
    expect(keys.indexOf('mc-sentence:w_a')).toBe(4)
  })

  it('reinserts the same card for a card that is not on the ladder', () => {
    const next = replanAfterWrong(queue, 1, 'article:w_1', stages, CONFIG)
    const keys = next.map(i => (i as { cardKey: string }).cardKey)
    expect(keys.filter(k => k === 'article:w_1')).toHaveLength(2)
    expect(keys).toContain('cloze-word:w_a')
  })

  it('never puts the reinserted card between an intro and its first question', () => {
    const withIntro: SessionItem[] = [
      ex('article:w_1'), ex('article:w_2'), ex('article:w_3'),
      { kind: 'intro', itemId: 'w_b' }, ex('mc-sentence:w_b'), ex('article:w_4'),
    ]
    const next = replanAfterWrong(withIntro, 0, 'article:w_1', stages, CONFIG)
    const introAt = next.findIndex(i => i.kind === 'intro')
    expect(next[introAt + 1]).toMatchObject({ cardKey: 'mc-sentence:w_b' })
  })

  it('always reinserts after the current card, even with reinsertAfterCards 0', () => {
    const cfg = { ...CONFIG, lapse: { ...CONFIG.lapse, reinsertAfterCards: 0 } }
    const next = replanAfterWrong(queue, 1, 'article:w_1', stages, cfg)
    expect(next[1]).toBe(queue[1])
    expect(next[2]).toMatchObject({ cardKey: 'article:w_1' })
  })

  it('does not reinsert when lapse.reinsertInSession is off', () => {
    const cfg = { ...CONFIG, lapse: { ...CONFIG.lapse, reinsertInSession: false } }
    const next = replanAfterWrong(queue, 0, 'mc-word:w_a', stages, cfg)
    expect(next.map(i => (i as { cardKey: string }).cardKey)).not.toContain('mc-sentence:w_a')
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

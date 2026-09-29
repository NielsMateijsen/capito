import { describe, it, expect } from 'vitest'
import {
  buildLesson,
  buildRefresh,
  isLeech,
  gradeFromResult,
  lapseReinsertAt,
  replanAfterWrong,
  scheduleChains,
  type LessonInput,
  type SessionBuilderConfig,
  type SessionItem,
} from '../../src/engine/session-builder.ts'
import { seededRandom } from '../../src/engine/distractors.ts'
import type { LadderItem } from '../../src/engine/ladder.ts'
import type { Lesson } from '../../src/engine/lessons.ts'
import type { ProgressState } from '../../src/storage/types.ts'
import type { CardState } from '../../src/engine/srs.ts'
import type { ReviewEntry } from '../../src/engine/review-log.ts'
import { rebuildCards } from '../../src/engine/review-log.ts'

const NOW = 1_700_000_000_000
const DAY = 86_400_000

const STAGES = ['mc-sentence', 'mc-word', 'cloze-word', 'translate-nl-it']

const CONFIG: SessionBuilderConfig = {
  session: { maxSameTypeInRow: 3, excludedTypes: ['flashcard', 'mc-sentence', 'mc-word'], timeZone: 'UTC' },
  lesson: {
    itemsPerLesson: 3,
    minItemsPerLesson: 1,
    maxItemsPerLesson: 8,
    maxStepsPerItemPerLesson: 2,
    maxFinishItemsPerLesson: 6,
    maxReviewsPerLesson: 4,
    newReviewCardsPerLesson: 2,
  },
  refresh: { maxCards: 15, prominentAboveDueItems: 10 },
  lapse: { retypeCorrectAnswer: true, reinsertInSession: true, reinsertAfterCards: 4 },
  leech: { lapseThreshold: 6, showExtraContext: true },
  grading: { correct: 4, almost: 3, hintUsed: 3, wrong: 1, flashcard: { again: 1, good: 4, easy: 5 } },
  ladder: {
    stages: STAGES,
    passResults: ['correct', 'good', 'easy'],
    dropOnWrong: 1,
    minGapSameItem: 2,
    optionCount: 4,
    minSentencesPerItem: 3,
    introAutoplay: true,
  },
  exam: { passThreshold: 0.8, passResults: ['correct', 'almost'] },
}

function ladderItem(itemId: string): LadderItem {
  return { itemId, stageKeys: STAGES.map(t => `${t}:${itemId}`) }
}

function makeCard(due: number, lapses = 0): CardState {
  return { ease: 2.5, interval: 1, due, reps: 1, lapses }
}

function makeProgress(overrides: Partial<ProgressState> = {}): ProgressState {
  return {
    schema: 3,
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

function makeEntry(key: string, t: number, result: ReviewEntry['result'] = 'correct', lesson = 'u01#1'): ReviewEntry {
  return {
    t: new Date(t).toISOString(),
    key,
    result,
    grade: result === 'wrong' ? 1 : 4,
    ms: 1000,
    hint: false,
    session: 'test-session',
    mode: 'lesson',
    cv: 'abc12345',
    lesson,
  }
}

function ids(n: number, prefix = 'w'): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}_${i}`)
}

function lesson(items: string[], final = false): Lesson {
  return { id: final ? 'u01#final' : 'u01#2', unitId: 'u01', number: 2, items, final }
}

/** All ladder items get their stage cards and a translate-it-nl review card. */
function lessonInput(itemIds: string[], lessonItems: string[], overrides: Partial<LessonInput> = {}): LessonInput {
  const items = itemIds.map(ladderItem)
  const { allCardKeys: extra = [], ...rest } = overrides
  return {
    now: NOW,
    seed: 1,
    allCardKeys: [...items.flatMap(i => i.stageKeys), ...itemIds.map(id => `translate-it-nl:${id}`), ...extra],
    progress: makeProgress(),
    config: CONFIG,
    ladderItems: items,
    lesson: lesson(lessonItems),
    ...rest,
  }
}

function passes(itemId: string, stageCount: number, t: number, from = 0): ReviewEntry[] {
  return STAGES.slice(from, from + stageCount).map((type, i) => makeEntry(`${type}:${itemId}`, t + i))
}

function exerciseKeys(session: { queue: SessionItem[] }): string[] {
  return session.queue.flatMap(item => (item.kind === 'exercise' ? [item.cardKey] : []))
}

function cardType(key: string): string {
  return key.split(':')[0]
}

function longestRun(keys: string[]): number {
  let best = 0
  let run = 0
  for (let i = 0; i < keys.length; i++) {
    run = i > 0 && cardType(keys[i]) === cardType(keys[i - 1]) ? run + 1 : 1
    best = Math.max(best, run)
  }
  return best
}

// ─── buildLesson: new items ──────────────────────────────────────────────────

describe('buildLesson(): new items', () => {
  it('introduces each new item and gives it the first maxStepsPerItemPerLesson stages', () => {
    const keys = exerciseKeys(buildLesson(lessonInput(['w_a'], ['w_a'])))
    expect(keys).toEqual(['mc-sentence:w_a', 'mc-word:w_a'])
  })

  it('puts the intro of a new item directly before its first stage', () => {
    for (let seed = 0; seed < 20; seed++) {
      const session = buildLesson(lessonInput(['w_a', 'w_b', 'w_c'], ['w_a', 'w_b', 'w_c'], { seed }))
      session.queue.forEach((item, i) => {
        if (item.kind !== 'intro') return
        expect(session.queue[i + 1]).toMatchObject({ kind: 'exercise', cardKey: `mc-sentence:${item.itemId}` })
      })
    }
  })

  it('introduces the items in lesson order, whatever the seed', () => {
    for (let seed = 0; seed < 30; seed++) {
      const session = buildLesson(lessonInput(ids(3), ids(3), { seed }))
      expect(session.newItemIds).toEqual(ids(3))
    }
  })

  it('asks every new item once before any new item gets its second stage, so a lesson left halfway keeps all its items', () => {
    const log = passes('w_x', 2, NOW - DAY)
    for (let seed = 0; seed < 50; seed++) {
      const keys = exerciseKeys(buildLesson(lessonInput(['w_x', ...ids(3)], ids(3), { seed, progress: makeProgress({ reviewLog: log }) })))
      const lastFirst = Math.max(...ids(3).map(id => keys.indexOf(`mc-sentence:${id}`)))
      const firstSecond = Math.min(...ids(3).map(id => keys.indexOf(`mc-word:${id}`)))
      expect(firstSecond).toBeGreaterThan(lastFirst)
    }
  })

  it('keeps ladder.minGapSameItem cards between two stages of one item', () => {
    for (let seed = 0; seed < 30; seed++) {
      const keys = exerciseKeys(buildLesson(lessonInput(ids(3), ids(3), { seed })))
      for (const id of ids(3)) {
        const gap = keys.indexOf(`mc-word:${id}`) - keys.indexOf(`mc-sentence:${id}`) - 1
        expect(gap).toBeGreaterThanOrEqual(CONFIG.ladder.minGapSameItem)
      }
    }
  })

  it('never lets an item of the lesson climb past the lesson target, also when resumed', () => {
    const log = passes('w_a', 1, NOW - 1000)
    const session = buildLesson(lessonInput(['w_a', 'w_b'], ['w_a', 'w_b'], { progress: makeProgress({ reviewLog: log }) }))
    const keys = exerciseKeys(session)
    expect(keys.filter(k => k.endsWith(':w_a'))).toEqual(['mc-word:w_a'])
    expect(session.newItemIds).toEqual(['w_b'])
  })

  it('has nothing left for an item that already reached the target', () => {
    const log = passes('w_a', 2, NOW - 1000)
    expect(exerciseKeys(buildLesson(lessonInput(['w_a'], ['w_a'], { progress: makeProgress({ reviewLog: log }) })))).toEqual([])
  })

  it('has no limit on the number of answers', () => {
    expect(buildLesson(lessonInput(['w_a'], ['w_a'])).maxReviews).toBe(Number.POSITIVE_INFINITY)
  })
})

// ─── buildLesson: unfinished items ───────────────────────────────────────────

describe('buildLesson(): unfinished items from earlier lessons', () => {
  it('gives them their next maxStepsPerItemPerLesson stages', () => {
    const log = passes('w_a', 2, NOW - DAY)
    const keys = exerciseKeys(buildLesson(lessonInput(['w_a', 'w_b'], ['w_b'], { progress: makeProgress({ reviewLog: log }) })))
    expect(keys).toEqual(expect.arrayContaining(['cloze-word:w_a', 'translate-nl-it:w_a', 'mc-sentence:w_b', 'mc-word:w_b']))
  })

  it('continues from the stage derived from the log after a drop', () => {
    const log = [...passes('w_a', 2, NOW - DAY), makeEntry('cloze-word:w_a', NOW - DAY + 10, 'wrong')]
    const keys = exerciseKeys(buildLesson(lessonInput(['w_a'], [], { progress: makeProgress({ reviewLog: log }) })))
    expect(keys).toEqual(['mc-word:w_a', 'cloze-word:w_a'])
  })

  it('takes at most maxFinishItemsPerLesson of them, the longest unseen first', () => {
    const items = ids(8)
    const log = items.flatMap((id, i) => passes(id, 2, NOW - 10 * DAY + i * DAY))
    const cfg = { ...CONFIG, lesson: { ...CONFIG.lesson, maxFinishItemsPerLesson: 2 } }
    const keys = exerciseKeys(buildLesson(lessonInput(items, [], { config: cfg, progress: makeProgress({ reviewLog: log }) })))
    expect(new Set(keys.map(k => k.split(':')[1]))).toEqual(new Set(['w_0', 'w_1']))
  })

  it('finishes items of the lesson\'s own unit first', () => {
    // w_own was seen last, so by time alone it would be cut off
    const log = [...passes('w_other', 2, NOW - 3 * DAY), ...passes('w_own', 2, NOW - DAY)]
    const cfg = { ...CONFIG, lesson: { ...CONFIG.lesson, maxFinishItemsPerLesson: 1 } }
    const input = {
      ...lessonInput(['w_other', 'w_own'], [], { config: cfg, progress: makeProgress({ reviewLog: log }) }),
      lesson: lesson([], true),
      unitItems: ['w_own'],
    }
    expect(new Set(exerciseKeys(buildLesson(input)).map(k => k.split(':')[1]))).toEqual(new Set(['w_own']))
  })

  it('makes the final lesson finish the remaining stages without new items', () => {
    const log = [...passes('w_a', 2, NOW - DAY), ...passes('w_b', 3, NOW - DAY)]
    const input = { ...lessonInput(['w_a', 'w_b'], []), progress: makeProgress({ reviewLog: log }), lesson: lesson([], true) }
    const session = buildLesson(input)
    expect(exerciseKeys(session).sort()).toEqual(['cloze-word:w_a', 'translate-nl-it:w_a', 'translate-nl-it:w_b'])
    expect(session.newItemIds).toEqual([])
  })
})

// ─── buildLesson: reviews ────────────────────────────────────────────────────

describe('buildLesson(): review cards', () => {
  const dueKeys = Array.from({ length: 8 }, (_, i) => `article:w_old_${i}`)
  const cards = Object.fromEntries(dueKeys.map((k, i) => [k, makeCard(NOW - (i + 1) * DAY)]))

  it('adds at most maxReviewsPerLesson due cards, the most overdue first', () => {
    const keys = exerciseKeys(buildLesson(lessonInput(['w_a'], ['w_a'], { allCardKeys: dueKeys, progress: makeProgress({ cards }) })))
    expect(keys.filter(k => k.startsWith('article:')).sort()).toEqual(dueKeys.slice(4).sort())
  })

  it('leaves cards that are not due out', () => {
    const later = { 'article:w_old_0': makeCard(NOW + DAY) }
    const keys = exerciseKeys(buildLesson(lessonInput(['w_a'], ['w_a'], { allCardKeys: ['article:w_old_0'], progress: makeProgress({ cards: later }) })))
    expect(keys).not.toContain('article:w_old_0')
  })

  it('adds at most newReviewCardsPerLesson cards never answered, of items that finished the ladder', () => {
    const log = ids(4).flatMap((id, i) => passes(id, 4, NOW - 5 * DAY + i * 10))
    const cards = Object.fromEntries(rebuildCards(log, { startEase: 2.5, minEase: 1.3, maxIntervalDays: 180 }))
    const input = lessonInput(ids(5), ['w_4'], { now: NOW - 5 * DAY + 100, progress: makeProgress({ reviewLog: log, cards }) })
    const keys = exerciseKeys(buildLesson(input))
    expect(keys.filter(k => k.startsWith('translate-it-nl:'))).toHaveLength(CONFIG.lesson.newReviewCardsPerLesson)
    expect(keys).not.toContain('translate-it-nl:w_4')
  })

  it('keeps review cards of an unfinished item out', () => {
    const log = passes('w_a', 3, NOW - DAY)
    const keys = exerciseKeys(buildLesson(lessonInput(['w_a'], [], { progress: makeProgress({ reviewLog: log }) })))
    expect(keys).not.toContain('translate-it-nl:w_a')
  })

  it('uses cardRequires to gate cards on several items', () => {
    const log = passes('w_a', 4, NOW - 3 * DAY)
    const dictation = 'dictation:s_1'
    const keys = exerciseKeys(buildLesson(lessonInput(['w_a', 'w_b'], [], {
      allCardKeys: [dictation],
      cardRequires: new Map([[dictation, ['w_a', 'w_b']]]),
      progress: makeProgress({ reviewLog: log }),
    })))
    expect(keys).not.toContain(dictation)
  })

  it('never uses excluded types as review cards', () => {
    const due = { 'flashcard:w_z': makeCard(NOW - DAY), 'translate-it-nl:w_z': makeCard(NOW - DAY) }
    const keys = exerciseKeys(buildLesson(lessonInput([], [], {
      allCardKeys: ['flashcard:w_z', 'translate-it-nl:w_z'],
      progress: makeProgress({ cards: due }),
    })))
    expect(keys).toEqual(['translate-it-nl:w_z'])
  })

  it('ignores cards in progress that are not in allCardKeys', () => {
    const ghost = { 'translate-it-nl:w_ghost': makeCard(NOW - DAY) }
    expect(exerciseKeys(buildLesson(lessonInput([], [], { progress: makeProgress({ cards: ghost }) })))).toEqual([])
  })
})

// ─── buildLesson: order ──────────────────────────────────────────────────────

describe('buildLesson(): order', () => {
  const dueKeys = Array.from({ length: 4 }, (_, i) => `translate-it-nl:w_old_${i}`)
  const cards = Object.fromEntries([...dueKeys, 'article:w_old_0'].map(k => [k, makeCard(NOW - DAY)]))
  const input = (seed: number) => lessonInput(['w_a'], ['w_a'], {
    allCardKeys: [...dueKeys, 'article:w_old_0'],
    progress: makeProgress({ cards }),
    seed,
    config: { ...CONFIG, lesson: { ...CONFIG.lesson, maxReviewsPerLesson: 5 } },
  })

  it('is the same for the same seed and differs between seeds', () => {
    expect(exerciseKeys(buildLesson(input(7)))).toEqual(exerciseKeys(buildLesson(input(7))))
    const orders = new Set([1, 2, 3, 4, 5].map(seed => exerciseKeys(buildLesson(input(seed))).join()))
    expect(orders.size).toBeGreaterThan(1)
  })

  it('never puts more than maxSameTypeInRow cards of one type in a row when that is possible', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(longestRun(exerciseKeys(buildLesson(input(seed))))).toBeLessThanOrEqual(CONFIG.session.maxSameTypeInRow)
    }
  })

  it('reports the stages of every unfinished item for replanning', () => {
    const log = passes('w_b', 4, NOW - DAY)
    const session = buildLesson(lessonInput(['w_a', 'w_b'], ['w_a'], { progress: makeProgress({ reviewLog: log }) }))
    expect(session.ladderStages).toHaveProperty('w_a')
    expect(session.ladderStages).not.toHaveProperty('w_b')
  })
})

// ─── buildRefresh ────────────────────────────────────────────────────────────

describe('buildRefresh()', () => {
  const base = { now: NOW, seed: 1, config: CONFIG, ladderItems: [] as LadderItem[] }

  it('takes the due cards, the most overdue first, up to refresh.maxCards', () => {
    const keys = Array.from({ length: 20 }, (_, i) => `article:w_${i}`)
    const cards = Object.fromEntries(keys.map((k, i) => [k, makeCard(NOW - (i + 1) * DAY)]))
    const session = buildRefresh({ ...base, allCardKeys: keys, progress: makeProgress({ cards }) })
    expect(exerciseKeys(session).sort()).toEqual(keys.slice(5).sort())
  })

  it('adds leeches that are not due, then cards never answered', () => {
    const cards = {
      'article:w_due': makeCard(NOW - DAY),
      'article:w_leech': makeCard(NOW + 5 * DAY, CONFIG.leech.lapseThreshold),
      'article:w_later': makeCard(NOW + 5 * DAY),
    }
    const all = [...Object.keys(cards), 'article:w_new']
    const keys = exerciseKeys(buildRefresh({ ...base, allCardKeys: all, progress: makeProgress({ cards }) }))
    expect(keys.sort()).toEqual(['article:w_due', 'article:w_leech', 'article:w_new'])
  })

  it('brings a missed card back as it is instead of walking down the ladder', () => {
    const item = ladderItem('w_a')
    const session = buildRefresh({ ...base, ladderItems: [item], allCardKeys: item.stageKeys, progress: makeProgress(), onlyKeys: ['translate-nl-it:w_a'] })
    expect(session.ladderStages).toEqual({})
    const next = replanAfterWrong(session.queue, 0, 'translate-nl-it:w_a', session.ladderStages, CONFIG)
    expect(exerciseKeys({ queue: next })).toEqual(['translate-nl-it:w_a', 'translate-nl-it:w_a'])
  })

  it('practises exactly the given cards with onlyKeys', () => {
    const only = ['translate-nl-it:w_a', 'translate-nl-it:w_b', 'translate-nl-it:w_a']
    const keys = exerciseKeys(buildRefresh({ ...base, allCardKeys: [], progress: makeProgress(), onlyKeys: only }))
    expect(keys.sort()).toEqual(['translate-nl-it:w_a', 'translate-nl-it:w_b'])
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

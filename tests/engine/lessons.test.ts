import { describe, it, expect } from 'vitest'
import { computeLadder } from '../../src/engine/ladder.ts'
import type { LadderItem } from '../../src/engine/ladder.ts'
import { isLessonDone, isPerfectRun, lessonDoneAt, lessonId, planLessons, unitPath } from '../../src/engine/lessons.ts'
import type { ReviewEntry } from '../../src/engine/review-log.ts'

const NOW = 1_700_000_000_000
const STAGES = ['mc-sentence', 'mc-word', 'cloze-word', 'translate-nl-it']
const LADDER = { dropOnWrong: 1, passResults: ['correct', 'good', 'easy'] }
const EXAM = { passThreshold: 0.8, passResults: ['correct', 'almost'] }
const CFG = { itemsPerLesson: 3, maxStepsPerItemPerLesson: 2 }
const UNIT = 'u01'

function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `w_${i}`)
}

function items(itemIds: string[]): LadderItem[] {
  return itemIds.map(itemId => ({ itemId, stageKeys: STAGES.map(s => `${s}:${itemId}`) }))
}

let clock = NOW
function entry(key: string, extra: Partial<ReviewEntry> = {}): ReviewEntry {
  clock += 1000
  return { t: new Date(clock).toISOString(), key, result: 'correct', grade: 4, ms: 1, hint: false, session: 's', mode: 'lesson', cv: 'x', ...extra }
}

/** Passes `steps` stages of an item in the given lesson. */
function climb(itemId: string, steps: number, lesson: string, from = 0): ReviewEntry[] {
  return STAGES.slice(from, from + steps).map(s => entry(`${s}:${itemId}`, { lesson }))
}

function ladderFor(unitItems: string[], log: ReviewEntry[]) {
  return computeLadder(log, items(unitItems), LADDER, EXAM)
}

describe('planLessons()', () => {
  it('splits a fresh unit into lessons of itemsPerLesson, plus a final lesson', () => {
    const unitItems = ids(10)
    const lessons = planLessons(UNIT, unitItems, ladderFor(unitItems, []), CFG)
    expect(lessons.map(l => l.items)).toEqual([
      ['w_0', 'w_1', 'w_2'], ['w_3', 'w_4', 'w_5'], ['w_6', 'w_7', 'w_8'], ['w_9'], [],
    ])
    expect(lessons.map(l => l.id)).toEqual(['u01#1', 'u01#2', 'u01#3', 'u01#4', 'u01#final'])
    expect(lessons.at(-1)).toMatchObject({ final: true, number: 5 })
  })

  it('has no lessons for a unit without items', () => {
    expect(planLessons(UNIT, [], new Map(), CFG)).toEqual([])
  })

  it('keeps a begun lesson as it is when content is added in front', () => {
    const before = ids(6)
    const log = ['w_0', 'w_1', 'w_2'].flatMap(id => climb(id, 2, lessonId(UNIT, 1)))
    const after = ['w_new', ...before]
    const lessons = planLessons(UNIT, after, ladderFor(after, log), CFG)
    expect(lessons[0].items).toEqual(['w_0', 'w_1', 'w_2'])
    expect(lessons[1].items).toEqual(['w_new', 'w_3', 'w_4'])
  })

  it('keeps done lessons when itemsPerLesson changes', () => {
    const unitItems = ids(9)
    const log = ['w_0', 'w_1', 'w_2'].flatMap(id => climb(id, 2, lessonId(UNIT, 1)))
    const lessons = planLessons(UNIT, unitItems, ladderFor(unitItems, log), { ...CFG, itemsPerLesson: 5 })
    expect(lessons.map(l => l.items)).toEqual([['w_0', 'w_1', 'w_2'], ['w_3', 'w_4', 'w_5', 'w_6', 'w_7'], ['w_8'], []])
  })

  it('tops up a begun lesson that is not done yet', () => {
    const unitItems = ids(6)
    const log = climb('w_0', 1, lessonId(UNIT, 1))
    const lessons = planLessons(UNIT, unitItems, ladderFor(unitItems, log), CFG)
    expect(lessons[0].items).toEqual(['w_0', 'w_1', 'w_2'])
  })

  it('skips items learned by a test-out', () => {
    const unitItems = ids(4)
    const log = ['w_0', 'w_2'].map(id => entry(`translate-nl-it:${id}`, { mode: 'exam', session: 'e', unit: UNIT, examSize: 2 }))
    const lessons = planLessons(UNIT, unitItems, ladderFor(unitItems, log), CFG)
    expect(lessons.map(l => l.items)).toEqual([['w_1', 'w_3'], []])
  })
})

describe('lesson done', () => {
  const unitItems = ids(4)
  const first = { id: lessonId(UNIT, 1), unitId: UNIT, number: 1, items: ['w_0', 'w_1', 'w_2'], final: false }
  const final = { id: lessonId(UNIT, 'final'), unitId: UNIT, number: 3, items: [], final: true }

  it('is done when every item reached the lesson target', () => {
    const log = ['w_0', 'w_1', 'w_2'].flatMap(id => climb(id, 2, first.id))
    expect(isLessonDone(first, unitItems, ladderFor(unitItems, log), 2)).toBe(true)
  })

  it('is not done while an item is below the target', () => {
    const log = [...climb('w_0', 2, first.id), ...climb('w_1', 2, first.id), ...climb('w_2', 1, first.id)]
    expect(isLessonDone(first, unitItems, ladderFor(unitItems, log), 2)).toBe(false)
  })

  it('stays done after a later drop', () => {
    const log = [
      ...['w_0', 'w_1', 'w_2'].flatMap(id => climb(id, 2, first.id)),
      entry('cloze-word:w_0', { result: 'wrong', lesson: lessonId(UNIT, 2) }),
    ]
    expect(isLessonDone(first, unitItems, ladderFor(unitItems, log), 2)).toBe(true)
  })

  it('gives the time the last item reached the target', () => {
    const log = ['w_0', 'w_1', 'w_2'].flatMap(id => climb(id, 2, first.id))
    expect(lessonDoneAt(first, unitItems, ladderFor(unitItems, log), 2)).toBe(Date.parse(log.at(-1)!.t))
  })

  it('treats the final lesson as done only when every item of the unit graduated', () => {
    const almost = unitItems.flatMap(id => climb(id, 4, first.id)).slice(0, -1)
    expect(isLessonDone(final, unitItems, ladderFor(unitItems, almost), 2)).toBe(false)
    const all = unitItems.flatMap(id => climb(id, 4, first.id))
    expect(isLessonDone(final, unitItems, ladderFor(unitItems, all), 2)).toBe(true)
  })
})

describe('unitPath()', () => {
  it('opens only the first lesson that is not done', () => {
    const unitItems = ids(6)
    const log = ['w_0', 'w_1', 'w_2'].flatMap(id => climb(id, 2, lessonId(UNIT, 1)))
    const path = unitPath(UNIT, unitItems, ladderFor(unitItems, log), CFG)
    expect(path.lessons.map(s => [s.done, s.available])).toEqual([[true, true], [false, true], [false, false]])
    expect(path.doneCount).toBe(1)
    expect(path.current?.id).toBe(lessonId(UNIT, 2))
  })

  it('has no current lesson when all lessons are done', () => {
    const unitItems = ids(2)
    const log = unitItems.flatMap(id => climb(id, 4, lessonId(UNIT, 1)))
    expect(unitPath(UNIT, unitItems, ladderFor(unitItems, log), CFG).current).toBeUndefined()
  })
})

describe('isPerfectRun()', () => {
  it('is perfect without wrong answers and hints, also with an accent slip', () => {
    expect(isPerfectRun([entry('a:w_0'), entry('b:w_0', { result: 'almost' })])).toBe(true)
  })

  it('is not perfect with a wrong answer or a hint, or without answers', () => {
    expect(isPerfectRun([entry('a:w_0'), entry('b:w_0', { result: 'wrong' })])).toBe(false)
    expect(isPerfectRun([entry('a:w_0', { hint: true })])).toBe(false)
    expect(isPerfectRun([])).toBe(false)
  })
})

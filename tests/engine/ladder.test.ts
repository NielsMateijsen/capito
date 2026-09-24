import { describe, it, expect } from 'vitest'
import { computeLadder, isGraduated, isPass, ladderItems } from '../../src/engine/ladder.ts'
import type { ReviewEntry } from '../../src/engine/review-log.ts'

const NOW = 1_700_000_000_000
const DAY = 86_400_000
const STAGES = ['mc-sentence', 'mc-word', 'cloze-word', 'translate-nl-it']
const CONFIG = { dropOnWrong: 1 }

function entry(key: string, t: number, result: ReviewEntry['result'] = 'correct'): ReviewEntry {
  return { t: new Date(t).toISOString(), key, result, grade: 4, ms: 1, hint: false, session: 's', mode: 'daily', cv: 'x' }
}

const item = { itemId: 'w_a', stageKeys: STAGES.map(s => `${s}:w_a`) }

describe('ladderItems()', () => {
  it('keeps only stages that exist as cards, in stage order', () => {
    const items = ladderItems(['v_a', 'w_a'], STAGES, ['cloze-word:v_a', 'mc-sentence:v_a', ...item.stageKeys])
    expect(items).toEqual([
      { itemId: 'v_a', stageKeys: ['mc-sentence:v_a', 'cloze-word:v_a'] },
      item,
    ])
  })

  it('drops items without any stage card', () => {
    expect(ladderItems(['w_x'], STAGES, [])).toEqual([])
  })
})

describe('computeLadder()', () => {
  it('starts every item at level 0, not started', () => {
    const state = computeLadder([], [item], CONFIG, NOW).get('w_a')!
    expect(state).toMatchObject({ level: 0, started: false, graduated: false, stepsToday: 0 })
  })

  it('climbs one level per correct answer on the current stage', () => {
    const log = [entry('mc-sentence:w_a', NOW - DAY), entry('mc-word:w_a', NOW - DAY + 1)]
    expect(computeLadder(log, [item], CONFIG, NOW).get('w_a')).toMatchObject({ level: 2, started: true })
  })

  it('ignores a correct answer on a stage other than the current one', () => {
    const log = [entry('mc-word:w_a', NOW - DAY)]
    expect(computeLadder(log, [item], CONFIG, NOW).get('w_a')!.level).toBe(0)
  })

  it('drops dropOnWrong levels on a wrong answer, never below 0', () => {
    const log = [
      entry('mc-sentence:w_a', NOW - DAY),
      entry('mc-word:w_a', NOW - DAY + 1),
      entry('cloze-word:w_a', NOW - DAY + 2, 'wrong'),
    ]
    expect(computeLadder(log, [item], CONFIG, NOW).get('w_a')!.level).toBe(1)
    const log2 = [entry('mc-sentence:w_a', NOW - DAY, 'wrong')]
    expect(computeLadder(log2, [item], CONFIG, NOW).get('w_a')!.level).toBe(0)
  })

  it('graduates after the last stage and stays graduated', () => {
    const log = [
      ...item.stageKeys.map((k, i) => entry(k, NOW - 2 * DAY + i)),
      entry('cloze-word:w_a', NOW - DAY, 'wrong'),
    ]
    const ladder = computeLadder(log, [item], CONFIG, NOW)
    expect(ladder.get('w_a')).toMatchObject({ level: 4, graduated: true })
    expect(isGraduated(ladder, 'w_a')).toBe(true)
  })

  it('counts steps climbed today', () => {
    const log = [entry('mc-sentence:w_a', NOW - DAY), entry('mc-word:w_a', NOW - 1000)]
    expect(computeLadder(log, [item], CONFIG, NOW).get('w_a')!.stepsToday).toBe(1)
  })

  it('records first and last time seen', () => {
    const log = [entry('mc-sentence:w_a', NOW - DAY), entry('mc-word:w_a', NOW - 1000, 'wrong')]
    const state = computeLadder(log, [item], CONFIG, NOW).get('w_a')!
    expect(state.firstSeen).toBe(NOW - DAY)
    expect(state.lastSeen).toBe(NOW - 1000)
  })

  it('is the same when replayed from the log', () => {
    const log = [entry('mc-sentence:w_a', NOW - DAY), entry('mc-word:w_a', NOW - DAY + 1, 'wrong'), entry('mc-sentence:w_a', NOW - 10)]
    expect(computeLadder(log, [item], CONFIG, NOW)).toEqual(computeLadder([...log], [item], CONFIG, NOW))
  })
})

describe('isGraduated()', () => {
  it('treats items without a ladder as graduated', () => {
    expect(isGraduated(new Map(), 'w_none')).toBe(true)
  })
})

describe('isPass()', () => {
  it('passes correct, almost, good and easy', () => {
    expect(['correct', 'almost', 'good', 'easy'].every(r => isPass(r as ReviewEntry['result']))).toBe(true)
    expect(isPass('wrong')).toBe(false)
    expect(isPass('again')).toBe(false)
  })
})

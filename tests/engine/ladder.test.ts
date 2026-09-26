import { describe, it, expect } from 'vitest'
import { computeLadder, dayStartMs, isFail, isGraduated, ladderItems } from '../../src/engine/ladder.ts'
import type { ReviewEntry } from '../../src/engine/review-log.ts'

const NOW = 1_700_000_000_000
const DAY = 86_400_000
const STAGES = ['mc-sentence', 'mc-word', 'cloze-word', 'translate-nl-it']
const CONFIG = { dropOnWrong: 1, passResults: ['correct', 'good', 'easy'], timeZone: 'UTC' }

function entry(key: string, t: number, result: ReviewEntry['result'] = 'correct', mode: ReviewEntry['mode'] = 'daily'): ReviewEntry {
  return { t: new Date(t).toISOString(), key, result, grade: 4, ms: 1, hint: false, session: 's', mode, cv: 'x' }
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
    const log = [entry('mc-sentence:w_a', NOW - DAY), entry('cloze-word:w_a', NOW - DAY + 1)]
    expect(computeLadder(log, [item], CONFIG, NOW).get('w_a')!.level).toBe(1)
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

  it('neither climbs nor drops on an answer outside passResults that is not wrong', () => {
    const log = [entry('mc-sentence:w_a', NOW - DAY), entry('mc-word:w_a', NOW - DAY + 1, 'almost')]
    expect(computeLadder(log, [item], CONFIG, NOW).get('w_a')!.level).toBe(1)
  })

  it('ignores exam answers', () => {
    const log = [
      entry('mc-sentence:w_a', NOW - DAY),
      entry('translate-nl-it:w_a', NOW - DAY + 1, 'wrong', 'exam'),
      entry('mc-word:w_a', NOW - DAY + 2, 'correct', 'exam'),
    ]
    expect(computeLadder(log, [item], CONFIG, NOW).get('w_a')!.level).toBe(1)
  })

  it('treats an item practised before the ladder existed as graduated', () => {
    const log = [entry('translate-it-nl:w_a', NOW - 9 * DAY), entry('translate-nl-it:w_a', NOW - 8 * DAY, 'wrong')]
    expect(computeLadder(log, [item], CONFIG, NOW).get('w_a')).toMatchObject({ graduated: true, started: true })
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

  it('counts steps today by the configured time zone', () => {
    // 00:30 in Amsterdam is today there, but still yesterday in UTC
    const now = Date.parse('2026-09-27T08:00:00Z')
    const log = [entry('mc-sentence:w_a', Date.parse('2026-09-26T22:30:00Z'))]
    expect(computeLadder(log, [item], { ...CONFIG, timeZone: 'Europe/Amsterdam' }, now).get('w_a')!.stepsToday).toBe(1)
    expect(computeLadder(log, [item], { ...CONFIG, timeZone: 'UTC' }, now).get('w_a')!.stepsToday).toBe(0)
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

describe('dayStartMs()', () => {
  const TZ = 'Europe/Amsterdam'

  it('starts the day at local midnight in summer time', () => {
    // 00:30 on 27 Sept in Amsterdam (UTC+2)
    expect(dayStartMs(Date.parse('2026-09-26T22:30:00Z'), TZ)).toBe(Date.parse('2026-09-26T22:00:00Z'))
  })

  it('starts the day at local midnight in winter time', () => {
    // 00:30 on 16 Jan in Amsterdam (UTC+1)
    expect(dayStartMs(Date.parse('2026-01-15T23:30:00Z'), TZ)).toBe(Date.parse('2026-01-15T23:00:00Z'))
  })

  it('uses the offset at midnight on the day summer time starts', () => {
    // 29 March 2026: midnight is still UTC+1, noon is UTC+2
    expect(dayStartMs(Date.parse('2026-03-29T10:00:00Z'), TZ)).toBe(Date.parse('2026-03-28T23:00:00Z'))
  })

  it('works with UTC', () => {
    expect(dayStartMs(Date.parse('2026-09-26T22:30:00Z'), 'UTC')).toBe(Date.parse('2026-09-26T00:00:00Z'))
  })
})

describe('isGraduated()', () => {
  it('treats items without a ladder as graduated', () => {
    expect(isGraduated(new Map(), 'w_none')).toBe(true)
  })
})

describe('isFail()', () => {
  it('fails only wrong and again', () => {
    expect(isFail('wrong')).toBe(true)
    expect(isFail('again')).toBe(true)
    expect(['correct', 'almost', 'good', 'easy'].some(r => isFail(r as ReviewEntry['result']))).toBe(false)
  })
})

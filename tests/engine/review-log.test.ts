import { describe, it, expect } from 'vitest'
import { rebuildCards } from '../../src/engine/review-log.ts'
import { schedule } from '../../src/engine/srs.ts'
import type { ReviewEntry } from '../../src/engine/review-log.ts'
import type { SrsConfig } from '../../src/engine/srs.ts'

const cfg: SrsConfig = { startEase: 2.5, minEase: 1.3, maxIntervalDays: 180 }

const KEY = 'translate-nl-it:w_test'
const KEY2 = 'article:w_test2'

const t0 = '2026-01-01T10:00:00Z'
const t1 = '2026-01-02T10:00:00Z'
const t2 = '2026-01-08T10:00:00Z'
const t3 = '2026-01-09T10:00:00Z'

function entry(t: string, key: string, grade: number, result: ReviewEntry['result']): ReviewEntry {
  return { t, key, result, grade, ms: 1000, hint: false, session: 's1', mode: 'daily', cv: '1' }
}

const LOG: ReviewEntry[] = [
  entry(t0, KEY, 4, 'correct'),
  entry(t1, KEY, 3, 'almost'),
  entry(t2, KEY, 1, 'wrong'),
  entry(t3, KEY, 4, 'correct'),
]

describe('rebuildCards — kerntest: replay === live state', () => {
  it('four-step sequence matches step-by-step schedule() calls', () => {
    const s1 = schedule(null, 4, Date.parse(t0), cfg)
    const s2 = schedule(s1,   3, Date.parse(t1), cfg)
    const s3 = schedule(s2,   1, Date.parse(t2), cfg)
    const s4 = schedule(s3,   4, Date.parse(t3), cfg)

    const rebuilt = rebuildCards(LOG, cfg)
    expect(rebuilt.get(KEY)).toEqual(s4)
  })

  it('intermediate slice (2 entries) matches step-by-step state after step 2', () => {
    const s1 = schedule(null, 4, Date.parse(t0), cfg)
    const s2 = schedule(s1,   3, Date.parse(t1), cfg)

    const rebuilt = rebuildCards(LOG.slice(0, 2), cfg)
    expect(rebuilt.get(KEY)).toEqual(s2)
  })
})

describe('rebuildCards — edge cases', () => {
  it('empty log returns empty Map', () => {
    expect(rebuildCards([], cfg).size).toBe(0)
  })

  it('multiple cards tracked independently', () => {
    const log: ReviewEntry[] = [
      entry(t0, KEY,  4, 'correct'),
      entry(t1, KEY2, 1, 'wrong'),
      entry(t2, KEY,  4, 'correct'),
      entry(t3, KEY2, 4, 'correct'),
    ]

    const expectedKey  = schedule(schedule(null, 4, Date.parse(t0), cfg), 4, Date.parse(t2), cfg)
    const expectedKey2 = schedule(schedule(null, 1, Date.parse(t1), cfg), 4, Date.parse(t3), cfg)

    const rebuilt = rebuildCards(log, cfg)
    expect(rebuilt.get(KEY)).toEqual(expectedKey)
    expect(rebuilt.get(KEY2)).toEqual(expectedKey2)
  })

  it('single entry — new card, correct', () => {
    const log = [entry(t0, KEY, 4, 'correct')]
    const expected = schedule(null, 4, Date.parse(t0), cfg)
    expect(rebuildCards(log, cfg).get(KEY)).toEqual(expected)
  })
})

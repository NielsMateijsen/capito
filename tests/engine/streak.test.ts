import { describe, it, expect } from 'vitest'
import { activeDays, computeStreak } from '../../src/engine/streak.ts'
import { dayNumber } from '../../src/engine/calendar.ts'
import type { ReviewEntry } from '../../src/engine/review-log.ts'

const TZ = 'Europe/Amsterdam'
const DAY = 86_400_000
const NOW = Date.parse('2026-09-27T10:00:00Z')
const TODAY = dayNumber(NOW, TZ)

function refresh(session: string, t: number): ReviewEntry {
  return { t: new Date(t).toISOString(), key: 'article:w_a', result: 'correct', grade: 4, ms: 1, hint: false, session, mode: 'refresh', cv: 'x' }
}

describe('activeDays()', () => {
  const cfg = { minRefreshAnswers: 3, timeZone: TZ }

  it('counts days with a finished lesson or a complete exam', () => {
    const days = activeDays([], [NOW - 2 * DAY], [NOW], cfg)
    expect([...days].sort()).toEqual([TODAY - 2, TODAY])
  })

  it('counts a refresh session only with enough answers', () => {
    const short = [refresh('a', NOW - DAY), refresh('a', NOW - DAY + 1)]
    const long = [refresh('b', NOW), refresh('b', NOW + 1), refresh('b', NOW + 2)]
    expect([...activeDays([...short, ...long], [], [], cfg)]).toEqual([TODAY])
  })
})

describe('computeStreak()', () => {
  it('counts consecutive days up to today', () => {
    expect(computeStreak(new Set([TODAY - 2, TODAY - 1, TODAY]), NOW, TZ)).toEqual({ current: 3, longest: 3, today: true })
  })

  it('keeps the streak alive through yesterday while today is still open', () => {
    expect(computeStreak(new Set([TODAY - 2, TODAY - 1]), NOW, TZ)).toMatchObject({ current: 2, today: false })
  })

  it('drops to zero after a missed day, but keeps the longest run', () => {
    const days = new Set([TODAY - 10, TODAY - 9, TODAY - 8, TODAY - 7, TODAY - 3])
    expect(computeStreak(days, NOW, TZ)).toEqual({ current: 0, longest: 4, today: false })
  })

  it('is zero without any active day', () => {
    expect(computeStreak(new Set(), NOW, TZ)).toEqual({ current: 0, longest: 0, today: false })
  })
})

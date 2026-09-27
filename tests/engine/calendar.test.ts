import { describe, it, expect } from 'vitest'
import { dayNumber, dayStartMs } from '../../src/engine/calendar.ts'

const TZ = 'Europe/Amsterdam'

describe('dayStartMs()', () => {
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

describe('dayNumber()', () => {
  it('gives consecutive numbers to consecutive days', () => {
    const a = dayNumber(Date.parse('2026-09-26T12:00:00Z'), TZ)
    expect(dayNumber(Date.parse('2026-09-27T12:00:00Z'), TZ)).toBe(a + 1)
  })

  it('follows the calendar day in the time zone', () => {
    // 00:30 on 27 Sept in Amsterdam is still 26 Sept in UTC
    const t = Date.parse('2026-09-26T22:30:00Z')
    expect(dayNumber(t, TZ)).toBe(dayNumber(t, 'UTC') + 1)
  })

  it('counts a day across the switch to winter time as one day', () => {
    // 25 Oct 2026 has 25 hours in Amsterdam
    const morning = dayNumber(Date.parse('2026-10-24T22:30:00Z'), TZ)
    const evening = dayNumber(Date.parse('2026-10-25T22:30:00Z'), TZ)
    expect(evening - morning).toBe(0)
  })
})

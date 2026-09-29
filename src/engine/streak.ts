import type { ReviewEntry } from './review-log.ts'
import { dayNumber } from './calendar.ts'

export interface StreakConfig {
  minRefreshAnswers: number
}

export interface Streak {
  /** Days in a row up to today, or up to yesterday while today is still open. */
  current: number
  longest: number
  /** Today already counts. */
  today: boolean
}

/**
 * Days that count for the streak: a lesson was finished, a refresh session had at least
 * `minRefreshAnswers` answers, or an exam was answered completely.
 */
export function activeDays(
  log: ReviewEntry[],
  lessonDoneTimes: number[],
  examTimes: number[],
  config: StreakConfig & { timeZone: string },
): Set<number> {
  const days = new Set<number>()
  for (const t of [...lessonDoneTimes, ...examTimes]) days.add(dayNumber(t, config.timeZone))
  const refresh = new Map<string, { count: number; t: number }>()
  for (const entry of log) {
    if (entry.mode !== 'refresh') continue
    const s = refresh.get(entry.session) ?? { count: 0, t: 0 }
    s.count++
    s.t = Math.max(s.t, Date.parse(entry.t))
    refresh.set(entry.session, s)
  }
  for (const s of refresh.values()) {
    if (s.count >= config.minRefreshAnswers) days.add(dayNumber(s.t, config.timeZone))
  }
  return days
}

export function computeStreak(days: Set<number>, now: number, timeZone: string): Streak {
  const today = dayNumber(now, timeZone)
  const runBackFrom = (day: number) => {
    let n = 0
    while (days.has(day - n)) n++
    return n
  }
  const current = days.has(today) ? runBackFrom(today) : runBackFrom(today - 1)
  let longest = 0
  for (const day of days) {
    // Measure each run once, from its last day
    if (!days.has(day + 1)) longest = Math.max(longest, runBackFrom(day))
  }
  return { current, longest, today: days.has(today) }
}

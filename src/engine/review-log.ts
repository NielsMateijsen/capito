import { schedule } from './srs.ts'
import type { CardState, SrsConfig } from './srs.ts'

export type CardKey = string

/**
 * - `lesson`, `refresh`, `exam`, `drill`: schema 3 (lesson path)
 * - `daily`, `unit`: older logs, from before the lesson path
 */
export type ReviewMode = 'lesson' | 'refresh' | 'exam' | 'drill' | 'daily' | 'unit'

export interface ReviewEntry {
  t: string
  key: CardKey
  result: 'correct' | 'almost' | 'wrong' | 'again' | 'good' | 'easy'
  grade: number
  ms: number
  hint: boolean
  answer?: string
  session: string
  mode: ReviewMode
  cv: string
  /** Lesson ID (`<unitId>#<n>` or `<unitId>#final`), only on mode 'lesson'. */
  lesson?: string
  /** Unit of the exam, only on mode 'exam'. */
  unit?: string
  /** Number of questions in the exam, only on mode 'exam'. */
  examSize?: number
}

export function rebuildCards(
  log: ReviewEntry[],
  config: SrsConfig,
): Map<CardKey, CardState> {
  const states = new Map<CardKey, CardState>()
  for (const entry of log) {
    const now = Date.parse(entry.t)
    const current = states.get(entry.key) ?? null
    states.set(entry.key, schedule(current, entry.grade, now, config))
  }
  return states
}

import { schedule } from './srs.ts'
import type { CardState, SrsConfig } from './srs.ts'

export type CardKey = string

export interface ReviewEntry {
  t: string
  key: CardKey
  result: 'correct' | 'almost' | 'wrong' | 'again' | 'good' | 'easy'
  grade: number
  ms: number
  hint: boolean
  answer?: string
  session: string
  mode: 'daily' | 'unit' | 'exam'
  cv: string
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

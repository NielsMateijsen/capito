import type { CardState } from '../engine/srs.ts'
import type { ReviewEntry, CardKey } from '../engine/review-log.ts'

export type Flag = Record<string, unknown>

export interface Settings {
  /** New words and verbs per lesson (schema 3; replaces the daily limits of schema 2). */
  newItemsPerLesson?: number
  autoplayAudio?: boolean
  unlockAll?: boolean
}
export type UnitId = string

export interface ProgressState {
  schema: number
  cards: Record<CardKey, CardState>
  reviewLog: ReviewEntry[]
  introduced: string[]
  /** `canDo`: the answers to "Kan ik dit nu?" after the exam. Exam scores are derived from the log. */
  unitMeta: Record<UnitId, { examBest?: number; examAt?: string; canDo?: boolean[] }>
  flags: Flag[]
  settings: Settings
  meta: { lastExportAt?: string; persistGranted?: boolean; build?: string }
}

export interface ProgressStorage {
  load(): Promise<ProgressState>
  save(state: ProgressState): Promise<void>
}

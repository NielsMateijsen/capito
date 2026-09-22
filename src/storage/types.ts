import type { CardState } from '../engine/srs.ts'
import type { ReviewEntry, CardKey } from '../engine/review-log.ts'

export type Flag = Record<string, unknown>

export interface Settings {
  newCardsPerDay?: number
  autoplayAudio?: boolean
  unlockAll?: boolean
}
export type UnitId = string

export interface ProgressState {
  schema: number
  cards: Record<CardKey, CardState>
  reviewLog: ReviewEntry[]
  introduced: string[]
  unitMeta: Record<UnitId, { examBest?: number; examAt?: string; canDo?: boolean[] }>
  flags: Flag[]
  settings: Settings
  meta: { lastExportAt?: string; persistGranted?: boolean }
}

export interface ProgressStorage {
  load(): Promise<ProgressState>
  save(state: ProgressState): Promise<void>
}

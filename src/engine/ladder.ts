import type { ReviewEntry } from './review-log.ts'
import { examOutcomes } from './exam.ts'

export interface LadderConfig {
  stages: string[]
  passResults: string[]
  dropOnWrong: number
  minGapSameItem: number
  optionCount: number
  minSentencesPerItem: number
  introAutoplay: boolean
}

export interface LadderItem {
  itemId: string
  stageKeys: string[]
}

export interface ItemLadderState {
  itemId: string
  stageKeys: string[]
  level: number
  /** Highest level ever reached; a later drop does not lower it. */
  maxLevel: number
  graduated: boolean
  started: boolean
  /** Graduated by a passed exam instead of the stages. */
  testedOut: boolean
  firstSeen?: number
  lastSeen?: number
  /** Lesson in which the item got its first answer (schema 3). */
  firstLesson?: string
  /** reachedAt[n]: when level n was first reached. */
  reachedAt: number[]
  graduatedAt?: number
}

const FAIL: ReadonlySet<ReviewEntry['result']> = new Set(['wrong', 'again'])

/** Modes from before the lesson path (schema 2 and older). */
const LEGACY_MODES: ReadonlySet<ReviewEntry['mode']> = new Set(['daily', 'unit'])

export function isFail(result: ReviewEntry['result']): boolean {
  return FAIL.has(result)
}

export function ladderItems(itemOrder: string[], stages: string[], cardKeys: Iterable<string>): LadderItem[] {
  const keys = new Set(cardKeys)
  return itemOrder
    .map(itemId => ({ itemId, stageKeys: stages.map(t => `${t}:${itemId}`).filter(k => keys.has(k)) }))
    .filter(item => item.stageKeys.length > 0)
}

function graduate(state: ItemLadderState, t: number, testedOut: boolean) {
  Object.assign(state, { graduated: true, testedOut, level: state.stageKeys.length, maxLevel: state.stageKeys.length, graduatedAt: t, lastSeen: t })
  state.firstSeen ??= t
}

/**
 * Ladder state per item, derived from the log:
 * - only stage answers in a lesson (or in older logs: `daily`, `unit`) start and move an item
 * - a pass on the current stage climbs one level, a fail drops `dropOnWrong` levels
 * - a pass in a passed exam graduates the item at once (test-out); other exam answers do not count
 * - an item whose first old-style answer is not on the first stage was practised before the
 *   ladder existed and counts as graduated
 */
export function computeLadder(
  log: ReviewEntry[],
  items: LadderItem[],
  config: Pick<LadderConfig, 'dropOnWrong' | 'passResults'>,
  exam?: { passThreshold: number; passResults: string[] },
): Map<string, ItemLadderState> {
  const pass = new Set(config.passResults)
  const examPass = new Set(exam?.passResults ?? [])
  const passedExams = new Set(exam ? examOutcomes(log, exam).filter(o => o.passed).map(o => o.session) : [])
  const states = new Map<string, ItemLadderState>()
  const keyToItem = new Map<string, string>()
  for (const item of items) {
    states.set(item.itemId, {
      itemId: item.itemId, stageKeys: item.stageKeys, level: 0, maxLevel: 0,
      graduated: false, started: false, testedOut: false, reachedAt: [],
    })
    for (const k of item.stageKeys) keyToItem.set(k, item.itemId)
  }

  for (const entry of log) {
    const state = states.get(entry.key.split(':')[1])
    if (!state || state.graduated) continue
    const t = Date.parse(entry.t)
    if (entry.mode === 'exam') {
      if (passedExams.has(entry.session) && examPass.has(entry.result)) graduate(state, t, true)
      continue
    }
    const legacy = LEGACY_MODES.has(entry.mode)
    if (!state.started && legacy && entry.key !== state.stageKeys[0]) {
      state.started = true
      graduate(state, t, false)
      continue
    }
    // Only a lesson (or an old-style session) introduces or moves an item; refresh and drill never do
    if (!keyToItem.has(entry.key) || (entry.mode !== 'lesson' && !legacy)) continue
    if (!state.started) {
      state.started = true
      state.firstLesson = entry.lesson
      state.firstSeen = t
    }
    state.lastSeen = t
    if (pass.has(entry.result)) {
      if (entry.key !== state.stageKeys[state.level]) continue
      state.level++
      state.maxLevel = Math.max(state.maxLevel, state.level)
      state.reachedAt[state.level] ??= t
      if (state.level >= state.stageKeys.length) graduate(state, t, false)
    } else if (isFail(entry.result)) {
      state.level = Math.max(0, state.level - config.dropOnWrong)
    }
  }
  return states
}

export function isGraduated(ladder: Map<string, ItemLadderState>, itemId: string): boolean {
  const state = ladder.get(itemId)
  return state === undefined || state.graduated
}

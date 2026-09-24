import type { ReviewEntry } from './review-log.ts'

export interface LadderConfig {
  stages: string[]
  passResults: string[]
  maxStepsPerItemPerDay: number
  dropOnWrong: number
  newItemsPerDay: number
  maxItemsInProgress: number
  reviewShare: number
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
  graduated: boolean
  started: boolean
  stepsToday: number
  firstSeen?: number
  lastSeen?: number
}

const FAIL: ReadonlySet<ReviewEntry['result']> = new Set(['wrong', 'again'])

export function isFail(result: ReviewEntry['result']): boolean {
  return FAIL.has(result)
}

export function dayStartMs(now: number): number {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function ladderItems(itemOrder: string[], stages: string[], cardKeys: Iterable<string>): LadderItem[] {
  const keys = new Set(cardKeys)
  return itemOrder
    .map(itemId => ({ itemId, stageKeys: stages.map(t => `${t}:${itemId}`).filter(k => keys.has(k)) }))
    .filter(item => item.stageKeys.length > 0)
}

export function computeLadder(
  log: ReviewEntry[],
  items: LadderItem[],
  config: Pick<LadderConfig, 'dropOnWrong' | 'passResults'>,
  now: number,
): Map<string, ItemLadderState> {
  const todayStart = dayStartMs(now)
  const pass = new Set(config.passResults)
  const states = new Map<string, ItemLadderState>()
  const keyToItem = new Map<string, string>()
  for (const item of items) {
    states.set(item.itemId, { itemId: item.itemId, stageKeys: item.stageKeys, level: 0, graduated: false, started: false, stepsToday: 0 })
    for (const k of item.stageKeys) keyToItem.set(k, item.itemId)
  }

  for (const entry of log) {
    if (entry.mode === 'exam') continue
    const state = states.get(entry.key.split(':')[1])
    if (!state || state.graduated) continue
    const t = Date.parse(entry.t)
    // Practised before the ladder existed: its first answer is not on the first stage
    if (!state.started && entry.key !== state.stageKeys[0]) {
      Object.assign(state, { started: true, graduated: true, level: state.stageKeys.length, firstSeen: t, lastSeen: t })
      continue
    }
    if (!keyToItem.has(entry.key)) continue
    state.started = true
    state.firstSeen ??= t
    state.lastSeen = t
    if (pass.has(entry.result)) {
      if (entry.key !== state.stageKeys[state.level]) continue
      state.level++
      if (t >= todayStart) state.stepsToday++
      if (state.level >= state.stageKeys.length) state.graduated = true
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

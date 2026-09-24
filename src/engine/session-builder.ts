import type { CardState } from './srs.ts'
import type { ReviewEntry } from './review-log.ts'
import type { ProgressState } from '../storage/types.ts'
import type { ReviewResult } from '../exercises/types.ts'
import { computeLadder, dayStartMs, isGraduated } from './ladder.ts'
import type { ItemLadderState, LadderConfig, LadderItem } from './ladder.ts'
import { seededRandom } from './distractors.ts'

export interface SessionBuilderConfig {
  session: {
    maxReviewsPerSession: number
    newCardsPerDay: number
    minOldMaterialRatio: number
    maxSameTypeInRow: number
    excludedTypes: string[]
  }
  backlog: {
    maxDueShownPerDay: number
    pauseNewCardsAboveDue: number
    returnAfterDays: number
    returnMaxSessionReviews: number
  }
  lapse: {
    retypeCorrectAnswer: boolean
    reinsertInSession: boolean
    reinsertAfterCards: number
  }
  leech: {
    lapseThreshold: number
    showExtraContext: boolean
  }
  grading: {
    correct: number
    almost: number
    hintUsed: number
    wrong: number
    flashcard: { again: number; good: number; easy: number }
  }
  ladder: LadderConfig
}

export interface SessionInput {
  now: number
  allCardKeys: string[]
  cardToUnit: Map<string, string>
  progress: ProgressState
  config: SessionBuilderConfig
  targetUnitId?: string
  seed?: number
  ladderItems?: LadderItem[]
  /** Items that must have finished the ladder before a card enters the review pool. Default: the card's own item. */
  cardRequires?: Map<string, string[]>
}

export type SessionItem =
  | { kind: 'intro'; itemId: string }
  | { kind: 'exercise'; cardKey: string; isNew: boolean }

type ExerciseItem = Extract<SessionItem, { kind: 'exercise' }>

export interface Session {
  queue: SessionItem[]
  isReturn: boolean
  maxReviews: number
  newItemIds: string[]
  /** Stage keys of every item that had not finished the ladder when the session was built. */
  ladderStages: Record<string, string[]>
}

const MS_PER_DAY = 86_400_000

export function cardType(cardKey: string): string {
  return cardKey.split(':')[0]
}

export function itemIdFromKey(cardKey: string): string {
  return cardKey.split(':')[1]
}

function computeTodayNewCount(reviewLog: ReviewEntry[], now: number, counts: (key: string) => boolean): number {
  const todayStart = dayStartMs(now)
  const firstSeen = new Map<string, number>()
  for (const entry of reviewLog) {
    if (!counts(entry.key)) continue
    const t = Date.parse(entry.t)
    const prev = firstSeen.get(entry.key)
    if (prev === undefined || t < prev) firstSeen.set(entry.key, t)
  }
  let count = 0
  for (const t of firstSeen.values()) {
    if (t >= todayStart) count++
  }
  return count
}

function computeLastSessionAt(reviewLog: ReviewEntry[]): number | undefined {
  if (reviewLog.length === 0) return undefined
  let latest = -Infinity
  for (const entry of reviewLog) {
    const t = Date.parse(entry.t)
    if (t > latest) latest = t
  }
  return latest
}

function exercise(cardKey: string, isNew: boolean): SessionItem {
  return { kind: 'exercise', cardKey, isNew }
}

function exerciseCount(chain: SessionItem[]): number {
  return chain.filter(i => i.kind === 'exercise').length
}

function chainItemId(item: SessionItem): string {
  return item.kind === 'intro' ? item.itemId : itemIdFromKey(item.cardKey)
}

// Can the remaining type counts still be arranged without a run longer than maxRun?
function typesFeasible(counts: Map<string, number>, lastType: string | null, run: number, maxRun: number): boolean {
  let total = 0
  for (const c of counts.values()) total += c
  for (const [type, c] of counts) {
    const cap = maxRun * (total - c + 1) - (type === lastType ? run : 0)
    if (c > cap) return false
  }
  return true
}

// Greedy most-remaining-first check: can the remaining cards still keep minGap per item?
function gapsFeasible(remaining: Map<string, number>, lastIndex: Map<string, number>, exIndex: number, minGap: number): boolean {
  const left = new Map([...remaining].filter(([, n]) => n > 0))
  const last = new Map(lastIndex)
  let index = exIndex
  while (left.size > 0) {
    let best: string | undefined
    for (const [item, n] of left) {
      const l = last.get(item)
      if (l !== undefined && index - l - 1 < minGap) continue
      if (best === undefined || n > left.get(best)!) best = item
    }
    if (best === undefined) return false
    const n = left.get(best)! - 1
    if (n === 0) left.delete(best)
    else left.set(best, n)
    last.set(best, index)
    index++
  }
  return true
}

/**
 * Random order under constraints: an intro is placed directly before the first exercise
 * of its chain, a chain keeps its internal order, the same item is at least minGap cards
 * apart, and no more than maxRun cards of one type follow each other. Constraints are
 * relaxed (in that order of importance) only when nothing else fits.
 */
export function scheduleChains(chains: SessionItem[][], rand: () => number, minGap: number, maxRun: number): SessionItem[] {
  const pending = chains.filter(c => exerciseCount(c) > 0).map(items => ({ items, pos: 0 }))
  const out: SessionItem[] = []
  const lastIndex = new Map<string, number>()
  const typeCounts = new Map<string, number>()
  for (const p of pending) {
    for (const item of p.items) {
      if (item.kind === 'exercise') typeCounts.set(cardType(item.cardKey), (typeCounts.get(cardType(item.cardKey)) ?? 0) + 1)
    }
  }
  let exIndex = 0
  let runType: string | null = null
  let runLen = 0

  const nextExercise = (p: { items: SessionItem[]; pos: number }) => {
    const item = p.items[p.pos]
    return (item.kind === 'intro' ? p.items[p.pos + 1] : item) as ExerciseItem
  }
  const gapOk = (p: { items: SessionItem[]; pos: number }) => {
    const last = lastIndex.get(chainItemId(p.items[p.pos]))
    return last === undefined || exIndex - last - 1 >= minGap
  }
  const typeOk = (p: { items: SessionItem[]; pos: number }) =>
    maxRun <= 0 || runLen < maxRun || cardType(nextExercise(p).cardKey) !== runType
  const feasible = (p: { items: SessionItem[]; pos: number }) => {
    if (maxRun <= 0) return true
    const type = cardType(nextExercise(p).cardKey)
    const counts = new Map(typeCounts)
    counts.set(type, (counts.get(type) ?? 1) - 1)
    return typesFeasible(counts, type, type === runType ? runLen + 1 : 1, maxRun)
  }
  const itemRemaining = new Map<string, number>()
  for (const p of pending) {
    for (const item of p.items) {
      if (item.kind === 'exercise') itemRemaining.set(chainItemId(item), (itemRemaining.get(chainItemId(item)) ?? 0) + 1)
    }
  }
  const gapFeasible = (p: { items: SessionItem[]; pos: number }) => {
    const item = chainItemId(p.items[p.pos])
    const remaining = new Map(itemRemaining)
    remaining.set(item, remaining.get(item)! - 1)
    const last = new Map(lastIndex)
    last.set(item, exIndex)
    return gapsFeasible(remaining, last, exIndex + 1, minGap)
  }
  const tiers = [
    (p: { items: SessionItem[]; pos: number }) => gapOk(p) && typeOk(p) && feasible(p) && gapFeasible(p),
    (p: { items: SessionItem[]; pos: number }) => gapOk(p) && gapFeasible(p) && typeOk(p),
    (p: { items: SessionItem[]; pos: number }) => gapOk(p) && typeOk(p) && feasible(p),
    (p: { items: SessionItem[]; pos: number }) => typeOk(p) && feasible(p),
    (p: { items: SessionItem[]; pos: number }) => gapOk(p) && typeOk(p),
    typeOk,
    () => true,
  ]

  for (;;) {
    const open = pending.filter(p => p.pos < p.items.length)
    if (open.length === 0) break
    let candidates = open
    for (const tier of tiers) {
      const matching = open.filter(tier)
      if (matching.length > 0) { candidates = matching; break }
    }
    const weights = candidates.map(p => p.items.length - p.pos)
    let r = rand() * weights.reduce((a, b) => a + b, 0)
    let chosen = candidates[candidates.length - 1]
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i]
      if (r < 0) { chosen = candidates[i]; break }
    }

    if (chosen.items[chosen.pos].kind === 'intro') out.push(chosen.items[chosen.pos++])
    const ex = chosen.items[chosen.pos++] as ExerciseItem
    out.push(ex)
    const type = cardType(ex.cardKey)
    typeCounts.set(type, (typeCounts.get(type) ?? 1) - 1)
    itemRemaining.set(itemIdFromKey(ex.cardKey), (itemRemaining.get(itemIdFromKey(ex.cardKey)) ?? 1) - 1)
    runLen = type === runType ? runLen + 1 : 1
    runType = type
    lastIndex.set(itemIdFromKey(ex.cardKey), exIndex)
    exIndex++
  }
  return out
}

export function isLeech(state: CardState, config: { lapseThreshold: number }): boolean {
  return state.lapses >= config.lapseThreshold
}

export function gradeFromResult(
  result: ReviewResult,
  hintUsed: boolean,
  config: SessionBuilderConfig['grading'],
): number {
  if (result === 'again') return config.flashcard.again
  if (result === 'good') return config.flashcard.good
  if (result === 'easy') return config.flashcard.easy
  if (result === 'wrong') return config.wrong
  // 'correct' or 'almost'
  if (hintUsed) return config.hintUsed
  if (result === 'correct') return config.correct
  return config.almost
}

export function lapseReinsertAt(currentIdx: number, config: { reinsertAfterCards: number }): number {
  return currentIdx + config.reinsertAfterCards
}

/**
 * After a wrong answer: a ladder card drops the item back (later stages of that item leave
 * the session, the lower stage returns later); any other card simply returns later.
 */
export function replanAfterWrong(
  queue: SessionItem[],
  pos: number,
  cardKey: string,
  ladderStages: Record<string, string[]>,
  config: Pick<SessionBuilderConfig, 'lapse'> & { ladder: Pick<LadderConfig, 'dropOnWrong'> },
): SessionItem[] {
  const stages = ladderStages[itemIdFromKey(cardKey)]
  const idx = stages ? stages.indexOf(cardKey) : -1
  let next = queue
  let back = cardKey
  if (idx !== -1) {
    next = [
      ...queue.slice(0, pos + 1),
      ...queue.slice(pos + 1).filter(q => !(q.kind === 'exercise' && stages.includes(q.cardKey))),
    ]
    back = stages[Math.max(0, idx - config.ladder.dropOnWrong)]
  }
  if (!config.lapse.reinsertInSession) return next
  const at = Math.min(lapseReinsertAt(pos, config.lapse), next.length)
  return [...next.slice(0, at), exercise(back, false), ...next.slice(at)]
}

export function buildSession(input: SessionInput): Session {
  const { now, allCardKeys, cardToUnit, progress, config, targetUnitId } = input
  const { session: sc, backlog: bc, ladder: lc } = config
  const requires = input.cardRequires ?? new Map<string, string[]>()
  const rand = seededRandom(input.seed ?? now)
  const todayStart = dayStartMs(now)

  // Return after a pause
  const lastSessionAt = computeLastSessionAt(progress.reviewLog)
  const isReturn =
    lastSessionAt !== undefined && now - lastSessionAt >= bc.returnAfterDays * MS_PER_DAY
  const maxReviews = isReturn ? bc.returnMaxSessionReviews : sc.maxReviewsPerSession

  // Ladder state, derived from the log
  const items = input.ladderItems ?? []
  const ladder = computeLadder(progress.reviewLog, items, lc, now)
  const stageKeySet = new Set(items.flatMap(i => i.stageKeys))
  const inTarget = (k: string) => targetUnitId === undefined || cardToUnit.get(k) === targetUnitId
  const itemInTarget = (s: ItemLadderState) => inTarget(s.stageKeys[0])

  // Review pool: allowed types whose items have finished the ladder
  const excluded = new Set(sc.excludedTypes)
  const reviewPool = allCardKeys.filter(k =>
    !excluded.has(cardType(k)) &&
    (requires.get(k) ?? [itemIdFromKey(k)]).every(id => isGraduated(ladder, id)),
  )
  const dueAll = reviewPool
    .filter(k => {
      const state = progress.cards[k]
      return state !== undefined && state.due <= now
    })
    .sort((a, b) => (progress.cards[a]?.due ?? 0) - (progress.cards[b]?.due ?? 0))
  const totalDue = dueAll.length
  const due = dueAll.slice(0, bc.maxDueShownPerDay)
  const blockedNew = isReturn || totalDue >= bc.pauseNewCardsAboveDue

  const todayNewCount = computeTodayNewCount(progress.reviewLog, now, k => !stageKeySet.has(k))
  const newCardSlots = blockedNew ? 0 : Math.max(0, sc.newCardsPerDay - todayNewCount)
  const newReviewCards = reviewPool.filter(k => progress.cards[k] === undefined).slice(0, newCardSlots)

  // Ladder chains
  const states = [...ladder.values()]
  const onLadder = states.filter(s => s.started && !s.graduated)
  const chainFor = (s: ItemLadderState, isNew: boolean): SessionItem[] => {
    const steps = Math.max(0, lc.maxStepsPerItemPerDay - s.stepsToday)
    const keys = s.stageKeys.slice(s.level, s.level + steps)
    if (keys.length === 0) return []
    return [
      ...(isNew ? [{ kind: 'intro' as const, itemId: s.itemId }] : []),
      ...keys.map(k => exercise(k, isNew)),
    ]
  }
  const inProgressChains = onLadder
    .filter(itemInTarget)
    .sort((a, b) => (a.lastSeen ?? 0) - (b.lastSeen ?? 0))
    .map(s => chainFor(s, false))
  const introducedToday = states.filter(s => s.firstSeen !== undefined && s.firstSeen >= todayStart).length
  const newItemSlots = blockedNew
    ? 0
    : Math.max(0, Math.min(lc.newItemsPerDay - introducedToday, lc.maxItemsInProgress - onLadder.length))
  const newItemChains = states
    .filter(s => !s.started && itemInTarget(s))
    .slice(0, newItemSlots)
    .map(s => chainFor(s, true))

  // Fill the budget: reserved reviews, ladder, new items, remaining reviews, new review cards
  const chains: SessionItem[][] = []
  let budget = targetUnitId === undefined
    ? maxReviews
    : Math.max(1, Math.floor(maxReviews * (1 - sc.minOldMaterialRatio)))
  const take = (chain: SessionItem[]) => {
    if (budget <= 0 || exerciseCount(chain) === 0) return
    const kept: SessionItem[] = []
    let n = 0
    for (const item of chain) {
      if (item.kind === 'exercise') {
        if (n >= budget) break
        n++
      }
      kept.push(item)
    }
    budget -= n
    chains.push(kept)
  }
  const dueTarget = due.filter(inTarget)
  const reserved = Math.min(dueTarget.length, Math.floor(maxReviews * lc.reviewShare))
  dueTarget.slice(0, reserved).forEach(k => take([exercise(k, false)]))
  inProgressChains.forEach(take)
  newItemChains.forEach(take)
  dueTarget.slice(reserved).forEach(k => take([exercise(k, false)]))
  newReviewCards.filter(inTarget).forEach(k => take([exercise(k, true)]))

  // Practising one unit: add old material from other units
  if (targetUnitId !== undefined) {
    const targetCount = chains.reduce((n, c) => n + exerciseCount(c), 0)
    const ratio = sc.minOldMaterialRatio
    const minOther = Math.ceil((ratio / (1 - ratio)) * targetCount)
    const otherDue = due.filter(k => !inTarget(k))
    const otherDueSet = new Set(otherDue)
    const otherSeen = reviewPool.filter(k => !inTarget(k) && progress.cards[k] !== undefined && !otherDueSet.has(k))
    ;[...otherDue, ...otherSeen].slice(0, minOther).forEach(k => chains.push([exercise(k, false)]))
  }

  const queue = scheduleChains(chains, rand, lc.minGapSameItem, sc.maxSameTypeInRow)
  const newItemIds = chains.flatMap(c => c.flatMap(i => (i.kind === 'intro' ? [i.itemId] : [])))
  const ladderStages: Record<string, string[]> = {}
  for (const s of states) {
    if (!s.graduated) ladderStages[s.itemId] = s.stageKeys
  }

  return { queue, isReturn, maxReviews, newItemIds, ladderStages }
}

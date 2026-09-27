import type { CardState } from './srs.ts'
import type { ProgressState } from '../storage/types.ts'
import type { ReviewResult } from '../exercises/types.ts'
import { computeLadder, isGraduated } from './ladder.ts'
import type { ItemLadderState, LadderConfig, LadderItem } from './ladder.ts'
import type { Lesson, LessonConfig } from './lessons.ts'
import { seededRandom } from './distractors.ts'

export interface SessionBuilderConfig {
  session: {
    maxSameTypeInRow: number
    excludedTypes: string[]
    timeZone: string
  }
  lesson: LessonConfig
  refresh: {
    maxCards: number
    prominentAboveDueItems: number
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
  exam: { passThreshold: number; passResults: string[] }
}

interface BuildInput {
  now: number
  allCardKeys: string[]
  progress: ProgressState
  config: SessionBuilderConfig
  seed?: number
  ladderItems?: LadderItem[]
  /** Items that must have finished the ladder before a card enters the review pool. Default: the card's own item. */
  cardRequires?: Map<string, string[]>
}

export interface LessonInput extends BuildInput {
  lesson: Lesson
  /** Words and verbs of the lesson's unit: unfinished ones of this unit are finished first. */
  unitItems?: string[]
}

export interface RefreshInput extends BuildInput {
  /** Practise exactly these cards (e.g. the questions missed in an exam) instead of the due ones. */
  onlyKeys?: string[]
}

export type SessionItem =
  | { kind: 'intro'; itemId: string }
  | { kind: 'exercise'; cardKey: string; isNew: boolean }

type ExerciseItem = Extract<SessionItem, { kind: 'exercise' }>

export interface Session {
  queue: SessionItem[]
  /** The session ends after this many answers, even if cards are left. */
  maxReviews: number
  newItemIds: string[]
  /** Stage keys of every item that had not finished the ladder when the session was built. */
  ladderStages: Record<string, string[]>
}

export function cardType(cardKey: string): string {
  return cardKey.split(':')[0]
}

export function itemIdFromKey(cardKey: string): string {
  return cardKey.split(':')[1]
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

  // New items keep their learning order: an intro chain waits until earlier intro chains have started.
  // No new item gets its second question before every new item had its first (pos 2 = intro and first
  // question done), so a lesson left halfway has started all its new items (see planLessons).
  const introChains = pending.filter(p => p.items[0].kind === 'intro')
  const introAllowed = (p: { items: SessionItem[]; pos: number }) => {
    if (p.items[0].kind !== 'intro') return true
    if (p.pos === 0) return introChains.slice(0, introChains.indexOf(p)).every(q => q.pos > 0)
    return p.pos < 2 || introChains.every(q => q.pos >= 2 || q.pos >= q.items.length)
  }

  for (;;) {
    const open = pending.filter(p => p.pos < p.items.length && introAllowed(p))
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
  let at = Math.min(Math.max(pos + 1, lapseReinsertAt(pos, config.lapse)), next.length)
  while (at < next.length && next[at - 1]?.kind === 'intro') at++
  return [...next.slice(0, at), exercise(back, false), ...next.slice(at)]
}

function ladderOf(input: BuildInput): Map<string, ItemLadderState> {
  return computeLadder(input.progress.reviewLog, input.ladderItems ?? [], input.config.ladder, input.config.exam)
}

function ladderStagesOf(ladder: Map<string, ItemLadderState>): Record<string, string[]> {
  const stages: Record<string, string[]> = {}
  for (const s of ladder.values()) {
    if (!s.graduated) stages[s.itemId] = s.stageKeys
  }
  return stages
}

/** Review cards: allowed types whose items have finished the ladder. */
export function reviewPool(
  allCardKeys: string[],
  ladder: Map<string, ItemLadderState>,
  cardRequires: Map<string, string[]>,
  excludedTypes: string[],
): string[] {
  const excluded = new Set(excludedTypes)
  return allCardKeys.filter(k =>
    !excluded.has(cardType(k)) &&
    (cardRequires.get(k) ?? [itemIdFromKey(k)]).every(id => isGraduated(ladder, id)),
  )
}

/** Cards in the pool that are due, most overdue first. */
export function dueCards(pool: string[], cards: Record<string, CardState>, now: number): string[] {
  return pool
    .filter(k => cards[k] !== undefined && cards[k].due <= now)
    .sort((a, b) => cards[a].due - cards[b].due)
}

/** Review cards never answered; cards whose items finished the ladder first come first. */
function unseenCards(pool: string[], input: BuildInput, ladder: Map<string, ItemLadderState>): string[] {
  const requires = input.cardRequires ?? new Map<string, string[]>()
  const releasedAt = (k: string) =>
    Math.max(0, ...(requires.get(k) ?? [itemIdFromKey(k)]).map(id => ladder.get(id)?.graduatedAt ?? 0))
  return pool
    .filter(k => input.progress.cards[k] === undefined)
    .map((k, i) => ({ k, i, at: releasedAt(k) }))
    .sort((a, b) => a.at - b.at || a.i - b.i)
    .map(x => x.k)
}

/** Without a ladder, a wrong answer brings the same card back instead of a lower stage. */
function toSession(chains: SessionItem[][], input: BuildInput, ladder: Map<string, ItemLadderState> | null): Session {
  const { config } = input
  const queue = scheduleChains(chains, seededRandom(input.seed ?? input.now), config.ladder.minGapSameItem, config.session.maxSameTypeInRow)
  return {
    queue,
    maxReviews: Number.POSITIVE_INFINITY,
    newItemIds: queue.flatMap(i => (i.kind === 'intro' ? [i.itemId] : [])),
    ladderStages: ladder ? ladderStagesOf(ladder) : {},
  }
}

/**
 * A lesson: its new items (intro and the first `maxStepsPerItemPerLesson` stages), the next
 * stages of unfinished items from earlier lessons, and a few review cards (due ones first,
 * then some never answered). An item of the lesson never climbs past the lesson target here,
 * also when the lesson is resumed.
 */
export function buildLesson(input: LessonInput): Session {
  const { lesson, config, progress, now } = input
  const lc = config.lesson
  const ladder = ladderOf(input)
  const members = new Set(lesson.items)
  const chains: SessionItem[][] = []

  for (const id of lesson.items) {
    const s = ladder.get(id)
    if (!s || s.graduated) continue
    const isNew = !s.started
    const keys = s.stageKeys.slice(s.level, Math.min(lc.maxStepsPerItemPerLesson, s.stageKeys.length))
    if (keys.length === 0) continue
    chains.push([
      ...(isNew ? [{ kind: 'intro' as const, itemId: id }] : []),
      ...keys.map(k => exercise(k, isNew)),
    ])
  }

  const ownUnit = new Set(input.unitItems ?? [])
  const unfinished = [...ladder.values()]
    .filter(s => s.started && !s.graduated && !members.has(s.itemId))
    .sort((a, b) => Number(ownUnit.has(b.itemId)) - Number(ownUnit.has(a.itemId)) || (a.lastSeen ?? 0) - (b.lastSeen ?? 0))
    .slice(0, lc.maxFinishItemsPerLesson)
  for (const s of unfinished) {
    chains.push(s.stageKeys.slice(s.level, s.level + lc.maxStepsPerItemPerLesson).map(k => exercise(k, false)))
  }

  const pool = reviewPool(input.allCardKeys, ladder, input.cardRequires ?? new Map(), config.session.excludedTypes)
  dueCards(pool, progress.cards, now).slice(0, lc.maxReviewsPerLesson).forEach(k => chains.push([exercise(k, false)]))
  unseenCards(pool, input, ladder).slice(0, lc.newReviewCardsPerLesson).forEach(k => chains.push([exercise(k, true)]))

  return toSession(chains, input, ladder)
}

/**
 * Opfrissen: the most overdue review cards, then leeches that are not due yet, then review
 * cards never answered, up to `refresh.maxCards`. With `onlyKeys`: exactly those cards.
 * A missed card comes back as it is: refreshing never walks down the ladder.
 */
export function buildRefresh(input: RefreshInput): Session {
  const { config, progress, now } = input
  if (input.onlyKeys) {
    return toSession([...new Set(input.onlyKeys)].map(k => [exercise(k, false)]), input, null)
  }
  const ladder = ladderOf(input)
  const pool = reviewPool(input.allCardKeys, ladder, input.cardRequires ?? new Map(), config.session.excludedTypes)
  const due = dueCards(pool, progress.cards, now)
  const dueSet = new Set(due)
  const leeches = pool.filter(k => !dueSet.has(k) && progress.cards[k] !== undefined && isLeech(progress.cards[k], config.leech))
  const keys = [...due, ...leeches, ...unseenCards(pool, input, ladder)].slice(0, config.refresh.maxCards)
  return toSession(keys.map(k => [exercise(k, progress.cards[k] === undefined)]), input, null)
}

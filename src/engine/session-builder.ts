import type { CardState } from './srs.ts'
import type { ReviewEntry } from './review-log.ts'
import type { ProgressState } from '../storage/types.ts'
import type { ReviewResult } from '../exercises/types.ts'

export interface SessionBuilderConfig {
  session: {
    maxReviewsPerSession: number
    newCardsPerDay: number
    minOldMaterialRatio: number
    maxSameTypeInRow: number
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
}

export interface SessionInput {
  now: number
  allCardKeys: string[]
  cardToUnit: Map<string, string>
  progress: ProgressState
  config: SessionBuilderConfig
  targetUnitId?: string
}

export type SessionItem =
  | { kind: 'intro'; itemId: string }
  | { kind: 'exercise'; cardKey: string; isNew: boolean }

export interface Session {
  queue: SessionItem[]
  isReturn: boolean
  maxReviews: number
  newItemIds: string[]
}

const MS_PER_DAY = 86_400_000

function cardType(cardKey: string): string {
  return cardKey.split(':')[0]
}

function itemIdFromKey(cardKey: string): string {
  return cardKey.split(':')[1]
}

function dayStartMs(now: number): number {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function computeTodayNewCount(reviewLog: ReviewEntry[], now: number): number {
  const todayStart = dayStartMs(now)
  const firstSeen = new Map<string, number>()
  for (const entry of reviewLog) {
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

function mixTypes(keys: string[], maxRun: number): string[] {
  if (maxRun <= 0 || keys.length === 0) return [...keys]
  const result: string[] = []
  const remaining = [...keys]

  while (remaining.length > 0) {
    const lastType = result.length > 0 ? cardType(result[result.length - 1]) : null

    let runLength = 0
    if (lastType !== null) {
      for (let i = result.length - 1; i >= 0; i--) {
        if (cardType(result[i]) === lastType) runLength++
        else break
      }
    }

    if (runLength >= maxRun) {
      const idx = remaining.findIndex(k => cardType(k) !== lastType)
      if (idx === -1) {
        result.push(...remaining)
        break
      }
      const [taken] = remaining.splice(idx, 1)
      result.push(taken)
    } else {
      result.push(remaining.shift()!)
    }
  }
  return result
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

export function buildSession(input: SessionInput): Session {
  const { now, allCardKeys, cardToUnit, progress, config, targetUnitId } = input
  const { session: sc, backlog: bc } = config

  // Step 1: isReturn and effective maxReviews
  const lastSessionAt = computeLastSessionAt(progress.reviewLog)
  const isReturn =
    lastSessionAt !== undefined && now - lastSessionAt >= bc.returnAfterDays * MS_PER_DAY
  const maxReviews = isReturn ? bc.returnMaxSessionReviews : sc.maxReviewsPerSession

  // Step 2: how many new cards were started today
  const todayNewCount = computeTodayNewCount(progress.reviewLog, now)

  // Step 3: due cards — most-overdue first, capped at maxDueShownPerDay
  const dueAll = allCardKeys
    .filter(k => {
      const state = progress.cards[k]
      return state !== undefined && state.due <= now
    })
    .sort((a, b) => (progress.cards[a]?.due ?? 0) - (progress.cards[b]?.due ?? 0))
  const totalDue = dueAll.length
  const due = dueAll.slice(0, bc.maxDueShownPerDay)

  // Step 4: new cards (blocked by isReturn, high backlog, or daily limit)
  const canAddNew =
    !isReturn && totalDue < bc.pauseNewCardsAboveDue && todayNewCount < sc.newCardsPerDay
  const newSlots = canAddNew
    ? Math.min(sc.newCardsPerDay - todayNewCount, Math.max(0, maxReviews - due.length))
    : 0
  const newCards = allCardKeys
    .filter(k => progress.cards[k] === undefined)
    .slice(0, newSlots)

  // Step 5: minOldMaterialRatio — only when targetUnitId is set
  let combined: string[]
  if (targetUnitId !== undefined) {
    const baseSet = new Set([...due, ...newCards])
    const targetCards = [...due, ...newCards].filter(k => cardToUnit.get(k) === targetUnitId)
    const otherCards = [...due, ...newCards].filter(k => cardToUnit.get(k) !== targetUnitId)

    const ratio = sc.minOldMaterialRatio
    const minOther = Math.ceil((ratio / (1 - ratio)) * targetCards.length)
    const missingOther = Math.max(0, minOther - otherCards.length)

    if (missingOther > 0) {
      const extras = allCardKeys
        .filter(k => cardToUnit.get(k) !== targetUnitId && !baseSet.has(k))
        .slice(0, missingOther)
      otherCards.push(...extras)
    }

    combined = [...otherCards, ...targetCards]
  } else {
    combined = [...due, ...newCards]
  }

  // Step 6: mix exercise types so no single type dominates
  const mixed = mixTypes(combined, sc.maxSameTypeInRow)

  // Step 7: cap total at maxReviews
  const cappedKeys = mixed.slice(0, maxReviews)

  // Step 8: build queue — intros before exercises, one intro per new itemId
  const newCardSet = new Set(newCards)
  const introducedSet = new Set(progress.introduced)
  const seenItemIds = new Set<string>()
  const newItemIds: string[] = []

  for (const k of cappedKeys) {
    if (newCardSet.has(k)) {
      const itemId = itemIdFromKey(k)
      if (!introducedSet.has(itemId) && !seenItemIds.has(itemId)) {
        seenItemIds.add(itemId)
        newItemIds.push(itemId)
      }
    }
  }

  const introItems: SessionItem[] = newItemIds.map(id => ({ kind: 'intro' as const, itemId: id }))
  const exerciseItems: SessionItem[] = cappedKeys.map(k => ({
    kind: 'exercise' as const,
    cardKey: k,
    isNew: newCardSet.has(k),
  }))

  return {
    queue: [...introItems, ...exerciseItems],
    isReturn,
    maxReviews,
    newItemIds,
  }
}

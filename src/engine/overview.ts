import type { Unit } from '../content/schemas.ts'
import type { ProgressState } from '../storage/types.ts'
import type { ItemLadderState, LadderItem } from './ladder.ts'
import { computeLadder } from './ladder.ts'
import type { Lesson, UnitPath } from './lessons.ts'
import { lessonDoneAt, unitPath } from './lessons.ts'
import { bestExamScore, examOutcomes, passedUnits } from './exam.ts'
import { isUnitUnlocked } from './unlock.ts'
import type { SessionBuilderConfig } from './session-builder.ts'
import { dueCards, itemIdFromKey, reviewPool } from './session-builder.ts'
import type { Streak, StreakConfig } from './streak.ts'
import { activeDays, computeStreak } from './streak.ts'

export interface OverviewInput {
  now: number
  units: Pick<Unit, 'id' | 'order' | 'requires'>[]
  /** Words and verbs on the ladder per unit, in learning order. */
  unitItems: Map<string, string[]>
  ladderItems: LadderItem[]
  allCardKeys: string[]
  cardRequires: Map<string, string[]>
  progress: ProgressState
  config: SessionBuilderConfig & { streak: StreakConfig }
  unlockAll: boolean
}

export type NextStep =
  | { kind: 'lesson'; lesson: Lesson }
  | { kind: 'exam'; unitId: string }
  | { kind: 'none' }

export interface Overview {
  ladder: Map<string, ItemLadderState>
  paths: Map<string, UnitPath>
  passed: Set<string>
  unlocked: Set<string>
  bestScore: Map<string, number>
  /** What "Verder" opens: the first open lesson of the first unit not passed, else its exam. */
  next: NextStep
  refresh: { dueCards: number; dueItems: number; prominent: boolean }
  streak: Streak
}

/** Everything Home and the unit screen show, derived from the log. */
export function overview(input: OverviewInput): Overview {
  const { now, progress, config } = input
  const log = progress.reviewLog
  const ladder = computeLadder(log, input.ladderItems, config.ladder, config.exam)
  const outcomes = examOutcomes(log, config.exam)
  const passed = passedUnits(outcomes)
  const units = [...input.units].sort((a, b) => a.order - b.order)

  const paths = new Map<string, UnitPath>()
  const unlocked = new Set<string>()
  const bestScore = new Map<string, number>()
  const lessonDoneTimes: number[] = []
  for (const unit of units) {
    const items = input.unitItems.get(unit.id) ?? []
    const path = unitPath(unit.id, items, ladder, config.lesson)
    paths.set(unit.id, path)
    if (input.unlockAll || isUnitUnlocked(unit, passed)) unlocked.add(unit.id)
    const best = bestExamScore(outcomes, unit.id)
    if (best !== undefined) bestScore.set(unit.id, best)
    for (const { lesson, done } of path.lessons) {
      const at = done ? lessonDoneAt(lesson, items, ladder, config.lesson.maxStepsPerItemPerLesson) : undefined
      if (at) lessonDoneTimes.push(at)
    }
  }

  let next: NextStep = { kind: 'none' }
  const target = units.find(u => unlocked.has(u.id) && !passed.has(u.id))
  if (target) {
    const current = paths.get(target.id)?.current
    next = current ? { kind: 'lesson', lesson: current } : { kind: 'exam', unitId: target.id }
  }

  const pool = reviewPool(input.allCardKeys, ladder, input.cardRequires, config.session.excludedTypes)
  const due = dueCards(pool, progress.cards, now)
  const dueItems = new Set(due.map(itemIdFromKey)).size

  const examTimes = outcomes.filter(o => o.complete).map(o => o.t)
  const days = activeDays(log, lessonDoneTimes, examTimes, { ...config.streak, timeZone: config.session.timeZone })

  return {
    ladder,
    paths,
    passed,
    unlocked,
    bestScore,
    next,
    refresh: { dueCards: due.length, dueItems, prominent: dueItems >= config.refresh.prominentAboveDueItems },
    streak: computeStreak(days, now, config.session.timeZone),
  }
}

import type { ItemLadderState } from './ladder.ts'
import { isFail } from './ladder.ts'
import type { ReviewEntry } from './review-log.ts'

export interface LessonConfig {
  itemsPerLesson: number
  minItemsPerLesson: number
  maxItemsPerLesson: number
  maxStepsPerItemPerLesson: number
  maxFinishItemsPerLesson: number
  maxReviewsPerLesson: number
  newReviewCardsPerLesson: number
}

export interface Lesson {
  id: string
  unitId: string
  /** Position on the path, from 1; the final lesson comes last. */
  number: number
  /** New words and verbs of this lesson; empty for the final lesson. */
  items: string[]
  /** The last lesson of a unit: finishes the remaining stages, has no new items. */
  final: boolean
}

export interface LessonStatus {
  lesson: Lesson
  done: boolean
  /** The lesson can be started: every lesson before it is done. */
  available: boolean
}

export interface UnitPath {
  unitId: string
  lessons: LessonStatus[]
  doneCount: number
  /** First lesson that is not done yet. */
  current?: Lesson
}

const FINAL = 'final'

export function lessonId(unitId: string, n: number | typeof FINAL): string {
  return `${unitId}#${n}`
}

function parseLessonId(id: string): { unitId: string; n: number | typeof FINAL } | null {
  const at = id.lastIndexOf('#')
  if (at <= 0) return null
  const rest = id.slice(at + 1)
  if (rest === FINAL) return { unitId: id.slice(0, at), n: FINAL }
  const n = Number(rest)
  return Number.isInteger(n) && n > 0 ? { unitId: id.slice(0, at), n } : null
}

/** The level an item must reach in the lesson that introduces it. */
function lessonTarget(state: ItemLadderState, maxSteps: number): number {
  return Math.min(maxSteps, state.stageKeys.length)
}

/** When the item first reached its lesson target, or undefined when it has not. */
function targetReachedAt(state: ItemLadderState, maxSteps: number): number | undefined {
  const times = [state.reachedAt[lessonTarget(state, maxSteps)], state.graduatedAt].filter((t): t is number => t !== undefined)
  return times.length > 0 ? Math.min(...times) : undefined
}

/**
 * When the lesson became done, or undefined when it is not done. A lesson is done when each of
 * its items reached the lesson target (maxStepsPerItemPerLesson stages) at some point; the final
 * lesson when every item of the unit has finished the ladder.
 */
export function lessonDoneAt(
  lesson: Lesson,
  unitItems: string[],
  ladder: Map<string, ItemLadderState>,
  maxSteps: number,
): number | undefined {
  const ids = lesson.final ? unitItems : lesson.items
  let at = 0
  for (const id of ids) {
    const state = ladder.get(id)
    if (!state) continue
    const t = lesson.final ? state.graduatedAt : targetReachedAt(state, maxSteps)
    if (t === undefined) return undefined
    at = Math.max(at, t)
  }
  return at
}

export function isLessonDone(lesson: Lesson, unitItems: string[], ladder: Map<string, ItemLadderState>, maxSteps: number): boolean {
  return lessonDoneAt(lesson, unitItems, ladder, maxSteps) !== undefined
}

/**
 * Splits the words and verbs of a unit into lessons. The split follows the log, so it never
 * changes for a lesson that has begun: an item belongs to the lesson of its first answer.
 * Untouched items fill up the last begun lesson (while it is not done) and then new lessons of
 * `itemsPerLesson`. Items learned outside the lessons (a test-out or an older log) are skipped.
 */
export function planLessons(
  unitId: string,
  unitItems: string[],
  ladder: Map<string, ItemLadderState>,
  config: Pick<LessonConfig, 'itemsPerLesson' | 'maxStepsPerItemPerLesson'>,
): Lesson[] {
  if (unitItems.length === 0) return []
  const begun = new Map<number, string[]>()
  const untouched: string[] = []
  for (const id of unitItems) {
    const state = ladder.get(id)
    if (!state || (!state.started && !state.graduated)) {
      untouched.push(id)
      continue
    }
    const parsed = state.firstLesson ? parseLessonId(state.firstLesson) : null
    if (parsed?.unitId === unitId && typeof parsed.n === 'number') begun.set(parsed.n, [...(begun.get(parsed.n) ?? []), id])
  }

  const lessons: Lesson[] = [...begun]
    .sort(([a], [b]) => a - b)
    .map(([n, items]) => ({ id: lessonId(unitId, n), unitId, number: n, items, final: false }))
  const size = Math.max(1, config.itemsPerLesson)
  const last = lessons.at(-1)
  if (last && !isLessonDone(last, unitItems, ladder, config.maxStepsPerItemPerLesson)) {
    last.items.push(...untouched.splice(0, Math.max(0, size - last.items.length)))
  }
  let n = last?.number ?? 0
  while (untouched.length > 0) {
    n++
    lessons.push({ id: lessonId(unitId, n), unitId, number: n, items: untouched.splice(0, size), final: false })
  }
  lessons.push({ id: lessonId(unitId, FINAL), unitId, number: n + 1, items: [], final: true })
  return lessons
}

export function unitPath(
  unitId: string,
  unitItems: string[],
  ladder: Map<string, ItemLadderState>,
  config: Pick<LessonConfig, 'itemsPerLesson' | 'maxStepsPerItemPerLesson'>,
): UnitPath {
  const lessons = planLessons(unitId, unitItems, ladder, config)
  let open = true
  const statuses = lessons.map(lesson => {
    const done = isLessonDone(lesson, unitItems, ladder, config.maxStepsPerItemPerLesson)
    const status = { lesson, done, available: open }
    if (!done) open = false
    return status
  })
  return {
    unitId,
    lessons: statuses,
    doneCount: statuses.filter(s => s.done).length,
    current: statuses.find(s => !s.done)?.lesson,
  }
}

/** No wrong answers and no hints; an accent slip ('almost') still counts as perfect. */
export function isPerfectRun(entries: ReviewEntry[]): boolean {
  return entries.length > 0 && entries.every(e => !isFail(e.result) && !e.hint)
}

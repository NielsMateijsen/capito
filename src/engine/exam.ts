import type { CardState } from './srs.ts'
import type { ReviewEntry } from './review-log.ts'
import { seededRandom, shuffle } from './distractors.ts'

export const EXAM_ALLOWED_TYPES = new Set([
  'translate-nl-it',
  'sentence-translate',
  'conjugate',
  'cloze',
  'dictation',
])

export interface ExamConfig {
  itemCount: number
  unitShare: number
  passThreshold: number
  passResults: string[]
  /** Card types that test a single word or verb, in order of preference. */
  itemTypes: string[]
  allowHints: boolean
}

export interface ExamResult {
  score: number
  passed: boolean
  byType: Record<string, { correct: number; total: number }>
  missedCardKeys: string[]
}

export interface ExamOutcome {
  session: string
  unit: string
  /** Time of the last answer. */
  t: number
  score: number
  /** Every question was answered. */
  complete: boolean
  passed: boolean
  /** Cards answered with a pass result. */
  passedKeys: string[]
}

function cardType(cardKey: string): string {
  return cardKey.split(':')[0]
}

function itemOf(cardKey: string): string {
  return cardKey.split(':')[1] ?? ''
}

export interface ExamInput {
  unitId: string
  /** Words and verbs of the unit, in learning order. */
  unitItems: string[]
  /** Units that come before this one: the only source of older material. */
  earlierUnitIds: Set<string>
  allCardKeys: string[]
  cardToUnit: Map<string, string>
  cards: Record<string, CardState>
  config: ExamConfig
  seed: number
}

/**
 * Every word and verb of the unit gets one question (as long as the unit share allows), so
 * passing the exam as a test-out says something about each item. Sentence cards fill up the
 * unit share, cards from earlier units (seen ones first) the rest.
 */
export function buildExamSession(input: ExamInput): string[] {
  const { unitId, unitItems, earlierUnitIds, allCardKeys, cardToUnit, cards, config } = input
  const rand = seededRandom(input.seed)
  const allowed = allCardKeys.filter(k => EXAM_ALLOWED_TYPES.has(cardType(k)))
  const unitCards = allowed.filter(k => cardToUnit.get(k) === unitId)
  const items = new Set(unitItems)

  const itemCards: string[] = []
  for (const itemId of shuffle(unitItems, rand)) {
    const own = unitCards.filter(k => itemOf(k) === itemId)
    const type = config.itemTypes.find(t => own.some(k => cardType(k) === t))
    if (!type) continue
    const options = own.filter(k => cardType(k) === type)
    itemCards.push(options[Math.floor(rand() * options.length)])
  }
  const sentenceCards = shuffle(unitCards.filter(k => !items.has(itemOf(k))), rand)

  const earlier = allowed.filter(k => earlierUnitIds.has(cardToUnit.get(k) ?? ''))
  const seen = shuffle(earlier.filter(k => cards[k] !== undefined), rand)
  const unseen = shuffle(earlier.filter(k => cards[k] === undefined), rand)
  const otherCount = config.itemCount - Math.round(config.itemCount * config.unitShare)
  const other = [...seen, ...unseen].slice(0, otherCount)

  const unitPart = [...itemCards, ...sentenceCards].slice(0, config.itemCount - other.length)
  return shuffle([...unitPart, ...other], rand)
}

export function scoreExam(
  results: Map<string, ReviewEntry['result']>,
  config: { passThreshold: number; passResults: string[] },
): ExamResult {
  const pass = new Set(config.passResults)
  const total = results.size
  const byType: Record<string, { correct: number; total: number }> = {}
  const missedCardKeys: string[] = []
  let correctCount = 0

  for (const [key, result] of results) {
    const type = cardType(key)
    if (!byType[type]) byType[type] = { correct: 0, total: 0 }
    byType[type].total++

    if (pass.has(result)) {
      correctCount++
      byType[type].correct++
    } else {
      missedCardKeys.push(key)
    }
  }

  const score = total > 0 ? correctCount / total : 0
  return {
    score,
    passed: score >= config.passThreshold,
    byType,
    missedCardKeys,
  }
}

/**
 * Exam results derived from the log, one per exam session. Only entries that carry the unit and
 * the exam size count (schema 3); the first answer per card is the one that is scored.
 */
export function examOutcomes(
  log: ReviewEntry[],
  config: { passThreshold: number; passResults: string[] },
): ExamOutcome[] {
  const pass = new Set(config.passResults)
  const sessions = new Map<string, { unit: string; size: number; t: number; first: Map<string, ReviewEntry['result']> }>()
  for (const entry of log) {
    if (entry.mode !== 'exam' || !entry.unit || !entry.examSize) continue
    let s = sessions.get(entry.session)
    if (!s) {
      s = { unit: entry.unit, size: entry.examSize, t: 0, first: new Map() }
      sessions.set(entry.session, s)
    }
    s.t = Math.max(s.t, Date.parse(entry.t))
    if (!s.first.has(entry.key)) s.first.set(entry.key, entry.result)
  }
  return [...sessions].map(([session, s]) => {
    const passedKeys = [...s.first].filter(([, r]) => pass.has(r)).map(([k]) => k)
    const score = passedKeys.length / s.size
    const complete = s.first.size >= s.size
    return { session, unit: s.unit, t: s.t, score, complete, passed: complete && score >= config.passThreshold, passedKeys }
  })
}

export function passedUnits(outcomes: ExamOutcome[]): Set<string> {
  return new Set(outcomes.filter(o => o.passed).map(o => o.unit))
}

export function bestExamScore(outcomes: ExamOutcome[], unitId: string): number | undefined {
  const scores = outcomes.filter(o => o.unit === unitId && o.complete).map(o => o.score)
  return scores.length > 0 ? Math.max(...scores) : undefined
}

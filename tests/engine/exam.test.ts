import { describe, it, expect } from 'vitest'
import {
  EXAM_ALLOWED_TYPES,
  bestExamScore,
  buildExamSession,
  examOutcomes,
  passedUnits,
  scoreExam,
  type ExamConfig,
  type ExamInput,
} from '../../src/engine/exam.ts'
import type { ReviewEntry } from '../../src/engine/review-log.ts'
import type { CardState } from '../../src/engine/srs.ts'

const CONFIG: ExamConfig = {
  itemCount: 15,
  unitShare: 0.6,
  passThreshold: 0.8,
  passResults: ['correct', 'almost'],
  itemTypes: ['translate-nl-it', 'conjugate'],
  allowHints: false,
}

// ─── EXAM_ALLOWED_TYPES ───────────────────────────────────────────────────────

describe('EXAM_ALLOWED_TYPES', () => {
  it('allows only typed exercise types', () => {
    for (const t of ['translate-nl-it', 'conjugate', 'cloze', 'dictation']) expect(EXAM_ALLOWED_TYPES.has(t)).toBe(true)
    for (const t of ['flashcard', 'article', 'mc-sentence', 'mc-word']) expect(EXAM_ALLOWED_TYPES.has(t)).toBe(false)
  })
})

// ─── buildExamSession ────────────────────────────────────────────────────────

function ids(unit: string, n: number, prefix = 'w'): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}_${unit}_${i}`)
}

function examInput(overrides: Partial<ExamInput> & { units: Record<string, string[]> }): ExamInput {
  const { units, ...rest } = overrides
  const cardToUnit = new Map<string, string>()
  for (const [unit, keys] of Object.entries(units)) keys.forEach(k => cardToUnit.set(k, unit))
  return {
    unitId: 'u02',
    unitItems: [],
    earlierUnitIds: new Set(['u01']),
    allCardKeys: [...cardToUnit.keys()],
    cardToUnit,
    cards: {},
    config: CONFIG,
    seed: 1,
    ...rest,
  }
}

describe('buildExamSession()', () => {
  it('asks one question per word or verb of the unit', () => {
    const words = ids('u02', 5)
    const verb = 'v_u02_0'
    const keys = [
      ...words.map(w => `translate-nl-it:${w}`),
      ...words.map(w => `article:${w}`),
      ...['io', 'tu', 'lui'].map(p => `conjugate:${verb}:presente:${p}`),
    ]
    const exam = buildExamSession(examInput({ units: { u02: keys }, unitItems: [...words, verb] }))
    for (const w of words) expect(exam).toContain(`translate-nl-it:${w}`)
    expect(exam.filter(k => k.startsWith(`conjugate:${verb}:`))).toHaveLength(1)
    expect(exam.some(k => k.startsWith('article:'))).toBe(false)
  })

  it('fills the unit share with sentence cards and the rest with earlier units', () => {
    const words = ids('u02', 3)
    const u02 = [...words.map(w => `translate-nl-it:${w}`), ...ids('u02', 10, 's').map(s => `cloze:${s}:0`)]
    const u01 = ids('u01', 10).map(w => `translate-nl-it:${w}`)
    const input = examInput({ units: { u01, u02 }, unitItems: words })
    const exam = buildExamSession(input)
    expect(exam).toHaveLength(CONFIG.itemCount)
    expect(exam.filter(k => input.cardToUnit.get(k) === 'u02')).toHaveLength(9)
    expect(exam.filter(k => input.cardToUnit.get(k) === 'u01')).toHaveLength(6)
  })

  it('never takes cards from later units, and uses the whole exam for the unit without earlier ones', () => {
    const words = ids('u01', 20)
    const u01 = words.map(w => `translate-nl-it:${w}`)
    const u02 = ids('u02', 10).map(w => `translate-nl-it:${w}`)
    const input = examInput({ units: { u01, u02 }, unitId: 'u01', unitItems: words, earlierUnitIds: new Set() })
    const exam = buildExamSession(input)
    expect(exam).toHaveLength(CONFIG.itemCount)
    expect(exam.every(k => input.cardToUnit.get(k) === 'u01')).toBe(true)
  })

  it('prefers cards from earlier units that were practised', () => {
    const u01 = ids('u01', 20).map(w => `translate-nl-it:${w}`)
    const seen: Record<string, CardState> = Object.fromEntries(
      u01.slice(0, 6).map(k => [k, { ease: 2.5, interval: 1, due: 0, reps: 1, lapses: 0 }]),
    )
    const input = examInput({ units: { u01, u02: ['translate-nl-it:w_u02_0'] }, unitItems: ['w_u02_0'], cards: seen })
    const other = buildExamSession(input).filter(k => input.cardToUnit.get(k) === 'u01')
    expect(other.sort()).toEqual(u01.slice(0, 6).sort())
  })

  it('is the same for the same seed and never longer than itemCount', () => {
    const words = ids('u02', 30)
    const input = examInput({ units: { u02: words.map(w => `translate-nl-it:${w}`) }, unitItems: words })
    expect(buildExamSession(input)).toEqual(buildExamSession(input))
    expect(buildExamSession(input).length).toBeLessThanOrEqual(CONFIG.itemCount)
  })

  it('returns an empty exam when no allowed cards exist', () => {
    expect(buildExamSession(examInput({ units: { u02: ['flashcard:w_u02_0'] }, unitItems: ['w_u02_0'] }))).toEqual([])
  })
})

// ─── scoreExam ───────────────────────────────────────────────────────────────

describe('scoreExam()', () => {
  it('counts the pass results and lists the missed cards', () => {
    const results = new Map<string, ReviewEntry['result']>([
      ['translate-nl-it:w_a', 'correct'],
      ['translate-nl-it:w_b', 'almost'],
      ['conjugate:v_a:presente:io', 'wrong'],
      ['cloze:s_a:0', 'correct'],
    ])
    const r = scoreExam(results, CONFIG)
    expect(r.score).toBe(0.75)
    expect(r.passed).toBe(false)
    expect(r.missedCardKeys).toEqual(['conjugate:v_a:presente:io'])
    expect(r.byType['translate-nl-it']).toEqual({ correct: 2, total: 2 })
  })

  it('passes at the threshold and scores an empty exam as 0', () => {
    const results = new Map<string, ReviewEntry['result']>(
      ['a', 'b', 'c', 'd', 'e'].map((k, i) => [`translate-nl-it:w_${k}`, i === 0 ? 'wrong' : 'correct']),
    )
    expect(scoreExam(results, CONFIG)).toMatchObject({ score: 0.8, passed: true })
    expect(scoreExam(new Map(), CONFIG)).toMatchObject({ score: 0, passed: false })
  })
})

// ─── examOutcomes ────────────────────────────────────────────────────────────

function examEntry(key: string, result: ReviewEntry['result'], session: string, extra: Partial<ReviewEntry> = {}): ReviewEntry {
  return {
    t: '2026-09-27T10:00:00Z', key, result, grade: 4, ms: 1, hint: false, session, mode: 'exam', cv: 'x',
    unit: 'u01', examSize: 5, ...extra,
  }
}

describe('examOutcomes()', () => {
  const five = (session: string, wrong: number) =>
    ['a', 'b', 'c', 'd', 'e'].map((k, i) => examEntry(`translate-nl-it:w_${k}`, i < wrong ? 'wrong' : 'correct', session))

  it('scores each exam session and marks it passed at the threshold', () => {
    const [pass, fail] = examOutcomes([...five('e1', 1), ...five('e2', 2)], CONFIG)
    expect(pass).toMatchObject({ session: 'e1', unit: 'u01', score: 0.8, complete: true, passed: true })
    expect(fail).toMatchObject({ session: 'e2', score: 0.6, passed: false })
    expect(pass.passedKeys).toHaveLength(4)
  })

  it('does not pass an exam that was not finished', () => {
    const [o] = examOutcomes(five('e1', 0).slice(0, 4), CONFIG)
    expect(o).toMatchObject({ complete: false, passed: false, score: 0.8 })
  })

  it('scores the first answer on a card', () => {
    const log = [...five('e1', 1), examEntry('translate-nl-it:w_a', 'correct', 'e1')]
    expect(examOutcomes(log, CONFIG)[0].score).toBe(0.8)
  })

  it('ignores exam entries without unit or size (older logs)', () => {
    const log = five('e1', 0).map(({ unit: _u, examSize: _s, ...e }) => e)
    expect(examOutcomes(log, CONFIG)).toEqual([])
  })

  it('derives the passed units and the best complete score', () => {
    const log = [...five('e1', 2), ...five('e2', 0), ...five('e3', 0).slice(0, 2).map(e => ({ ...e, unit: 'u02' }))]
    const outcomes = examOutcomes(log, CONFIG)
    expect(passedUnits(outcomes)).toEqual(new Set(['u01']))
    expect(bestExamScore(outcomes, 'u01')).toBe(1)
    expect(bestExamScore(outcomes, 'u02')).toBeUndefined()
  })
})

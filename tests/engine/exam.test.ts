import { describe, it, expect } from 'vitest'
import {
  EXAM_ALLOWED_TYPES,
  isExamAvailable,
  buildExamSession,
  scoreExam,
  type ExamConfig,
} from '../../src/engine/exam.ts'

const CONFIG: ExamConfig = {
  itemCount: 15,
  unitShare: 0.6,
  passThreshold: 0.8,
  availableFromMastery: 0.6,
  allowHints: false,
}

// ─── EXAM_ALLOWED_TYPES ───────────────────────────────────────────────────────

describe('EXAM_ALLOWED_TYPES', () => {
  it('excludes flashcard', () => {
    expect(EXAM_ALLOWED_TYPES.has('flashcard')).toBe(false)
  })

  it('excludes article', () => {
    expect(EXAM_ALLOWED_TYPES.has('article')).toBe(false)
  })

  it('includes translate-nl-it', () => {
    expect(EXAM_ALLOWED_TYPES.has('translate-nl-it')).toBe(true)
  })

  it('includes conjugate', () => {
    expect(EXAM_ALLOWED_TYPES.has('conjugate')).toBe(true)
  })

  it('includes cloze', () => {
    expect(EXAM_ALLOWED_TYPES.has('cloze')).toBe(true)
  })

  it('includes dictation', () => {
    expect(EXAM_ALLOWED_TYPES.has('dictation')).toBe(true)
  })
})

// ─── isExamAvailable ─────────────────────────────────────────────────────────

describe('isExamAvailable()', () => {
  it('returns true when mastery equals availableFromMastery', () => {
    expect(isExamAvailable(0.6, CONFIG)).toBe(true)
  })

  it('returns true when mastery exceeds availableFromMastery', () => {
    expect(isExamAvailable(0.9, CONFIG)).toBe(true)
  })

  it('returns false when mastery is below availableFromMastery', () => {
    expect(isExamAvailable(0.5, CONFIG)).toBe(false)
  })
})

// ─── buildExamSession ────────────────────────────────────────────────────────

describe('buildExamSession()', () => {
  const unitId = 'u01'

  // Helper: make card keys for a unit, with a given type
  function makeKeys(type: string, unit: string, count: number, prefix = 'w'): string[] {
    return Array.from({ length: count }, (_, i) => `${type}:${prefix}_${unit}_${i}`)
  }

  it('filters out flashcard keys', () => {
    const flashKeys = makeKeys('flashcard', 'u01', 5)
    const validKeys = makeKeys('translate-nl-it', 'u01', 5)
    const cardToUnit = new Map([
      ...flashKeys.map(k => [k, 'u01'] as [string, string]),
      ...validKeys.map(k => [k, 'u01'] as [string, string]),
    ])
    const result = buildExamSession(unitId, [...flashKeys, ...validKeys], cardToUnit, CONFIG)
    expect(result.some(k => k.startsWith('flashcard:'))).toBe(false)
  })

  it('filters out article keys', () => {
    const artKeys = makeKeys('article', 'u01', 5)
    const validKeys = makeKeys('translate-nl-it', 'u01', 5)
    const cardToUnit = new Map([
      ...artKeys.map(k => [k, 'u01'] as [string, string]),
      ...validKeys.map(k => [k, 'u01'] as [string, string]),
    ])
    const result = buildExamSession(unitId, [...artKeys, ...validKeys], cardToUnit, CONFIG)
    expect(result.some(k => k.startsWith('article:'))).toBe(false)
  })

  it('includes conjugate and cloze keys', () => {
    const conjKeys = makeKeys('conjugate', 'u01', 5, 'v')
    const clozeKeys = makeKeys('cloze', 'u01', 5, 's')
    const cardToUnit = new Map([
      ...conjKeys.map(k => [k, 'u01'] as [string, string]),
      ...clozeKeys.map(k => [k, 'u01'] as [string, string]),
    ])
    const result = buildExamSession(unitId, [...conjKeys, ...clozeKeys], cardToUnit, CONFIG)
    expect(result.some(k => k.startsWith('conjugate:'))).toBe(true)
    expect(result.some(k => k.startsWith('cloze:'))).toBe(true)
  })

  it('takes round(itemCount * unitShare) = 9 keys from the target unit', () => {
    // unitShare = 0.6 → round(15 * 0.6) = 9 from unit, 6 from other
    const unitKeys = makeKeys('translate-nl-it', 'u01', 12)
    const otherKeys = makeKeys('translate-nl-it', 'u02', 12)
    const cardToUnit = new Map([
      ...unitKeys.map(k => [k, 'u01'] as [string, string]),
      ...otherKeys.map(k => [k, 'u02'] as [string, string]),
    ])
    const result = buildExamSession(unitId, [...unitKeys, ...otherKeys], cardToUnit, CONFIG)
    const unitCount = result.filter(k => cardToUnit.get(k) === 'u01').length
    expect(unitCount).toBe(9)
  })

  it('takes itemCount - unitCount = 6 keys from other units', () => {
    const unitKeys = makeKeys('translate-nl-it', 'u01', 12)
    const otherKeys = makeKeys('translate-nl-it', 'u02', 12)
    const cardToUnit = new Map([
      ...unitKeys.map(k => [k, 'u01'] as [string, string]),
      ...otherKeys.map(k => [k, 'u02'] as [string, string]),
    ])
    const result = buildExamSession(unitId, [...unitKeys, ...otherKeys], cardToUnit, CONFIG)
    const otherCount = result.filter(k => cardToUnit.get(k) !== 'u01').length
    expect(otherCount).toBe(6)
  })

  it('does not crash when fewer unit cards than quota', () => {
    // Only 3 unit cards, but quota = 9 — should return 3 (no crash)
    const unitKeys = makeKeys('translate-nl-it', 'u01', 3)
    const otherKeys = makeKeys('translate-nl-it', 'u02', 6)
    const cardToUnit = new Map([
      ...unitKeys.map(k => [k, 'u01'] as [string, string]),
      ...otherKeys.map(k => [k, 'u02'] as [string, string]),
    ])
    expect(() => buildExamSession(unitId, [...unitKeys, ...otherKeys], cardToUnit, CONFIG)).not.toThrow()
  })

  it('returns empty array when no allowed cards available', () => {
    const flashKeys = makeKeys('flashcard', 'u01', 5)
    const cardToUnit = new Map(flashKeys.map(k => [k, 'u01'] as [string, string]))
    const result = buildExamSession(unitId, flashKeys, cardToUnit, CONFIG)
    expect(result).toEqual([])
  })

  it('total result never exceeds itemCount', () => {
    const unitKeys = makeKeys('translate-nl-it', 'u01', 20)
    const otherKeys = makeKeys('translate-nl-it', 'u02', 20)
    const cardToUnit = new Map([
      ...unitKeys.map(k => [k, 'u01'] as [string, string]),
      ...otherKeys.map(k => [k, 'u02'] as [string, string]),
    ])
    const result = buildExamSession(unitId, [...unitKeys, ...otherKeys], cardToUnit, CONFIG)
    expect(result.length).toBeLessThanOrEqual(CONFIG.itemCount)
  })
})

// ─── scoreExam ───────────────────────────────────────────────────────────────

describe('scoreExam()', () => {
  it('all correct → score = 1.0, passed = true', () => {
    const results = new Map([
      ['translate-nl-it:w_a', 'correct' as const],
      ['translate-nl-it:w_b', 'correct' as const],
    ])
    const r = scoreExam(results, CONFIG)
    expect(r.score).toBe(1)
    expect(r.passed).toBe(true)
  })

  it('all wrong → score = 0, passed = false', () => {
    const results = new Map([
      ['translate-nl-it:w_a', 'wrong' as const],
      ['translate-nl-it:w_b', 'wrong' as const],
    ])
    const r = scoreExam(results, CONFIG)
    expect(r.score).toBe(0)
    expect(r.passed).toBe(false)
  })

  it('almost counts as correct for scoring', () => {
    const results = new Map([
      ['translate-nl-it:w_a', 'almost' as const],
    ])
    const r = scoreExam(results, CONFIG)
    expect(r.score).toBe(1)
  })

  it('12 correct out of 15 → score = 0.8, passed = true', () => {
    const results = new Map<string, 'correct' | 'almost' | 'wrong'>([
      ...Array.from({ length: 12 }, (_, i) => [`translate-nl-it:w_${i}`, 'correct' as const]),
      ...Array.from({ length: 3 }, (_, i) => [`conjugate:v_${i}:p:io`, 'wrong' as const]),
    ])
    const r = scoreExam(results, CONFIG)
    expect(r.score).toBeCloseTo(0.8)
    expect(r.passed).toBe(true)
  })

  it('11 correct out of 15 → score < 0.8, passed = false', () => {
    const results = new Map<string, 'correct' | 'almost' | 'wrong'>([
      ...Array.from({ length: 11 }, (_, i) => [`translate-nl-it:w_${i}`, 'correct' as const]),
      ...Array.from({ length: 4 }, (_, i) => [`conjugate:v_${i}:p:io`, 'wrong' as const]),
    ])
    const r = scoreExam(results, CONFIG)
    expect(r.passed).toBe(false)
  })

  it('missedCardKeys contains only wrong entries', () => {
    const results = new Map([
      ['translate-nl-it:w_a', 'correct' as const],
      ['translate-nl-it:w_b', 'wrong' as const],
      ['conjugate:v_x:p:io', 'almost' as const],
    ])
    const r = scoreExam(results, CONFIG)
    expect(r.missedCardKeys).toEqual(['translate-nl-it:w_b'])
    expect(r.missedCardKeys).not.toContain('translate-nl-it:w_a')
    expect(r.missedCardKeys).not.toContain('conjugate:v_x:p:io')
  })

  it('byType counts correct and total per exercise type', () => {
    const results = new Map([
      ['translate-nl-it:w_a', 'correct' as const],
      ['translate-nl-it:w_b', 'wrong' as const],
      ['conjugate:v_x:p:io', 'correct' as const],
    ])
    const r = scoreExam(results, CONFIG)
    expect(r.byType['translate-nl-it']).toEqual({ correct: 1, total: 2 })
    expect(r.byType['conjugate']).toEqual({ correct: 1, total: 1 })
  })

  it('empty results → score = 0, not passed', () => {
    const r = scoreExam(new Map(), CONFIG)
    expect(r.score).toBe(0)
    expect(r.passed).toBe(false)
    expect(r.missedCardKeys).toEqual([])
  })
})

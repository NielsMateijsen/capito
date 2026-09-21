import { describe, it, expect } from 'vitest'
import { unitMastery, isUnitUnlocked, type UnlockConfig } from '../../src/engine/unlock.ts'
import type { CardState } from '../../src/engine/srs.ts'
import type { ProgressState } from '../../src/storage/types.ts'
import type { Unit } from '../../src/content/schemas.ts'

const CONFIG: UnlockConfig = {
  masteryThreshold: 0.8,
  minRepsPerCard: 2,
  requireExam: false,
  passThreshold: 0.8,
}

function makeCard(reps: number): CardState {
  return { ease: 2.5, interval: 1, due: 0, reps, lapses: 0 }
}

function makeProgress(
  cards: Record<string, CardState> = {},
  unitMeta: ProgressState['unitMeta'] = {},
): ProgressState {
  return {
    schema: 1,
    cards,
    reviewLog: [],
    introduced: [],
    unitMeta,
    flags: [],
    settings: {},
    meta: {},
  }
}

function makeUnit(id: string, requires: string[] = []): Unit {
  return {
    schema: 1,
    id,
    order: 1,
    title: id,
    canDo: ['doel 1', 'doel 2'],
    requires,
    words: [],
    verbs: [],
    sentences: [],
    dialogues: [],
    grammar: [],
    tenses: [],
    review: { status: 'draft' },
  }
}

// ─── unitMastery ─────────────────────────────────────────────────────────────

describe('unitMastery()', () => {
  it('returns 1 for empty card list (no content = fully mastered)', () => {
    expect(unitMastery([], {}, CONFIG)).toBe(1)
  })

  it('returns 0 when all cards have reps = 0', () => {
    const cards = { 'translate-it-nl:w_a': makeCard(0), 'translate-it-nl:w_b': makeCard(0) }
    expect(unitMastery(['translate-it-nl:w_a', 'translate-it-nl:w_b'], cards, CONFIG)).toBe(0)
  })

  it('returns 0 for cards not yet in progress', () => {
    expect(unitMastery(['translate-it-nl:w_a'], {}, CONFIG)).toBe(0)
  })

  it('returns 0.8 when 4 of 5 cards have reps >= minRepsPerCard', () => {
    const keys = Array.from({ length: 5 }, (_, i) => `translate-it-nl:w_${i}`)
    const cards: Record<string, CardState> = Object.fromEntries(
      keys.map((k, i) => [k, makeCard(i < 4 ? 2 : 0)])
    )
    expect(unitMastery(keys, cards, CONFIG)).toBeCloseTo(0.8)
  })

  it('returns 0.6 when 3 of 5 cards meet threshold', () => {
    const keys = Array.from({ length: 5 }, (_, i) => `translate-it-nl:w_${i}`)
    const cards: Record<string, CardState> = Object.fromEntries(
      keys.map((k, i) => [k, makeCard(i < 3 ? 2 : 0)])
    )
    expect(unitMastery(keys, cards, CONFIG)).toBeCloseTo(0.6)
  })

  it('returns 1 when all cards have reps >= minRepsPerCard', () => {
    const keys = ['translate-it-nl:w_a', 'translate-it-nl:w_b']
    const cards: Record<string, CardState> = Object.fromEntries(keys.map(k => [k, makeCard(3)]))
    expect(unitMastery(keys, cards, CONFIG)).toBe(1)
  })

  it('treats reps exactly at minRepsPerCard as mastered', () => {
    expect(unitMastery(['translate-it-nl:w_a'], { 'translate-it-nl:w_a': makeCard(2) }, CONFIG)).toBe(1)
  })

  it('treats reps = minRepsPerCard - 1 as not mastered', () => {
    expect(unitMastery(['translate-it-nl:w_a'], { 'translate-it-nl:w_a': makeCard(1) }, CONFIG)).toBe(0)
  })
})

// ─── isUnitUnlocked ──────────────────────────────────────────────────────────

describe('isUnitUnlocked()', () => {
  it('returns true for a unit with no requires (first unit)', () => {
    const unit = makeUnit('u01')
    expect(isUnitUnlocked(unit, new Map(), makeProgress(), CONFIG)).toBe(true)
  })

  it('returns false when required unit has mastery below threshold', () => {
    const unit = makeUnit('u02', ['u01'])
    const u01Keys = ['translate-it-nl:w_a', 'translate-it-nl:w_b', 'translate-it-nl:w_c']
    const cards: Record<string, CardState> = {
      'translate-it-nl:w_a': makeCard(2),
      'translate-it-nl:w_b': makeCard(2),
      'translate-it-nl:w_c': makeCard(0),  // not mastered → mastery = 2/3 ≈ 0.67 < 0.8
    }
    const keysByUnit = new Map([['u01', u01Keys]])
    expect(isUnitUnlocked(unit, keysByUnit, makeProgress(cards), CONFIG)).toBe(false)
  })

  it('returns true when required unit mastery meets threshold exactly', () => {
    const unit = makeUnit('u02', ['u01'])
    // 4 of 5 mastered = 0.8 = threshold
    const u01Keys = Array.from({ length: 5 }, (_, i) => `translate-it-nl:w_${i}`)
    const cards: Record<string, CardState> = Object.fromEntries(
      u01Keys.map((k, i) => [k, makeCard(i < 4 ? 2 : 0)])
    )
    const keysByUnit = new Map([['u01', u01Keys]])
    expect(isUnitUnlocked(unit, keysByUnit, makeProgress(cards), CONFIG)).toBe(true)
  })

  it('returns true when required unit is fully mastered', () => {
    const unit = makeUnit('u02', ['u01'])
    const u01Keys = ['translate-it-nl:w_a', 'translate-it-nl:w_b']
    const cards: Record<string, CardState> = Object.fromEntries(u01Keys.map(k => [k, makeCard(3)]))
    const keysByUnit = new Map([['u01', u01Keys]])
    expect(isUnitUnlocked(unit, keysByUnit, makeProgress(cards), CONFIG)).toBe(true)
  })

  it('returns false when one of multiple requires is not mastered', () => {
    const unit = makeUnit('u03', ['u01', 'u02'])
    const u01Keys = ['translate-it-nl:w_a']
    const u02Keys = ['translate-it-nl:w_b']
    const cards: Record<string, CardState> = {
      'translate-it-nl:w_a': makeCard(3),  // u01 mastered
      'translate-it-nl:w_b': makeCard(0),  // u02 not mastered
    }
    const keysByUnit = new Map([['u01', u01Keys], ['u02', u02Keys]])
    expect(isUnitUnlocked(unit, keysByUnit, makeProgress(cards), CONFIG)).toBe(false)
  })

  it('requireExam: false — no exam needed even if examBest is undefined', () => {
    const unit = makeUnit('u02', ['u01'])
    const u01Keys = ['translate-it-nl:w_a']
    const cards: Record<string, CardState> = { 'translate-it-nl:w_a': makeCard(3) }
    const keysByUnit = new Map([['u01', u01Keys]])
    const cfg: UnlockConfig = { ...CONFIG, requireExam: false }
    expect(isUnitUnlocked(unit, keysByUnit, makeProgress(cards), cfg)).toBe(true)
  })

  it('requireExam: true — locked when examBest is missing', () => {
    const unit = makeUnit('u02', ['u01'])
    const u01Keys = ['translate-it-nl:w_a']
    const cards: Record<string, CardState> = { 'translate-it-nl:w_a': makeCard(3) }
    const keysByUnit = new Map([['u01', u01Keys]])
    const cfg: UnlockConfig = { ...CONFIG, requireExam: true }
    expect(isUnitUnlocked(unit, keysByUnit, makeProgress(cards), cfg)).toBe(false)
  })

  it('requireExam: true — locked when examBest < passThreshold', () => {
    const unit = makeUnit('u02', ['u01'])
    const u01Keys = ['translate-it-nl:w_a']
    const cards: Record<string, CardState> = { 'translate-it-nl:w_a': makeCard(3) }
    const keysByUnit = new Map([['u01', u01Keys]])
    const cfg: UnlockConfig = { ...CONFIG, requireExam: true, passThreshold: 0.8 }
    const progress = makeProgress(cards, { u01: { examBest: 0.7 } })
    expect(isUnitUnlocked(unit, keysByUnit, progress, cfg)).toBe(false)
  })

  it('requireExam: true — unlocked when mastery ok and examBest >= passThreshold', () => {
    const unit = makeUnit('u02', ['u01'])
    const u01Keys = ['translate-it-nl:w_a']
    const cards: Record<string, CardState> = { 'translate-it-nl:w_a': makeCard(3) }
    const keysByUnit = new Map([['u01', u01Keys]])
    const cfg: UnlockConfig = { ...CONFIG, requireExam: true, passThreshold: 0.8 }
    const progress = makeProgress(cards, { u01: { examBest: 0.8 } })
    expect(isUnitUnlocked(unit, keysByUnit, progress, cfg)).toBe(true)
  })

  it('treats missing required unit card list as empty (mastery = 1)', () => {
    const unit = makeUnit('u02', ['u01'])
    // No entry for 'u01' in keysByUnit → empty → mastery = 1 >= 0.8 → unlocked
    expect(isUnitUnlocked(unit, new Map(), makeProgress(), CONFIG)).toBe(true)
  })
})

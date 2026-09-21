import { describe, it, expect } from 'vitest'
import { schedule } from '../../src/engine/srs.ts'
import type { CardState, SrsConfig } from '../../src/engine/srs.ts'

const cfg: SrsConfig = { startEase: 2.5, minEase: 1.3, maxIntervalDays: 180 }
const NOW = 0
const DAY = 86_400_000

function state(ease: number, interval: number, reps: number, lapses: number): CardState {
  return { ease, interval, due: 0, reps, lapses }
}

describe('new card', () => {
  it('correct (grade 4) → reps=1, interval=1, ease=startEase', () => {
    const r = schedule(null, 4, NOW, cfg)
    expect(r.reps).toBe(1)
    expect(r.interval).toBe(1)
    expect(r.due).toBe(1 * DAY)
    expect(r.lapses).toBe(0)
    expect(r.ease).toBeCloseTo(2.5, 10)
  })

  it('wrong (grade 1) → reps=0, lapses=1, ease decreases but ≥ minEase', () => {
    const r = schedule(null, 1, NOW, cfg)
    expect(r.reps).toBe(0)
    expect(r.interval).toBe(1)
    expect(r.lapses).toBe(1)
    expect(r.ease).toBeCloseTo(1.96, 5)
  })
})

describe('correct review sequence', () => {
  const s1 = state(2.5, 1, 1, 0)
  const s2 = state(2.5, 6, 2, 0)

  it('second correct (reps=1) → interval=6', () => {
    const r = schedule(s1, 4, NOW, cfg)
    expect(r.interval).toBe(6)
    expect(r.reps).toBe(2)
    expect(r.ease).toBeCloseTo(2.5, 10)
  })

  it('third correct (reps=2) → interval=round(6×2.5)=15', () => {
    const r = schedule(s2, 4, NOW, cfg)
    expect(r.interval).toBe(15)
    expect(r.reps).toBe(3)
    expect(r.ease).toBeCloseTo(2.5, 10)
  })

  it('due = now + interval × DAY', () => {
    const r = schedule(s2, 4, NOW, cfg)
    expect(r.due).toBe(15 * DAY)
  })
})

describe('lapse', () => {
  const s3 = state(2.5, 15, 3, 0)
  const s4 = state(1.3, 5, 2, 3)

  it('resets interval to 1 and reps to 0, increments lapses', () => {
    const r = schedule(s3, 1, NOW, cfg)
    expect(r.interval).toBe(1)
    expect(r.reps).toBe(0)
    expect(r.lapses).toBe(1)
    expect(r.ease).toBeCloseTo(1.96, 5)
  })

  it('ease does not drop below minEase', () => {
    const r = schedule(s4, 1, NOW, cfg)
    expect(r.ease).toBeCloseTo(1.3, 10)
    expect(r.lapses).toBe(4)
  })
})

describe('flashcard grades', () => {
  const s2 = state(2.5, 6, 2, 0)

  it('almost (grade 3) → ease decreases by 0.14', () => {
    const r = schedule(s2, 3, NOW, cfg)
    expect(r.ease).toBeCloseTo(2.36, 5)
    expect(r.interval).toBe(15)
    expect(r.reps).toBe(3)
  })

  it('easy (grade 5) → ease increases by 0.10', () => {
    const r = schedule(s2, 5, NOW, cfg)
    expect(r.ease).toBeCloseTo(2.6, 10)
    expect(r.interval).toBe(15)
    expect(r.reps).toBe(3)
  })
})

describe('maxIntervalDays cap', () => {
  it('interval capped at maxIntervalDays', () => {
    const s_big = state(2.5, 100, 10, 0)
    const r = schedule(s_big, 4, NOW, cfg)
    expect(r.interval).toBe(180)
  })
})

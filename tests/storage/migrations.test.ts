import { describe, it, expect } from 'vitest'
import { migrate, exportJson, importJson, CURRENT_SCHEMA } from '../../src/storage/migrations.ts'
import { defaultState } from '../../src/storage/progress-store.ts'
import type { MigrationMap } from '../../src/storage/migrations.ts'

describe('migrate()', () => {
  it('already at target schema → returns unchanged', () => {
    const state = defaultState()
    const result = migrate(state, {}, 1)
    expect(result).toEqual(state)
  })

  it('dummy schema-2 migration applies extra field', () => {
    const dummy: MigrationMap = {
      1: (s) => ({ ...s, schema: 2, extra: 'added' }),
    }
    const result = migrate({ ...defaultState(), schema: 1 }, dummy, 2)
    expect(result.schema).toBe(2)
    expect((result as unknown as Record<string, unknown>)['extra']).toBe('added')
  })

  it('multi-step migration 1→2→3 applies both steps', () => {
    const multi: MigrationMap = {
      1: (s) => ({ ...s, schema: 2, stepA: true }),
      2: (s) => ({ ...s, schema: 3, stepB: true }),
    }
    const result = migrate({ ...defaultState(), schema: 1 }, multi, 3)
    const r = result as unknown as Record<string, unknown>
    expect(r['schema']).toBe(3)
    expect(r['stepA']).toBe(true)
    expect(r['stepB']).toBe(true)
  })

  it('missing migration throws an error', () => {
    expect(() => migrate({ schema: 0 }, {}, 1)).toThrow('No migration from schema 0 to 1')
  })
})

describe('export → import roundtrip', () => {
  it('exportJson then importJson preserves all data exactly', () => {
    const state = defaultState()
    const json = exportJson(state)
    const restored = importJson(json)
    expect(restored).toEqual(state)
  })

  it('roundtrip with non-empty reviewLog and cards', () => {
    const state = defaultState()
    state.reviewLog = [{
      t: '2026-01-01T10:00:00Z',
      key: 'translate-nl-it:w_test',
      result: 'correct',
      grade: 4,
      ms: 1500,
      hint: false,
      session: 's1',
      mode: 'daily',
      cv: '1',
    }]
    state.introduced = ['w_test']
    state.settings = { autoplayAudio: true }

    const restored = importJson(exportJson(state))
    expect(restored).toEqual(state)
  })
})

describe('schema 1 → 2 (separate daily limits for new words and new review cards)', () => {
  const v1 = {
    schema: 1,
    cards: {},
    reviewLog: [],
    introduced: ['w_test'],
    unitMeta: {},
    flags: [],
    settings: { newCardsPerDay: 12, autoplayAudio: true },
    meta: {},
  }

  it('is the current schema', () => {
    expect(CURRENT_SCHEMA).toBe(2)
    expect(defaultState().schema).toBe(2)
  })

  it('keeps newCardsPerDay as the limit for new review cards and adds no word limit', () => {
    const result = migrate(structuredClone(v1))
    expect(result.schema).toBe(2)
    expect(result.settings).toEqual({ newCardsPerDay: 12, autoplayAudio: true })
    expect(result.settings.newItemsPerDay).toBeUndefined()
    expect(result.introduced).toEqual(['w_test'])
  })

  it('imports a schema-1 backup', () => {
    const restored = importJson(JSON.stringify(v1))
    expect(restored.schema).toBe(2)
    expect(restored.settings.newCardsPerDay).toBe(12)
  })

  it('roundtrips both daily limits', () => {
    const state = { ...defaultState(), settings: { newCardsPerDay: 8, newItemsPerDay: 3 } }
    expect(importJson(exportJson(state))).toEqual(state)
  })
})

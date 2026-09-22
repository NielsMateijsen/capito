import { describe, it, expect } from 'vitest'
import { migrate, exportJson, importJson } from '../../src/storage/migrations.ts'
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
    const result = migrate(defaultState(), dummy, 2)
    expect(result.schema).toBe(2)
    expect((result as unknown as Record<string, unknown>)['extra']).toBe('added')
  })

  it('multi-step migration 1→2→3 applies both steps', () => {
    const multi: MigrationMap = {
      1: (s) => ({ ...s, schema: 2, stepA: true }),
      2: (s) => ({ ...s, schema: 3, stepB: true }),
    }
    const result = migrate(defaultState(), multi, 3)
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

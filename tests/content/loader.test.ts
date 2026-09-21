import { describe, it, expect } from 'vitest'
import { loadUnits, loadTenses } from '../../src/content/loader.ts'

describe('loadUnits', () => {
  it('loads u01_greetings without validation errors', () => {
    const units = loadUnits()
    const u01 = units.find(u => u.id === 'u01_greetings')
    expect(u01).toBeDefined()
    expect(u01!.schema).toBe(1)
    expect(u01!.order).toBe(1)
    expect(u01!.canDo.length).toBeGreaterThanOrEqual(2)
    expect(u01!.canDo.length).toBeLessThanOrEqual(4)
  })

  it('u01 has words and at least one verb', () => {
    const units = loadUnits()
    const u01 = units.find(u => u.id === 'u01_greetings')!
    expect(u01.words.length).toBeGreaterThan(0)
    expect(u01.verbs.length).toBeGreaterThan(0)
  })

  it('u01 sentences only reference IDs defined in the unit', () => {
    const units = loadUnits()
    const u01 = units.find(u => u.id === 'u01_greetings')!
    const knownIds = new Set([
      ...u01.words.map(w => w.id),
      ...u01.verbs.map(v => v.id),
    ])
    for (const s of u01.sentences) {
      for (const ref of s.uses) {
        expect(knownIds.has(ref), `sentence ${s.id} uses unknown ID "${ref}"`).toBe(true)
      }
    }
  })
})

describe('loadTenses', () => {
  it('loads the presente tense', () => {
    const tenses = loadTenses()
    const presente = tenses.find(t => t.id === 'presente')
    expect(presente).toBeDefined()
    expect(presente!.kind).toBe('simple')
    expect(presente!.endings['are']).toBeDefined()
  })
})

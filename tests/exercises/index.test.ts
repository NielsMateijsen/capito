import { describe, it, expect } from 'vitest'
import { exercises, exerciseMap } from '../../src/exercises/index.ts'

describe('exercise registry', () => {
  it('discovers the flashcard exercise', () => {
    expect(exerciseMap.has('flashcard')).toBe(true)
  })

  it('discovers the translate-it-nl exercise', () => {
    expect(exerciseMap.has('translate-it-nl')).toBe(true)
  })

  it('all discovered exercises have the required fields', () => {
    for (const ex of exercises) {
      expect(typeof ex.id).toBe('string')
      expect(typeof ex.typoTolerance).toBe('boolean')
      expect(typeof ex.cards).toBe('function')
      expect(typeof ex.build).toBe('function')
      expect(typeof ex.check).toBe('function')
    }
  })
})

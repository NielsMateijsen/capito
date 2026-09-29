import { describe, it, expect } from 'vitest'
import { exercises } from '../../src/exercises/index.ts'
import { exerciseUi, KNOWN_EXERCISE_TYPES } from '../../src/ui/exercise-ui.ts'

describe('exercise UI metadata', () => {
  it('gives every registered exercise type a question label', () => {
    for (const ex of exercises) {
      expect(exerciseUi(ex.id)?.label, `no label for exercise type "${ex.id}" in src/ui/exercise-ui.ts`).toBeTruthy()
    }
  })

  it('knows no types that do not exist', () => {
    const ids = new Set(exercises.map(e => e.id))
    expect(KNOWN_EXERCISE_TYPES.filter(t => !ids.has(t))).toEqual([])
  })
})

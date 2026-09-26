import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { exercises, exerciseMap } from '../../src/exercises/index.ts'

const DIR = join(process.cwd(), 'src', 'exercises')

describe('exercise registry', () => {
  it('discovers the flashcard exercise', () => {
    expect(exerciseMap.has('flashcard')).toBe(true)
  })

  it('discovers the translate-it-nl exercise', () => {
    expect(exerciseMap.has('translate-it-nl')).toBe(true)
  })

  // The e2e smoke test (e2e/support/exercise-types.ts) derives the type ids from the file names
  it('registers every exercise file under its file name', () => {
    const files = readdirSync(DIR)
      .filter(f => f.endsWith('.ts') && f !== 'index.ts')
      .filter(f => /^export default /m.test(readFileSync(join(DIR, f), 'utf8')))
      .map(f => f.replace(/\.ts$/, ''))
    expect(exercises.map(e => e.id).sort()).toEqual(files.sort())
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

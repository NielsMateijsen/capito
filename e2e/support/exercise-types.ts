import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const DIR = fileURLToPath(new URL('../../src/exercises/', import.meta.url))

/**
 * Exercise types registered in src/exercises/: every file with a default export
 * (the same files src/exercises/index.ts collects).
 */
export function registeredExerciseTypes(): string[] {
  return readdirSync(DIR)
    .filter(f => f.endsWith('.ts') && f !== 'index.ts')
    .filter(f => /^export default /m.test(readFileSync(DIR + f, 'utf8')))
    .map(f => f.replace(/\.ts$/, ''))
    .sort()
}

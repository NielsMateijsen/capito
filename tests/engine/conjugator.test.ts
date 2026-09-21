import { describe, it, expect } from 'vitest'
import goldenFile from '../golden/conjugation-presente.json'
import presenteRaw from '../../content/tenses/presente.json'
import { TenseSchema } from '../../src/content/schemas.ts'
import { conjugate } from '../../src/engine/conjugator.ts'
import type { Person } from '../../src/engine/conjugator.ts'

const tense = TenseSchema.parse(presenteRaw)
const PERSONS: Person[] = ['io', 'tu', 'lui', 'noi', 'voi', 'loro']

for (const c of goldenFile.cases) {
  describe(`conjugate ${c.verb} (${c.conj})`, () => {
    const verb = {
      id: `v_${c.verb}`,
      inf: c.verb,
      nl: [],
      conj: c.conj as 'are' | 'ere' | 'ire' | 'ire_isc' | 'irregular',
      irregular: c.conj === 'irregular'
        ? { presente: c.forms as Record<string, string> }
        : undefined,
      reflexive: ('reflexive' in c && c.reflexive === true) ? true : undefined,
    }

    for (const person of PERSONS) {
      const expected = c.forms[person as keyof typeof c.forms]
      it(`${person} → "${expected}"`, () => {
        expect(conjugate(verb, tense, person)).toBe(expected)
      })
    }
  })
}

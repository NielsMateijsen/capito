import type { Verb, Tense } from '../content/schemas.ts'

export type Person = 'io' | 'tu' | 'lui' | 'noi' | 'voi' | 'loro'

const REFLEXIVE_PRONOUNS: Record<Person, string> = {
  io: 'mi', tu: 'ti', lui: 'si', noi: 'ci', voi: 'vi', loro: 'si',
}

export function conjugate(verb: Verb, tense: Tense, person: Person): string {
  // 1. Irregular lookup
  const irregularForms = verb.irregular?.[tense.id]
  if (irregularForms) {
    return irregularForms[person]
  }

  // 2. Stem
  const stem = verb.reflexive
    ? verb.inf.replace(/si$/, 'e').slice(0, -3)
    : verb.inf.slice(0, -3)

  // 3. Ending from tense file
  const ending = tense.endings[verb.conj]?.[person]
  if (ending === undefined) {
    throw new Error(`No ending for conj="${verb.conj}" person="${person}" in tense "${tense.id}"`)
  }

  // 4. Spelling rules
  let form: string
  const lastStemChar = stem.at(-1)
  const firstEndingChar = ending.at(0) ?? ''

  if (verb.conj === 'are' && (lastStemChar === 'c' || lastStemChar === 'g') && (firstEndingChar === 'i' || firstEndingChar === 'e')) {
    // -care/-gare: insert 'h' to preserve hard consonant (only for -are class)
    form = stem + 'h' + ending
  } else if (lastStemChar === 'i' && firstEndingChar === 'i') {
    // -iare: drop duplicate 'i' from stem
    form = stem.slice(0, -1) + ending
  } else {
    form = stem + ending
  }

  // 5. Reflexive pronoun
  if (verb.reflexive) {
    return `${REFLEXIVE_PRONOUNS[person]} ${form}`
  }

  return form
}

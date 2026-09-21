import { conjugate as engineConjugate } from '../engine/conjugator.ts'
import type { Person } from '../engine/conjugator.ts'
import { check as engineCheck } from '../engine/checker.ts'
import type { CheckerConfig } from '../engine/checker.ts'
import type { Verb, Tense } from '../content/schemas.ts'
import type { Content, Exercise, ExerciseModule, ReviewResult } from './types.ts'

const TYPE = 'conjugate'
const PERSONS: Person[] = ['io', 'tu', 'lui', 'noi', 'voi', 'loro']

function hasFormsFor(verb: Verb, tense: Tense): boolean {
  if (verb.irregular?.[tense.id]) return true
  if (verb.conj === 'irregular') return false
  return tense.endings[verb.conj] !== undefined
}

function cards(content: Content): string[] {
  const keys: string[] = []
  for (const verb of content.verbs.values()) {
    for (const tense of content.tenses.values()) {
      if (!hasFormsFor(verb, tense)) continue
      for (const person of PERSONS) {
        keys.push(`${TYPE}:${verb.id}:${tense.id}:${person}`)
      }
    }
  }
  return keys
}

function build(cardKey: string, content: Content): Exercise {
  const [, verbId, tenseId, person] = cardKey.split(':')
  const verb = content.verbs.get(verbId)
  if (!verb) throw new Error(`Unknown verb id: ${verbId}`)
  const tense = content.tenses.get(tenseId)
  if (!tense) throw new Error(`Unknown tense id: ${tenseId}`)
  const form = engineConjugate(verb, tense, person as Person)
  return { cardKey, typeId: TYPE, prompt: verb.inf, hint: person, answers: [form] }
}

function check(input: string, exercise: Exercise, config: CheckerConfig): ReviewResult {
  return engineCheck(input, exercise.answers, 'conjugation', config)
}

const exercise: ExerciseModule = { id: TYPE, typoTolerance: false, cards, build, check }
export default exercise

import type { Word, Verb, Sentence, Tense, Unit } from '../content/schemas.ts'
import type { CheckerConfig } from '../engine/checker.ts'

export interface Content {
  words: Map<string, Word>
  verbs: Map<string, Verb>
  sentences: Map<string, Sentence>
  tenses: Map<string, Tense>
  units: Unit[]
}

export type ReviewResult = 'correct' | 'almost' | 'wrong' | 'again' | 'good' | 'easy'

export interface Exercise {
  cardKey: string
  typeId: string
  prompt: string
  answers: string[]
  hint?: string
}

export interface ExerciseModule {
  id: string
  typoTolerance: boolean
  cards(content: Content): string[]
  build(cardKey: string, content: Content): Exercise
  check(input: string, exercise: Exercise, config: CheckerConfig): ReviewResult
}

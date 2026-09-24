import type { Word, Verb, Sentence, Tense, Unit } from '../content/schemas.ts'
import type { CheckerConfig } from '../engine/checker.ts'
import type { Span } from '../engine/sentences.ts'

export interface Content {
  words: Map<string, Word>
  verbs: Map<string, Verb>
  sentences: Map<string, Sentence>
  tenses: Map<string, Tense>
  units: Unit[]
}

export type ReviewResult = 'correct' | 'almost' | 'wrong' | 'again' | 'good' | 'easy'

export interface SentenceView {
  it: string
  nl: string
  span: Span
  mode: 'highlight' | 'gap'
}

export interface Exercise {
  cardKey: string
  typeId: string
  prompt: string
  answers: string[]
  hint?: string
  /** Multiple choice: the options to pick from (answers[0] is one of them). */
  options?: string[]
  sentence?: SentenceView
  /** Answers that count as 'almost' (e.g. the noun without its article). */
  partialAnswers?: string[]
  withArticle?: boolean
  /** Italian text to speak for this exercise. */
  audio?: string
}

export interface BuildContext {
  /** Number of earlier answers on this item; rotates sentences and option order. */
  seq: number
  optionCount?: number
}

export interface ExerciseModule {
  id: string
  typoTolerance: boolean
  cards(content: Content): string[]
  build(cardKey: string, content: Content, ctx?: BuildContext): Exercise
  check(input: string, exercise: Exercise, config: CheckerConfig): ReviewResult
  requires?(cardKey: string, content: Content): string[]
}

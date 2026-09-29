import { S } from './strings.nl.ts'

/**
 * What the exercise screen knows per exercise type. A new type (see the /add-exercise-type skill)
 * adds its entry here: without a label the question has no instruction.
 */
interface ExerciseUi {
  /** What to do, shown above every question. */
  label: string
  /** The prompt is Italian (gets lang="it"). */
  italianPrompt?: boolean
  /** The audio is the prompt itself, so it may play before answering. */
  promptAudio?: boolean
  /** The expected answer is Dutch (no lang="it" on the answer). */
  dutchAnswer?: boolean
  /** A hint would give the whole answer away. */
  noHint?: boolean
}

const EXERCISE_UI: Record<string, ExerciseUi> = {
  'mc-sentence': { label: S.MC_SENTENCE_QUESTION },
  'mc-word': { label: S.MC_WORD_QUESTION },
  'cloze-word': { label: S.CLOZE_WORD_QUESTION },
  'article': { label: S.ARTICLE_QUESTION, noHint: true },
  'dictation': { label: S.DICTATION_QUESTION },
  'translate-nl-it': { label: S.TRANSLATE_NL_IT_QUESTION },
  'translate-it-nl': { label: S.TRANSLATE_IT_NL_QUESTION, italianPrompt: true, promptAudio: true, dutchAnswer: true },
  'conjugate': { label: S.CONJUGATE_QUESTION, italianPrompt: true },
  'cloze': { label: S.CLOZE_QUESTION, italianPrompt: true },
  'flashcard': { label: S.FLASHCARD_QUESTION, italianPrompt: true, promptAudio: true, dutchAnswer: true },
}

export function exerciseUi(typeId: string): ExerciseUi | undefined {
  return EXERCISE_UI[typeId]
}

/** Types the exercise screen knows about; a test checks that every registered type is among them. */
export const KNOWN_EXERCISE_TYPES = Object.keys(EXERCISE_UI)

import { describe, it, expect } from 'vitest'
import { isRetypeCorrect } from '../../src/exercises/choice.ts'
import translateNlIt from '../../src/exercises/translate-nl-it.ts'
import clozeWord from '../../src/exercises/cloze-word.ts'
import type { CheckerConfig } from '../../src/engine/checker.ts'
import { makeContent } from './helpers.ts'
import { ladderSentences, ladderUnit, tense_presente, verb_essere, word_caffe_accent, word_ciao, word_signora } from './fixtures.ts'

const config: CheckerConfig = { typoMinLength: 5, typoMaxDistance: 1 }

describe('isRetypeCorrect()', () => {
  const content = makeContent({ words: [word_caffe_accent] })
  const ex = translateNlIt.build('translate-nl-it:w_caffe_accent', content)

  it('accepts the correct answer, ignoring case and surrounding spaces', () => {
    expect(isRetypeCorrect(translateNlIt, `  ${ex.answers[0].toUpperCase()} `, ex, config)).toBe(true)
  })

  it('rejects an empty or wrong answer', () => {
    expect(isRetypeCorrect(translateNlIt, '', ex, config)).toBe(false)
    expect(isRetypeCorrect(translateNlIt, 'x', ex, config)).toBe(false)
  })

  it('rejects an answer that is only almost right', () => {
    expect(isRetypeCorrect(translateNlIt, word_caffe_accent.it, ex, config)).toBe(false)
  })

  it('works for a sentence cloze', () => {
    const c = makeContent({ words: [word_ciao, word_signora], verbs: [verb_essere], sentences: ladderSentences, tenses: [tense_presente], units: [ladderUnit] })
    const cloze = clozeWord.build('cloze-word:w_signora', c, { seq: 0 })
    expect(isRetypeCorrect(clozeWord, cloze.answers[0], cloze, config)).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import mcSentence from '../../src/exercises/mc-sentence.ts'
import mcWord from '../../src/exercises/mc-word.ts'
import clozeWord from '../../src/exercises/cloze-word.ts'
import dictation from '../../src/exercises/dictation.ts'
import { pickSentence } from '../../src/engine/sentences.ts'
import type { CheckerConfig } from '../../src/engine/checker.ts'
import { makeContent } from './helpers.ts'
import { ladderSentences, ladderUnit, tense_presente, verb_essere, word_ciao, word_signora } from './fixtures.ts'

const config: CheckerConfig = { typoMinLength: 5, typoMaxDistance: 1 }
const content = makeContent({
  words: [word_ciao, word_signora],
  verbs: [verb_essere],
  sentences: ladderSentences,
  tenses: [tense_presente],
  units: [ladderUnit],
})
const forms = verb_essere.irregular!.presente

describe('mc-sentence', () => {
  it('creates a card per word and verb that has a sentence', () => {
    expect(mcSentence.cards(content)).toEqual(['mc-sentence:w_ciao', 'mc-sentence:w_signora', 'mc-sentence:v_essere'])
  })

  it('shows the Italian sentence with the item highlighted and Dutch options', () => {
    const ex = mcSentence.build('mc-sentence:v_essere', content, { seq: 0, optionCount: 4 })
    const expected = pickSentence(verb_essere.id, content, 0)!
    expect(ex.prompt).toBe(expected.sentence.it)
    expect(ex.sentence).toMatchObject({ mode: 'highlight', span: expected.span, nl: expected.sentence.nl[0] })
    expect(ex.answers).toEqual([expected.sentence.nl[0]])
    expect(ex.options).toHaveLength(4)
    expect(ex.options).toContain(ex.answers[0])
    expect(ex.audio).toBe(expected.sentence.it)
  })

  it('uses a different sentence for a different seq', () => {
    const a = mcSentence.build('mc-sentence:v_essere', content, { seq: 0, optionCount: 4 })
    const b = mcSentence.build('mc-sentence:v_essere', content, { seq: 1, optionCount: 4 })
    expect(a.prompt).not.toBe(b.prompt)
  })

  it('checks the chosen option exactly', () => {
    const ex = mcSentence.build('mc-sentence:w_ciao', content, { seq: 0, optionCount: 4 })
    expect(mcSentence.check(ex.answers[0], ex, config)).toBe('correct')
    const other = ex.options!.find(o => o !== ex.answers[0])!
    expect(mcSentence.check(other, ex, config)).toBe('wrong')
  })

  it('throws for an item without sentences', () => {
    expect(() => mcSentence.build('mc-sentence:w_unknown', content)).toThrow()
  })
})

describe('mc-word', () => {
  it('shows the Dutch sentence and the Italian sentence with a gap', () => {
    const ex = mcWord.build('mc-word:v_essere', content, { seq: 0, optionCount: 4 })
    const expected = pickSentence(verb_essere.id, content, 0)!
    expect(ex.sentence).toMatchObject({ mode: 'gap', nl: expected.sentence.nl[0] })
    expect(ex.prompt).toContain('___')
    expect(ex.prompt).not.toBe(expected.sentence.it)
    expect(Object.values(forms)).toContain(ex.answers[0])
  })

  it('offers other forms of the verb as options', () => {
    const ex = mcWord.build('mc-word:v_essere', content, { seq: 0, optionCount: 4 })
    expect(ex.options).toHaveLength(4)
    for (const o of ex.options!) expect([verb_essere.inf, ...Object.values(forms)]).toContain(o)
  })

  it('lowercases a capitalised target', () => {
    const ex = mcWord.build('mc-word:w_ciao', content, { seq: 0, optionCount: 3 })
    expect(ex.answers).toEqual([word_ciao.it])
    expect(mcWord.check(word_ciao.it, ex, config)).toBe('correct')
  })

  it('has no typo tolerance', () => {
    expect(mcWord.typoTolerance).toBe(false)
  })
})

describe('cloze-word', () => {
  it('asks to type the missing word, without options', () => {
    const ex = clozeWord.build('cloze-word:w_signora', content, { seq: 0 })
    expect(ex.options).toBeUndefined()
    expect(ex.sentence?.mode).toBe('gap')
    expect(clozeWord.check(ex.answers[0], ex, config)).toBe('correct')
    expect(clozeWord.check(ex.answers[0].toUpperCase(), ex, config)).toBe('correct')
  })

  it('has no typo tolerance', () => {
    const ex = clozeWord.build('cloze-word:w_signora', content, { seq: 0 })
    expect(clozeWord.typoTolerance).toBe(false)
    expect(clozeWord.check(ex.answers[0].slice(0, -1) + 'x', ex, config)).toBe('wrong')
  })

  it('uses the same card key for every sentence of the item', () => {
    expect(clozeWord.cards(content)).toEqual(['cloze-word:w_ciao', 'cloze-word:w_signora', 'cloze-word:v_essere'])
  })
})

describe('dictation.requires()', () => {
  it('requires every item used in the sentence', () => {
    expect(dictation.requires!('dictation:s_l_002', content)).toEqual(['w_ciao', 'v_essere'])
  })
})

import { describe, it, expect } from 'vitest'
import flashcard from '../../src/exercises/flashcard.ts'
import { makeContent } from './helpers.ts'
import { word_caffe, word_ciao, verb_essere, sentence_s001 } from './fixtures.ts'
import type { CheckerConfig } from '../../src/engine/checker.ts'

const config: CheckerConfig = { typoMinLength: 5, typoMaxDistance: 1 }

describe('flashcard.cards()', () => {
  it('generates a card key for each word', () => {
    const content = makeContent({ words: [word_caffe, word_ciao] })
    const keys = flashcard.cards(content)
    expect(keys).toContain('flashcard:w_caffe')
    expect(keys).toContain('flashcard:w_ciao')
    expect(keys).toHaveLength(2)
  })

  it('generates a card key for each verb', () => {
    const content = makeContent({ verbs: [verb_essere] })
    expect(flashcard.cards(content)).toContain('flashcard:v_essere')
  })

  it('generates a card key for each sentence', () => {
    const content = makeContent({ sentences: [sentence_s001] })
    expect(flashcard.cards(content)).toContain('flashcard:s_u01_001')
  })

  it('combines words, verbs, sentences in output', () => {
    const content = makeContent({
      words: [word_caffe],
      verbs: [verb_essere],
      sentences: [sentence_s001],
    })
    expect(flashcard.cards(content)).toHaveLength(3)
  })
})

describe('flashcard.build()', () => {
  it('builds Exercise with Italian prompt and NL answers for a word', () => {
    const content = makeContent({ words: [word_caffe] })
    const ex = flashcard.build('flashcard:w_caffe', content)
    expect(ex.prompt).toBe('caffe')
    expect(ex.answers).toEqual(['koffie'])
    expect(ex.typeId).toBe('flashcard')
    expect(ex.cardKey).toBe('flashcard:w_caffe')
  })

  it('builds Exercise for a verb using infinitive as prompt', () => {
    const content = makeContent({ verbs: [verb_essere] })
    const ex = flashcard.build('flashcard:v_essere', content)
    expect(ex.prompt).toBe('essere')
    expect(ex.answers).toContain('zijn')
  })

  it('builds Exercise for a sentence', () => {
    const content = makeContent({ sentences: [sentence_s001] })
    const ex = flashcard.build('flashcard:s_u01_001', content)
    expect(ex.prompt).toBe('Ciao, sono Sam.')
    expect(ex.answers).toContain('Hoi, ik ben Sam.')
  })

  it('throws for unknown id', () => {
    const content = makeContent({})
    expect(() => flashcard.build('flashcard:w_unknown', content)).toThrow()
  })
})

describe('flashcard.check()', () => {
  it('"again" → "again"', () => {
    const content = makeContent({ words: [word_caffe] })
    const ex = flashcard.build('flashcard:w_caffe', content)
    expect(flashcard.check('again', ex, config)).toBe('again')
  })

  it('"good" → "good"', () => {
    const content = makeContent({ words: [word_caffe] })
    const ex = flashcard.build('flashcard:w_caffe', content)
    expect(flashcard.check('good', ex, config)).toBe('good')
  })

  it('"easy" → "easy"', () => {
    const content = makeContent({ words: [word_caffe] })
    const ex = flashcard.build('flashcard:w_caffe', content)
    expect(flashcard.check('easy', ex, config)).toBe('easy')
  })

  it('invalid input throws', () => {
    const content = makeContent({ words: [word_caffe] })
    const ex = flashcard.build('flashcard:w_caffe', content)
    expect(() => flashcard.check('correct', ex, config)).toThrow()
  })
})

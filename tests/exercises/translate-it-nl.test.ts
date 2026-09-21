import { describe, it, expect } from 'vitest'
import translateItNl from '../../src/exercises/translate-it-nl.ts'
import { makeContent } from './helpers.ts'
import { word_caffe_accent, word_ciao } from './fixtures.ts'
import type { CheckerConfig } from '../../src/engine/checker.ts'

const config: CheckerConfig = { typoMinLength: 5, typoMaxDistance: 1 }

describe('translate-it-nl.cards()', () => {
  it('generates translate-it-nl keys for all words', () => {
    const content = makeContent({ words: [word_caffe_accent, word_ciao] })
    expect(translateItNl.cards(content)).toEqual([
      'translate-it-nl:w_caffe_accent',
      'translate-it-nl:w_ciao',
    ])
  })

  it('returns empty array when no words', () => {
    expect(translateItNl.cards(makeContent({}))).toEqual([])
  })

  it('does not generate keys for verbs or sentences', () => {
    const content = makeContent({ words: [word_ciao], verbs: [], sentences: [] })
    expect(translateItNl.cards(content)).toHaveLength(1)
  })
})

describe('translate-it-nl.build()', () => {
  it('builds with Italian as prompt and Dutch as answers', () => {
    const content = makeContent({ words: [word_caffe_accent] })
    const ex = translateItNl.build('translate-it-nl:w_caffe_accent', content)
    expect(ex.prompt).toBe('caffè')
    expect(ex.answers).toEqual(['koffie'])
    expect(ex.typeId).toBe('translate-it-nl')
    expect(ex.cardKey).toBe('translate-it-nl:w_caffe_accent')
  })

  it('includes multiple NL answers', () => {
    const content = makeContent({ words: [word_ciao] })
    const ex = translateItNl.build('translate-it-nl:w_ciao', content)
    expect(ex.answers).toEqual(['hoi', 'doei'])
  })

  it('throws for unknown word id', () => {
    expect(() =>
      translateItNl.build('translate-it-nl:w_unknown', makeContent({}))
    ).toThrow()
  })
})

describe('translate-it-nl.check()', () => {
  it('correct Dutch answer → "correct"', () => {
    const content = makeContent({ words: [word_ciao] })
    const ex = translateItNl.build('translate-it-nl:w_ciao', content)
    expect(translateItNl.check('hoi', ex, config)).toBe('correct')
  })

  it('second valid Dutch answer → "correct"', () => {
    const content = makeContent({ words: [word_ciao] })
    const ex = translateItNl.build('translate-it-nl:w_ciao', content)
    expect(translateItNl.check('doei', ex, config)).toBe('correct')
  })

  it('typo in Dutch (length >= typoMinLength, Levenshtein 1) → "almost"', () => {
    // 'kofie' vs 'koffie': length 6 >= 5, Levenshtein = 1
    const content = makeContent({ words: [word_caffe_accent] })
    const ex = translateItNl.build('translate-it-nl:w_caffe_accent', content)
    expect(translateItNl.check('kofie', ex, config)).toBe('almost')
  })

  it('wrong answer → "wrong"', () => {
    const content = makeContent({ words: [word_caffe_accent] })
    const ex = translateItNl.build('translate-it-nl:w_caffe_accent', content)
    expect(translateItNl.check('brood', ex, config)).toBe('wrong')
  })
})

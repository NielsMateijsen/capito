import { describe, it, expect } from 'vitest'
import translateNlIt from '../../src/exercises/translate-nl-it.ts'
import { makeContent } from './helpers.ts'
import { word_caffe_accent, word_ciao } from './fixtures.ts'
import type { CheckerConfig } from '../../src/engine/checker.ts'

const config: CheckerConfig = { typoMinLength: 5, typoMaxDistance: 1 }

describe('translate-nl-it.cards()', () => {
  it('generates translate-nl-it keys for all words', () => {
    const content = makeContent({ words: [word_caffe_accent, word_ciao] })
    expect(translateNlIt.cards(content)).toEqual([
      'translate-nl-it:w_caffe_accent',
      'translate-nl-it:w_ciao',
    ])
  })

  it('returns empty array when no words', () => {
    expect(translateNlIt.cards(makeContent({}))).toEqual([])
  })

  it('does not generate keys for verbs or sentences', () => {
    const content = makeContent({ words: [word_ciao], verbs: [], sentences: [] })
    expect(translateNlIt.cards(content)).toHaveLength(1)
  })
})

describe('translate-nl-it.build()', () => {
  it('builds with Dutch as prompt and Italian as answer', () => {
    const content = makeContent({ words: [word_ciao] })
    const ex = translateNlIt.build('translate-nl-it:w_ciao', content)
    expect(ex.prompt).toBe('hoi / doei')
    expect(ex.answers).toEqual(['ciao'])
    expect(ex.typeId).toBe('translate-nl-it')
  })

  it('single NL translation shown without separator', () => {
    const content = makeContent({ words: [word_caffe_accent] })
    const ex = translateNlIt.build('translate-nl-it:w_caffe_accent', content)
    expect(ex.prompt).toBe('koffie')
    expect(ex.answers).toEqual(['caffè'])
  })

  it('throws for unknown word id', () => {
    expect(() =>
      translateNlIt.build('translate-nl-it:w_unknown', makeContent({}))
    ).toThrow()
  })
})

describe('translate-nl-it.check()', () => {
  it('correct Italian answer → "correct"', () => {
    const content = makeContent({ words: [word_ciao] })
    const ex = translateNlIt.build('translate-nl-it:w_ciao', content)
    expect(translateNlIt.check('ciao', ex, config)).toBe('correct')
  })

  it('wrong answer → "wrong"', () => {
    const content = makeContent({ words: [word_ciao] })
    const ex = translateNlIt.build('translate-nl-it:w_ciao', content)
    expect(translateNlIt.check('fout', ex, config)).toBe('wrong')
  })
})

describe('translate-nl-it typoTolerance', () => {
  it('typoTolerance is enabled', () => {
    expect(translateNlIt.typoTolerance).toBe(true)
  })

  it('typo in Italian answer (length >= typoMinLength) → "almost"', () => {
    // 'parlara' vs 'parlare': 1 substitution (last e→a), length 7 >= 5 → Levenshtein 1
    const word = { ...word_caffe_accent, id: 'w_parlare', it: 'parlare', nl: ['praten'] }
    const content = makeContent({ words: [word] })
    const ex = translateNlIt.build('translate-nl-it:w_parlare', content)
    expect(translateNlIt.check('parlara', ex, config)).toBe('almost')
  })
})

import { describe, it, expect } from 'vitest'
import article from '../../src/exercises/article.ts'
import { makeContent } from './helpers.ts'
import { word_signora, word_ciao } from './fixtures.ts'
import type { CheckerConfig } from '../../src/engine/checker.ts'

const config: CheckerConfig = { typoMinLength: 5, typoMaxDistance: 1 }

describe('article.cards()', () => {
  it('generates an article key for words that have an article', () => {
    const content = makeContent({ words: [word_signora] })
    expect(article.cards(content)).toEqual(['article:w_signora'])
  })

  it('skips words without an article (null)', () => {
    // word_ciao has article: null
    const content = makeContent({ words: [word_ciao, word_signora] })
    const keys = article.cards(content)
    expect(keys).not.toContain('article:w_ciao')
    expect(keys).toContain('article:w_signora')
  })

  it('returns empty array when no words have articles', () => {
    const content = makeContent({ words: [word_ciao] })
    expect(article.cards(content)).toEqual([])
  })
})

describe('article.build()', () => {
  it('builds with Italian word as prompt and article as answer', () => {
    const content = makeContent({ words: [word_signora] })
    const ex = article.build('article:w_signora', content)
    expect(ex.prompt).toBe('signora')
    expect(ex.answers).toEqual(['la'])
    expect(ex.typeId).toBe('article')
  })

  it('throws for unknown word id', () => {
    expect(() => article.build('article:w_unknown', makeContent({}))).toThrow()
  })
})

describe('article.check()', () => {
  it('correct article → "correct"', () => {
    const content = makeContent({ words: [word_signora] })
    const ex = article.build('article:w_signora', content)
    expect(article.check('la', ex, config)).toBe('correct')
  })

  it('wrong article → "wrong"', () => {
    const content = makeContent({ words: [word_signora] })
    const ex = article.build('article:w_signora', content)
    expect(article.check('il', ex, config)).toBe('wrong')
  })
})

describe('article typoTolerance', () => {
  it('typoTolerance is disabled', () => {
    expect(article.typoTolerance).toBe(false)
  })

  it('near-miss on article → "wrong" (typo check disabled for article)', () => {
    // 'lo' vs 'la': Levenshtein 1, but length 2 < typoMinLength anyway — confirms disabled
    const content = makeContent({ words: [word_signora] })
    const ex = article.build('article:w_signora', content)
    expect(article.check('lo', ex, config)).toBe('wrong')
  })
})

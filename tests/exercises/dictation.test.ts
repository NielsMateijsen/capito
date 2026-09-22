import { describe, it, expect } from 'vitest'
import dictation from '../../src/exercises/dictation.ts'
import { makeContent } from './helpers.ts'
import { sentence_s001, sentence_long } from './fixtures.ts'
import type { CheckerConfig } from '../../src/engine/checker.ts'

const config: CheckerConfig = { typoMinLength: 5, typoMaxDistance: 1 }

describe('dictation.cards()', () => {
  it('generates a dictation key for each sentence', () => {
    const content = makeContent({ sentences: [sentence_s001, sentence_long] })
    expect(dictation.cards(content)).toEqual([
      'dictation:s_u01_001',
      'dictation:s_long_001',
    ])
  })

  it('returns empty array when no sentences', () => {
    expect(dictation.cards(makeContent({}))).toEqual([])
  })
})

describe('dictation.build()', () => {
  it('builds with empty prompt and Italian sentence as answer', () => {
    const content = makeContent({ sentences: [sentence_s001] })
    const ex = dictation.build('dictation:s_u01_001', content)
    expect(ex.prompt).toBe('')
    expect(ex.answers).toEqual(['Ciao, sono Sam.'])
    expect(ex.typeId).toBe('dictation')
  })

  it('throws for unknown sentence id', () => {
    expect(() => dictation.build('dictation:s_unknown', makeContent({}))).toThrow()
  })
})

describe('dictation.check()', () => {
  it('exact Italian sentence → "correct"', () => {
    const content = makeContent({ sentences: [sentence_s001] })
    const ex = dictation.build('dictation:s_u01_001', content)
    expect(dictation.check('Ciao, sono Sam.', ex, config)).toBe('correct')
  })

  it('wrong input → "wrong"', () => {
    const content = makeContent({ sentences: [sentence_s001] })
    const ex = dictation.build('dictation:s_u01_001', content)
    expect(dictation.check('Ciao, sei Sam.', ex, config)).toBe('wrong')
  })
})

describe('dictation typoTolerance', () => {
  it('typoTolerance is enabled', () => {
    expect(dictation.typoTolerance).toBe(true)
  })

  it('single-character typo in a long-enough word → "almost"', () => {
    // sentence_long.it = 'Buongiorno, come stai oggi?' — 'Buongiorno' is 10 chars
    // 'Buongiornoo' vs 'Buongiorno': Levenshtein 1, long enough
    const content = makeContent({ sentences: [sentence_long] })
    const ex = dictation.build('dictation:s_long_001', content)
    expect(dictation.check('Buongiornoo, come stai oggi?', ex, config)).toBe('almost')
  })
})

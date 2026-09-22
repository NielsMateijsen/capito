import { describe, it, expect } from 'vitest'
import cloze from '../../src/exercises/cloze.ts'
import { makeContent } from './helpers.ts'
import { sentence_with_cloze, sentence_s001 } from './fixtures.ts'
import type { CheckerConfig } from '../../src/engine/checker.ts'

const config: CheckerConfig = { typoMinLength: 5, typoMaxDistance: 1 }

describe('cloze.cards()', () => {
  it('generates one key per cloze item in a sentence', () => {
    const content = makeContent({ sentences: [sentence_with_cloze] })
    expect(cloze.cards(content)).toEqual(['cloze:s_cloze_001:0'])
  })

  it('generates no cards for a sentence without cloze field', () => {
    const content = makeContent({ sentences: [sentence_s001] })
    expect(cloze.cards(content)).toEqual([])
  })

  it('handles a sentence with multiple cloze items', () => {
    const multi = {
      ...sentence_with_cloze,
      id: 's_multi',
      cloze: [
        { target: 'sono', hint: 'essere' },
        { target: 'Ciao', hint: 'ciao' },
      ],
    }
    const content = makeContent({ sentences: [multi] })
    expect(cloze.cards(content)).toEqual(['cloze:s_multi:0', 'cloze:s_multi:1'])
  })

  it('returns empty when no sentences', () => {
    expect(cloze.cards(makeContent({}))).toEqual([])
  })
})

describe('cloze.build()', () => {
  it('blanks out the target word and sets answers and hint', () => {
    const content = makeContent({ sentences: [sentence_with_cloze] })
    const ex = cloze.build('cloze:s_cloze_001:0', content)
    expect(ex.prompt).toBe('Ciao, ___ Sam.')
    expect(ex.answers).toEqual(['sono'])
    expect(ex.hint).toBe('essere')
    expect(ex.typeId).toBe('cloze')
  })

  it('throws for unknown sentence id', () => {
    expect(() => cloze.build('cloze:s_unknown:0', makeContent({}))).toThrow()
  })

  it('throws for out-of-range cloze index', () => {
    const content = makeContent({ sentences: [sentence_with_cloze] })
    expect(() => cloze.build('cloze:s_cloze_001:5', content)).toThrow()
  })
})

describe('cloze.check()', () => {
  it('correct cloze answer → "correct"', () => {
    const content = makeContent({ sentences: [sentence_with_cloze] })
    const ex = cloze.build('cloze:s_cloze_001:0', content)
    expect(cloze.check('sono', ex, config)).toBe('correct')
  })

  it('wrong answer → "wrong"', () => {
    const content = makeContent({ sentences: [sentence_with_cloze] })
    const ex = cloze.build('cloze:s_cloze_001:0', content)
    expect(cloze.check('sei', ex, config)).toBe('wrong')
  })
})

describe('cloze typoTolerance', () => {
  it('typoTolerance is disabled', () => {
    expect(cloze.typoTolerance).toBe(false)
  })

  it('typo in cloze answer → "wrong" (typo check disabled)', () => {
    // 'siamo' vs 'siami': Levenshtein 1, length 5 >= 5 — but disabled for cloze
    const multiSentence = {
      ...sentence_with_cloze,
      id: 's_siamo',
      it: 'Noi siamo qui.',
      cloze: [{ target: 'siamo', hint: 'essere' }],
    }
    const content = makeContent({ sentences: [multiSentence] })
    const ex = cloze.build('cloze:s_siamo:0', content)
    expect(cloze.check('siami', ex, config)).toBe('wrong')
  })
})

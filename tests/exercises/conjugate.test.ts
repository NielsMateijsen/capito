import { describe, it, expect } from 'vitest'
import conjugate from '../../src/exercises/conjugate.ts'
import { makeContent } from './helpers.ts'
import { verb_parlare, verb_essere, tense_presente } from './fixtures.ts'
import type { CheckerConfig } from '../../src/engine/checker.ts'

const config: CheckerConfig = { typoMinLength: 5, typoMaxDistance: 1 }

describe('conjugate.cards()', () => {
  it('generates 6 cards (one per person) for a regular verb × one tense', () => {
    const content = makeContent({ verbs: [verb_parlare], tenses: [tense_presente] })
    const keys = conjugate.cards(content)
    expect(keys).toHaveLength(6)
    expect(keys).toContain('conjugate:v_parlare:presente:io')
    expect(keys).toContain('conjugate:v_parlare:presente:loro')
  })

  it('generates cards for an irregular verb that has the tense in its table', () => {
    const content = makeContent({ verbs: [verb_essere], tenses: [tense_presente] })
    const keys = conjugate.cards(content)
    expect(keys).toHaveLength(6)
    expect(keys).toContain('conjugate:v_essere:presente:io')
  })

  it('skips irregular verb for a tense not in its irregular table', () => {
    const tensePast = { ...tense_presente, id: 'passato_prossimo' }
    const content = makeContent({ verbs: [verb_essere], tenses: [tensePast] })
    // v_essere has no 'passato_prossimo' in its irregular table → no cards
    expect(conjugate.cards(content)).toHaveLength(0)
  })

  it('returns empty when no verbs', () => {
    const content = makeContent({ tenses: [tense_presente] })
    expect(conjugate.cards(content)).toEqual([])
  })
})

describe('conjugate.build()', () => {
  it('builds with infinitive as prompt, person as hint, conjugated form as answer', () => {
    const content = makeContent({ verbs: [verb_parlare], tenses: [tense_presente] })
    const ex = conjugate.build('conjugate:v_parlare:presente:noi', content)
    expect(ex.prompt).toBe('parlare')
    expect(ex.hint).toBe('noi')
    expect(ex.answers).toEqual(['parliamo'])
    expect(ex.typeId).toBe('conjugate')
  })

  it('correctly conjugates io → parlo', () => {
    const content = makeContent({ verbs: [verb_parlare], tenses: [tense_presente] })
    const ex = conjugate.build('conjugate:v_parlare:presente:io', content)
    expect(ex.answers).toEqual(['parlo'])
  })

  it('correctly conjugates irregular verb (essere/io → sono)', () => {
    const content = makeContent({ verbs: [verb_essere], tenses: [tense_presente] })
    const ex = conjugate.build('conjugate:v_essere:presente:io', content)
    expect(ex.answers).toEqual(['sono'])
  })

  it('throws for unknown verb id', () => {
    const content = makeContent({ tenses: [tense_presente] })
    expect(() => conjugate.build('conjugate:v_unknown:presente:io', content)).toThrow()
  })

  it('throws for unknown tense id', () => {
    const content = makeContent({ verbs: [verb_parlare] })
    expect(() => conjugate.build('conjugate:v_parlare:presente:io', content)).toThrow()
  })
})

describe('conjugate.check()', () => {
  it('correct conjugation → "correct"', () => {
    const content = makeContent({ verbs: [verb_parlare], tenses: [tense_presente] })
    const ex = conjugate.build('conjugate:v_parlare:presente:io', content)
    expect(conjugate.check('parlo', ex, config)).toBe('correct')
  })

  it('wrong conjugation → "wrong"', () => {
    const content = makeContent({ verbs: [verb_parlare], tenses: [tense_presente] })
    const ex = conjugate.build('conjugate:v_parlare:presente:io', content)
    expect(conjugate.check('parla', ex, config)).toBe('wrong')
  })
})

describe('conjugate typoTolerance', () => {
  it('typoTolerance is disabled', () => {
    expect(conjugate.typoTolerance).toBe(false)
  })

  it('typo in conjugation → "wrong" (typo check disabled)', () => {
    // 'parlamo' vs 'parliamo': Levenshtein 1, length 7 >= 5 — but disabled for conjugation
    const content = makeContent({ verbs: [verb_parlare], tenses: [tense_presente] })
    const ex = conjugate.build('conjugate:v_parlare:presente:noi', content)
    expect(conjugate.check('parlamo', ex, config)).toBe('wrong')
  })
})

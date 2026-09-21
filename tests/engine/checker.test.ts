import { describe, it, expect } from 'vitest'
import { check } from '../../src/engine/checker.ts'
import type { CheckerConfig } from '../../src/engine/checker.ts'

const config: CheckerConfig = { typoMinLength: 5, typoMaxDistance: 1 }

describe('normalization', () => {
  it('trim, lowercase, strip trailing punctuation', () => {
    expect(check('  Ciao! ', ['ciao'], 'translation', config)).toBe('correct')
  })

  it('curly apostrophe ’ → straight apostrophe', () => {
    expect(check('l’amico', ["l'amico"], 'translation', config)).toBe('correct')
  })

  it('collapse double spaces', () => {
    expect(check('buon  giorno', ['buon giorno'], 'translation', config)).toBe('correct')
  })
})

describe('multiple valid answers', () => {
  it('second answer matches → correct', () => {
    expect(check('hoi', ['hallo', 'hoi'], 'translation', config)).toBe('correct')
  })
})

describe('accent error', () => {
  it('missing accent → almost', () => {
    expect(check('caffe', ['caffè'], 'translation', config)).toBe('almost')
  })

  it('e/è exception: ambiguous unaccented form → wrong', () => {
    expect(check('e', ['è'], 'translation', config, new Set(['e']))).toBe('wrong')
  })
})

describe('typo detection', () => {
  it('distance 1, answer length ≥ typoMinLength, translation → almost', () => {
    expect(check('vrend', ['vriend'], 'translation', config)).toBe('almost')
  })

  it('distance 1, flashcard type → almost', () => {
    expect(check('vrend', ['vriend'], 'flashcard', config)).toBe('almost')
  })

  it('distance 1, conjugation type → wrong', () => {
    expect(check('parla', ['parlo'], 'conjugation', config)).toBe('wrong')
  })

  it('distance 1, article type → wrong', () => {
    expect(check('vrend', ['vriend'], 'article', config)).toBe('wrong')
  })

  it('distance 1, cloze type → wrong', () => {
    expect(check('vrend', ['vriend'], 'cloze', config)).toBe('wrong')
  })

  it('answer length < typoMinLength → wrong', () => {
    // 'ciao' has length 4 < 5, 'cao' has distance 1 but answer too short
    expect(check('cao', ['ciao'], 'translation', config)).toBe('wrong')
  })
})

describe('wrong answer', () => {
  it('completely wrong → wrong', () => {
    expect(check('sbagliato', ['giusto'], 'translation', config)).toBe('wrong')
  })
})

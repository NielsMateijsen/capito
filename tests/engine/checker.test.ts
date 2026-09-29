import { describe, it, expect } from 'vitest'
import { check } from '../../src/engine/checker.ts'
import type { CheckerConfig } from '../../src/engine/checker.ts'

const config: CheckerConfig = { typoMinLength: 5, typoMaxDistance: 1 }

describe('normalization', () => {
  it('trim, lowercase, strip trailing punctuation', () => {
    expect(check('  Hallo! ', ['hallo'], 'translation', config)).toBe('correct')
  })

  it('curly apostrophe ’ → straight apostrophe', () => {
    expect(check('o’clock', ["o'clock"], 'translation', config)).toBe('correct')
  })

  it('collapse double spaces', () => {
    expect(check('goeie  dag', ['goeie dag'], 'translation', config)).toBe('correct')
  })

  it('missing comma and exclamation mark → correct', () => {
    expect(check('Hallo Anna', ['Hallo, Anna!'], 'translation', config)).toBe('correct')
  })

  it('extra punctuation in input → correct', () => {
    expect(check('Ja, graag. Dank je!', ['ja graag dank je'], 'translation', config)).toBe('correct')
  })

  it('punctuation without surrounding space still separates words', () => {
    expect(check('ja,graag', ['ja, graag'], 'translation', config)).toBe('correct')
  })

  it('ignores punctuation when typo tolerance is off (cloze)', () => {
    expect(check('hallo anna', ['Hallo, Anna!'], 'cloze', config)).toBe('correct')
  })

  it('keeps apostrophes: they are part of the word', () => {
    expect(check('zon', ["zo'n"], 'translation', config)).not.toBe('correct')
  })
})

describe('multiple valid answers', () => {
  it('second answer matches → correct', () => {
    expect(check('hoi', ['hallo', 'hoi'], 'translation', config)).toBe('correct')
  })
})

describe('accent error', () => {
  it('missing accent → almost', () => {
    // 'cafe' is the unaccented form of 'café'
    expect(check('cafe', ['café'], 'translation', config)).toBe('almost')
  })

  it('ambiguous unaccented form is in accentExceptions → wrong', () => {
    // stripped 'à' = 'a', which is in the exception set (different meaning)
    expect(check('a', ['à'], 'translation', config, new Set(['a']))).toBe('wrong')
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
    // 'spoel' vs 'speel': Levenshtein=1, both length 5, but conjugation disables typo check
    expect(check('spoel', ['speel'], 'conjugation', config)).toBe('wrong')
  })

  it('distance 1, article type → wrong', () => {
    expect(check('vrend', ['vriend'], 'article', config)).toBe('wrong')
  })

  it('distance 1, cloze type → wrong', () => {
    expect(check('vrend', ['vriend'], 'cloze', config)).toBe('wrong')
  })

  it('answer length < typoMinLength → wrong', () => {
    // 'boot' has length 4 < 5, 'bool' has distance 1 but answer too short
    expect(check('bool', ['boot'], 'translation', config)).toBe('wrong')
  })
})

describe('wrong answer', () => {
  it('completely wrong → wrong', () => {
    expect(check('verkeerd', ['juist'], 'translation', config)).toBe('wrong')
  })
})

import { describe, it, expect } from 'vitest'
import { hashString, seededRandom, sentenceOptions, shuffle, wordOptions } from '../../src/engine/distractors.ts'
import { makeContent } from '../exercises/helpers.ts'
import { ladderSentences, ladderUnit, tense_presente, verb_essere, word_ciao, word_signora } from '../exercises/fixtures.ts'

const content = makeContent({
  words: [word_ciao, word_signora],
  verbs: [verb_essere],
  sentences: ladderSentences,
  tenses: [tense_presente],
  units: [ladderUnit],
})

describe('seededRandom()', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    for (let i = 0; i < 100; i++) {
      const x = a()
      expect(x).toBe(b())
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('differs between seeds', () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)())
  })
})

describe('shuffle()', () => {
  it('keeps all elements and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5]
    const out = shuffle(input, seededRandom(3))
    expect([...out].sort()).toEqual(input)
    expect(input).toEqual([1, 2, 3, 4, 5])
  })
})

describe('hashString()', () => {
  it('is stable', () => {
    expect(hashString('abc')).toBe(hashString('abc'))
    expect(hashString('abc')).not.toBe(hashString('abd'))
  })
})

describe('sentenceOptions()', () => {
  const sentence = ladderSentences[0]

  it('includes the answer and the requested number of distinct options', () => {
    const { options, answer } = sentenceOptions(sentence, word_ciao.id, content, 4, 1)
    expect(answer).toBe(sentence.nl[0])
    expect(options).toHaveLength(4)
    expect(options).toContain(answer)
    expect(new Set(options).size).toBe(4)
  })

  it('prefers sentences without the item', () => {
    const { options } = sentenceOptions(sentence, word_ciao.id, content, 4, 1)
    const withItem = ladderSentences.filter(s => s.id !== sentence.id && s.uses.includes(word_ciao.id)).map(s => s.nl[0])
    expect(options.filter(o => withItem.includes(o))).toEqual([])
  })

  it('is deterministic for a seed', () => {
    expect(sentenceOptions(sentence, word_ciao.id, content, 4, 9)).toEqual(sentenceOptions(sentence, word_ciao.id, content, 4, 9))
  })

  it('uses all candidates when no count is given', () => {
    const { options } = sentenceOptions(sentence, word_ciao.id, content, undefined, 1)
    expect(options).toHaveLength(ladderSentences.length)
  })
})

describe('wordOptions()', () => {
  it('uses other forms of the same verb', () => {
    const forms = verb_essere.irregular!.presente
    const { options, answer } = wordOptions(verb_essere.id, forms.lui, content, 4, 1)
    expect(answer).toBe(forms.lui)
    expect(options).toHaveLength(4)
    for (const o of options) expect([verb_essere.inf, ...Object.values(forms)]).toContain(o)
  })

  it('lowercases the answer and fills with other words', () => {
    const { options, answer } = wordOptions(word_ciao.id, word_ciao.it.toUpperCase(), content, 4, 1)
    expect(answer).toBe(word_ciao.it)
    expect(options).toContain(word_signora.it)
    expect(new Set(options).size).toBe(options.length)
  })
})

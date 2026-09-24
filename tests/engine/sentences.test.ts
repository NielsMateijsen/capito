import { describe, it, expect } from 'vitest'
import {
  introSentence,
  itemForms,
  ladderItemOrder,
  locate,
  pickSentence,
  sentencesForItem,
  withGap,
} from '../../src/engine/sentences.ts'
import { pluralize } from '../../src/engine/plurals.ts'
import { makeContent } from '../exercises/helpers.ts'
import { ladderSentences, ladderUnit, tense_presente, verb_essere, word_ciao, word_signora } from '../exercises/fixtures.ts'

const content = makeContent({
  words: [word_ciao, word_signora],
  verbs: [verb_essere],
  sentences: ladderSentences,
  tenses: [tense_presente],
  units: [ladderUnit],
})

const forms = verb_essere.irregular!.presente

describe('itemForms()', () => {
  it('returns the word and, for nouns, its plural', () => {
    expect(itemForms(word_signora.id, content)).toEqual([word_signora.it, pluralize(word_signora)])
    expect(itemForms(word_ciao.id, content)).toEqual([word_ciao.it])
  })

  it('returns the infinitive and all conjugated forms of a verb, without duplicates', () => {
    const result = itemForms(verb_essere.id, content)
    expect(result[0]).toBe(verb_essere.inf)
    expect(result).toEqual(expect.arrayContaining(Object.values(forms)))
    expect(new Set(result).size).toBe(result.length)
  })

  it('returns nothing for an unknown item', () => {
    expect(itemForms('w_unknown', content)).toEqual([])
  })
})

describe('locate()', () => {
  it('finds a form case-insensitively on word boundaries', () => {
    const s = ladderSentences[0]
    const span = locate(s.it, [word_ciao.it])!
    expect(s.it.slice(span.start, span.end).toLowerCase()).toBe(word_ciao.it)
  })

  it('does not match inside another word', () => {
    expect(locate(`x${word_ciao.it}x`, [word_ciao.it])).toBeNull()
  })

  it('matches after an apostrophe', () => {
    expect(locate(`l'${word_ciao.it}`, [word_ciao.it])).toEqual({ start: 2, end: 2 + word_ciao.it.length })
  })

  it('prefers the earliest and then the longest match', () => {
    const text = `${forms.noi} ${forms.io}`
    expect(locate(text, [forms.io, forms.noi])).toEqual({ start: 0, end: forms.noi.length })
  })
})

describe('sentencesForItem()', () => {
  it('lists sentences in unit order with the span of the item', () => {
    const matches = sentencesForItem(verb_essere.id, content)
    expect(matches.map(m => m.sentence.id)).toEqual(['s_l_002', 's_l_004', 's_l_005', 's_l_006'])
    for (const m of matches) {
      expect(Object.values(forms)).toContain(m.sentence.it.slice(m.span.start, m.span.end))
    }
  })

  it('finds a noun in its plural form', () => {
    const matches = sentencesForItem(word_signora.id, content)
    const plural = matches.find(m => m.sentence.id === 's_l_005')!
    expect(plural.sentence.it.slice(plural.span.start, plural.span.end).toLowerCase()).toBe(pluralize(word_signora))
  })

  it('skips a sentence where the item cannot be found', () => {
    const broken = { ...ladderSentences[0], id: 's_broken', uses: [word_signora.id] }
    const c = makeContent({ words: [word_signora], sentences: [broken] })
    expect(sentencesForItem(word_signora.id, c)).toEqual([])
  })
})

describe('introSentence() and pickSentence()', () => {
  it('uses the first sentence as intro', () => {
    expect(introSentence(word_ciao.id, content)?.sentence.id).toBe('s_l_001')
  })

  it('rotates through the other sentences, starting after the intro', () => {
    const picked = [0, 1, 2, 3].map(seq => pickSentence(verb_essere.id, content, seq)?.sentence.id)
    expect(picked).toEqual(['s_l_004', 's_l_005', 's_l_006', 's_l_002'])
  })

  it('returns the only sentence when there is just one', () => {
    const c = makeContent({ words: [word_ciao], sentences: [ladderSentences[0]] })
    expect(pickSentence(word_ciao.id, c, 5)?.sentence.id).toBe('s_l_001')
  })

  it('returns undefined without sentences', () => {
    expect(pickSentence('w_unknown', content, 0)).toBeUndefined()
  })
})

describe('ladderItemOrder()', () => {
  it('orders items by first appearance in the sentences', () => {
    expect(ladderItemOrder(content)).toEqual([word_ciao.id, verb_essere.id, word_signora.id])
  })

  it('appends items that appear in no sentence', () => {
    const extra = { ...word_ciao, id: 'w_extra' }
    const unit = { ...ladderUnit, words: [...ladderUnit.words, extra] }
    const c = makeContent({ words: [word_ciao, word_signora, extra], verbs: [verb_essere], sentences: ladderSentences, tenses: [tense_presente], units: [unit] })
    expect(ladderItemOrder(c).at(-1)).toBe('w_extra')
  })
})

describe('withGap()', () => {
  it('replaces the span', () => {
    expect(withGap('abcdef', { start: 2, end: 4 }, '_')).toBe('ab_ef')
  })
})

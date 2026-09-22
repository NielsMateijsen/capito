import { describe, it, expect } from 'vitest'
import { pluralize, pluralArticle } from '../../src/engine/plurals.ts'
import type { Word } from '../../src/content/schemas.ts'

function noun(it: string, gender: 'm' | 'f', article: string, plural: string | null = null): Word {
  return {
    id: `w_${it.replace(/\s/g, '_')}`,
    it,
    pos: 'noun',
    article,
    gender,
    plural,
    nl: ['test'],
    register: 'neutral',
    core: false,
  }
}

describe('pluralize', () => {
  it('signora (f, -a) → signore', () => {
    expect(pluralize(noun('signora', 'f', 'la'))).toBe('signore')
  })

  it('libro (m, -o) → libri', () => {
    expect(pluralize(noun('libro', 'm', 'il'))).toBe('libri')
  })

  it('pane (m, -e) → pani', () => {
    expect(pluralize(noun('pane', 'm', 'il'))).toBe('pani')
  })

  it('chiave (f, -e) → chiavi', () => {
    expect(pluralize(noun('chiave', 'f', 'la'))).toBe('chiavi')
  })

  it('ufficio (m, -io) → uffici', () => {
    expect(pluralize(noun('ufficio', 'm', 'l\''))).toBe('uffici')
  })

  it('specchio (m, -io starting with sp-) → specchi', () => {
    expect(pluralize(noun('specchio', 'm', 'lo'))).toBe('specchi')
  })

  it('banco (m, -co) → banchi', () => {
    expect(pluralize(noun('banco', 'm', 'il'))).toBe('banchi')
  })

  it('albergo (m, -go) → alberghi', () => {
    expect(pluralize(noun('albergo', 'm', 'il'))).toBe('alberghi')
  })

  it('amica (f, -ca) → amiche', () => {
    expect(pluralize(noun('amica', 'f', 'l\''))).toBe('amiche')
  })

  it('bottega (f, -ga) → botteghe', () => {
    expect(pluralize(noun('bottega', 'f', 'la'))).toBe('botteghe')
  })

  it('problema (m, -a) → problemi', () => {
    expect(pluralize(noun('problema', 'm', 'il'))).toBe('problemi')
  })

  it('caffè (m, accented vowel) → caffè (invariable)', () => {
    expect(pluralize(noun('caffè', 'm', 'il'))).toBe('caffè')
  })

  it('bar (m, ends in consonant) → bar (invariable)', () => {
    expect(pluralize(noun('bar', 'm', 'il'))).toBe('bar')
  })

  it('città (f, accented vowel) → città (invariable)', () => {
    expect(pluralize(noun('città', 'f', 'la'))).toBe('città')
  })

  it('amico with plural override → amici', () => {
    expect(pluralize(noun('amico', 'm', 'l\'', 'amici'))).toBe('amici')
  })
})

describe('pluralArticle', () => {
  it('il (m) → i', () => {
    expect(pluralArticle(noun('libro', 'm', 'il'))).toBe('i')
  })

  it('lo (m) → gli', () => {
    expect(pluralArticle(noun('studente', 'm', 'lo'))).toBe('gli')
  })

  it('lo (m, specchio) → gli', () => {
    expect(pluralArticle(noun('specchio', 'm', 'lo'))).toBe('gli')
  })

  it("l' (f, amica) → le", () => {
    expect(pluralArticle(noun('amica', 'f', "l'"))).toBe('le')
  })

  it("l' (m, amico) → gli", () => {
    expect(pluralArticle(noun('amico', 'm', "l'"))).toBe('gli')
  })

  it('la (f, casa) → le', () => {
    expect(pluralArticle(noun('casa', 'f', 'la'))).toBe('le')
  })

  it('il (m, caffè) → i', () => {
    expect(pluralArticle(noun('caffè', 'm', 'il'))).toBe('i')
  })

  it('la (f, città) → le', () => {
    expect(pluralArticle(noun('città', 'f', 'la'))).toBe('le')
  })
})

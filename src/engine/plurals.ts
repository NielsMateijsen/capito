import type { Word } from '../content/schemas.ts'

const ACCENTED_VOWELS = /[àèéìíòóùú]$/

export function pluralize(word: Word): string {
  // 1. Explicit override in content (irregular plural)
  if (word.plural) return word.plural

  const it = word.it
  const gender = word.gender

  // 2. Invariable: ends in accented vowel
  if (ACCENTED_VOWELS.test(it)) return it

  // 3. Invariable: ends in consonant (last char not a vowel)
  const last = it.at(-1) ?? ''
  if (!'aeiou'.includes(last)) return it

  // 4. -io → drop the final 'o' (ufficio → uffici, specchio → specchi)
  if (it.endsWith('io')) return it.slice(0, -1)

  // 5. -co (masculine) → -chi (banco → banchi)
  if (gender === 'm' && it.endsWith('co')) return it.slice(0, -2) + 'chi'

  // 6. -go (masculine) → -ghi (albergo → alberghi)
  if (gender === 'm' && it.endsWith('go')) return it.slice(0, -2) + 'ghi'

  // 7. -ca (feminine) → -che (amica → amiche)
  if (gender === 'f' && it.endsWith('ca')) return it.slice(0, -2) + 'che'

  // 8. -ga (feminine) → -ghe (bottega → botteghe)
  if (gender === 'f' && it.endsWith('ga')) return it.slice(0, -2) + 'ghe'

  // 9. -o → -i (libro → libri)
  if (it.endsWith('o')) return it.slice(0, -1) + 'i'

  // 10. -a, feminine → -e (casa → case, signora → signore)
  if (it.endsWith('a') && gender === 'f') return it.slice(0, -1) + 'e'

  // 11. -a, masculine → -i (problema → problemi)
  if (it.endsWith('a') && gender === 'm') return it.slice(0, -1) + 'i'

  // 12. -e → -i (pane → pani, chiave → chiavi)
  if (it.endsWith('e')) return it.slice(0, -1) + 'i'

  return it
}

export function pluralArticle(word: Word): string {
  const singular = word.article
  const gender = word.gender

  if (singular === 'il') return 'i'
  if (singular === 'lo') return 'gli'
  if (singular === 'la') return 'le'
  if (singular === "l'") return gender === 'm' ? 'gli' : 'le'

  return 'i'
}

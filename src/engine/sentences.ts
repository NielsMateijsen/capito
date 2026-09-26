import type { Sentence } from '../content/schemas.ts'
import type { Content } from '../exercises/types.ts'
import { conjugate } from './conjugator.ts'
import type { Person } from './conjugator.ts'
import { pluralize } from './plurals.ts'

const PERSONS: Person[] = ['io', 'tu', 'lui', 'noi', 'voi', 'loro']

export interface Span {
  start: number
  end: number
}

export interface SentenceMatch {
  sentence: Sentence
  span: Span
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(v => v.length > 0))]
}

export function verbForms(verbId: string, content: Content): string[] {
  const verb = content.verbs.get(verbId)
  if (!verb) return []
  const forms: string[] = []
  for (const tense of content.tenses.values()) {
    if (!verb.irregular?.[tense.id] && (verb.conj === 'irregular' || !tense.endings[verb.conj])) continue
    for (const person of PERSONS) forms.push(conjugate(verb, tense, person))
  }
  return unique(forms)
}

export function itemForms(itemId: string, content: Content): string[] {
  const word = content.words.get(itemId)
  if (word) return unique(word.pos === 'noun' ? [word.it, pluralize(word)] : [word.it])
  const verb = content.verbs.get(itemId)
  if (verb) return unique([verb.inf, ...verbForms(itemId, content)])
  return []
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function locate(text: string, forms: string[]): Span | null {
  let best: Span | null = null
  for (const form of forms) {
    const re = new RegExp(`(?<!\\p{L})${escapeRegex(form)}(?!\\p{L})`, 'iu')
    const m = re.exec(text)
    if (!m) continue
    const span = { start: m.index, end: m.index + m[0].length }
    if (!best || span.start < best.start || (span.start === best.start && span.end > best.end)) best = span
  }
  return best
}

function orderedSentences(content: Content): Sentence[] {
  const fromUnits = [...content.units].sort((a, b) => a.order - b.order).flatMap(u => u.sentences)
  const inUnits = new Set(fromUnits.map(s => s.id))
  return [...fromUnits, ...[...content.sentences.values()].filter(s => !inUnits.has(s.id))]
}

const indexCache = new WeakMap<Content, Map<string, SentenceMatch[]>>()

function sentenceIndex(content: Content): Map<string, SentenceMatch[]> {
  const cached = indexCache.get(content)
  if (cached) return cached
  const index = new Map<string, SentenceMatch[]>()
  const formsCache = new Map<string, string[]>()
  for (const sentence of orderedSentences(content)) {
    for (const itemId of sentence.uses) {
      let forms = formsCache.get(itemId)
      if (!forms) {
        forms = itemForms(itemId, content)
        formsCache.set(itemId, forms)
      }
      const span = locate(sentence.it, forms)
      if (!span) continue
      const list = index.get(itemId) ?? []
      list.push({ sentence, span })
      index.set(itemId, list)
    }
  }
  indexCache.set(content, index)
  return index
}

export function sentencesForItem(itemId: string, content: Content): SentenceMatch[] {
  return sentenceIndex(content).get(itemId) ?? []
}

export function introSentence(itemId: string, content: Content): SentenceMatch | undefined {
  return sentencesForItem(itemId, content)[0]
}

// seq 0 skips the intro sentence so the first question shows a new context.
export function pickSentence(itemId: string, content: Content, seq: number): SentenceMatch | undefined {
  const matches = sentencesForItem(itemId, content)
  if (matches.length === 0) return undefined
  if (matches.length === 1) return matches[0]
  return matches[(seq + 1) % matches.length]
}

export function ladderItemOrder(content: Content): string[] {
  const order: string[] = []
  const seen = new Set<string>()
  const add = (id: string) => {
    if (seen.has(id) || (!content.words.has(id) && !content.verbs.has(id))) return
    seen.add(id)
    order.push(id)
  }
  for (const unit of [...content.units].sort((a, b) => a.order - b.order)) {
    for (const sentence of unit.sentences) sentence.uses.forEach(add)
    unit.words.forEach(w => add(w.id))
    unit.verbs.forEach(v => add(v.id))
  }
  for (const sentence of orderedSentences(content)) sentence.uses.forEach(add)
  content.words.forEach((_, id) => add(id))
  content.verbs.forEach((_, id) => add(id))
  return order
}

export function withGap(text: string, span: Span, gap: string): string {
  return text.slice(0, span.start) + gap + text.slice(span.end)
}

import type { Sentence } from '../content/schemas.ts'
import type { Content } from '../exercises/types.ts'
import { verbForms } from './sentences.ts'

// mulberry32
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export interface Options {
  options: string[]
  answer: string
}

function key(s: string): string {
  return s.normalize('NFC').trim().toLowerCase()
}

// Tiers are tried in order; within a tier the order is shuffled.
function assemble(answer: string, tiers: string[][], count: number | undefined, rand: () => number): Options {
  const chosen = [answer]
  const seen = new Set([key(answer)])
  const limit = count ?? Infinity
  for (const tier of tiers) {
    for (const candidate of shuffle(tier, rand)) {
      if (chosen.length >= limit) break
      if (seen.has(key(candidate))) continue
      seen.add(key(candidate))
      chosen.push(candidate)
    }
  }
  return { options: shuffle(chosen, rand), answer }
}

function unitOfSentence(content: Content): Map<string, string> {
  const map = new Map<string, string>()
  for (const unit of content.units) for (const s of unit.sentences) map.set(s.id, unit.id)
  return map
}

export function sentenceOptions(
  sentence: Sentence,
  itemId: string,
  content: Content,
  count: number | undefined,
  seed: number,
): Options {
  const unitOf = unitOfSentence(content)
  const unit = unitOf.get(sentence.id)
  const others = [...content.sentences.values()].filter(s => s.id !== sentence.id)
  const sameUnitWithout = others.filter(s => unitOf.get(s.id) === unit && !s.uses.includes(itemId))
  const otherWithout = others.filter(s => unitOf.get(s.id) !== unit && !s.uses.includes(itemId))
  const withItem = others.filter(s => s.uses.includes(itemId))
  const tiers = [sameUnitWithout, otherWithout, withItem].map(list => list.map(s => s.nl[0]))
  return assemble(sentence.nl[0], tiers, count, seededRandom(seed))
}

export function wordOptions(
  itemId: string,
  answer: string,
  content: Content,
  count: number | undefined,
  seed: number,
): Options {
  const lower = answer.toLowerCase()
  const verb = content.verbs.get(itemId)
  let tiers: string[][]
  if (verb) {
    const ownForms = verbForms(itemId, content)
    const otherVerbForms = [...content.verbs.keys()].filter(id => id !== itemId).flatMap(id => verbForms(id, content))
    tiers = [ownForms, otherVerbForms]
  } else {
    const word = content.words.get(itemId)
    const others = [...content.words.values()].filter(w => w.id !== itemId)
    const samePos = others.filter(w => w.pos === word?.pos).map(w => w.it)
    const otherPos = others.filter(w => w.pos !== word?.pos).map(w => w.it)
    tiers = [samePos, otherPos]
  }
  return assemble(lower, tiers.map(t => t.map(s => s.toLowerCase())), count, seededRandom(seed))
}

import type { Unit } from './schemas.ts'
import type { Content } from '../exercises/types.ts'
import { itemForms, ladderItemOrder, locate, sentencesForItem } from '../engine/sentences.ts'

export interface LadderCheck {
  errors: string[]
  warnings: string[]
}

/** Content rules for the learning ladder (see docs/style-guide.md). */
export function checkLadderContent(
  content: Content,
  config: { minSentencesPerItem: number; optionCount: number },
): LadderCheck {
  const errors: string[] = []
  const warnings: string[] = []
  const isItem = (id: string) => content.words.has(id) || content.verbs.has(id)

  for (const s of content.sentences.values()) {
    for (const id of s.uses) {
      if (isItem(id) && !locate(s.it, itemForms(id, content))) {
        errors.push(`${s.id}: "${id}" is in uses but cannot be found in the sentence`)
      }
    }
  }

  const order = ladderItemOrder(content)
  const position = new Map(order.map((id, i) => [id, i]))
  for (const id of order) {
    const matches = sentencesForItem(id, content)
    if (matches.length < config.minSentencesPerItem) {
      warnings.push(`${id}: in ${matches.length} sentence(s), expected at least ${config.minSentencesPerItem}`)
    }
    const intro = matches[0]
    if (!intro) continue
    const laterItems = intro.sentence.uses.filter(u => u !== id && isItem(u) && (position.get(u) ?? -1) > position.get(id)!)
    if (laterItems.length > 0) {
      warnings.push(`${id}: intro sentence ${intro.sentence.id} also introduces ${laterItems.join(', ')}`)
    }
  }

  if (content.sentences.size > 0 && content.sentences.size < config.optionCount) {
    warnings.push(`only ${content.sentences.size} sentences; multiple choice needs ${config.optionCount}`)
  }
  return { errors, warnings }
}

/** Topological sort of units by requires. Returns null if a cycle is detected. */
export function topoSort(units: Unit[]): Unit[] | null {
  const byId = new Map(units.map(u => [u.id, u]))
  const visited = new Set<string>()
  const stack = new Set<string>()
  const order: Unit[] = []

  function visit(id: string): boolean {
    if (stack.has(id)) return false
    if (visited.has(id)) return true
    stack.add(id)
    const unit = byId.get(id)
    if (unit) {
      for (const req of unit.requires) {
        if (!visit(req)) return false
      }
      order.push(unit)
    }
    stack.delete(id)
    visited.add(id)
    return true
  }

  for (const u of units) {
    if (!visit(u.id)) return null
  }
  return order
}

/**
 * For each unit (in topo order), returns the set of word/verb IDs known at
 * that point (current unit + all earlier units).
 */
export function buildKnownIds(topoUnits: Unit[]): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()
  const accumulated = new Set<string>()
  for (const unit of topoUnits) {
    unit.words.forEach(w => accumulated.add(w.id))
    unit.verbs.forEach(v => accumulated.add(v.id))
    result.set(unit.id, new Set(accumulated))
  }
  return result
}

/**
 * Returns a list of duplicate ID descriptions (across word/verb/sentence/dialogue
 * IDs in all units). An ID that appears more than once is reported once per extra
 * occurrence.
 */
export function findDuplicateIds(units: Unit[]): string[] {
  const seen = new Map<string, string>()
  const dupes: string[] = []
  for (const unit of units) {
    const ids = [
      ...unit.words.map(w => w.id),
      ...unit.verbs.map(v => v.id),
      ...unit.sentences.map(s => s.id),
      ...unit.dialogues.map(d => d.id),
    ]
    for (const id of ids) {
      if (seen.has(id)) {
        dupes.push(`${id} (in ${unit.id} and ${seen.get(id)})`)
      } else {
        seen.set(id, unit.id)
      }
    }
  }
  return dupes
}

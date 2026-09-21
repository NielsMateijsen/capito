import type { Unit } from './schemas.ts'

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

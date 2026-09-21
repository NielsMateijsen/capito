import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import matter from 'gray-matter'
import {
  GrammarFrontmatterSchema,
  TenseSchema,
  UnitSchema,
} from '../src/content/schemas.ts'
import type { Unit } from '../src/content/schemas.ts'
import { topoSort, buildKnownIds, findDuplicateIds } from '../src/content/validate-helpers.ts'

const ROOT = resolve(import.meta.dirname, '..')
const CONTENT = join(ROOT, 'content')
const UNITS_DIR = join(CONTENT, 'units')
const TENSES_DIR = join(CONTENT, 'tenses')
const GRAMMAR_DIR = join(CONTENT, 'grammar')
const REGISTRY_PATH = join(CONTENT, 'id-registry.json')

const UPDATE_REGISTRY = process.argv.includes('--update-registry')

let errors = 0
let warnings = 0

function error(msg: string) {
  console.error(`  ✗ ${msg}`)
  errors++
}

function warn(msg: string) {
  console.warn(`  ⚠ ${msg}`)
  warnings++
}

// ── Load and parse all units ─────────────────────────────────────────────────

function loadUnits(): Unit[] {
  if (!existsSync(UNITS_DIR)) return []
  return readdirSync(UNITS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const path = join(UNITS_DIR, f)
      const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown
      const result = UnitSchema.safeParse(raw)
      if (!result.success) {
        console.error(`\n[${f}]`)
        result.error.issues.forEach(i => error(`${i.path.join('.')}: ${i.message}`))
        return null
      }
      return result.data
    })
    .filter((u): u is Unit => u !== null)
}


// ── Collect all content IDs ───────────────────────────────────────────────────

function collectAllIds(units: Unit[]): string[] {
  const ids: string[] = []
  for (const u of units) {
    ids.push(u.id)
    u.words.forEach(w => ids.push(w.id))
    u.verbs.forEach(v => ids.push(v.id))
    u.sentences.forEach(s => ids.push(s.id))
    u.dialogues.forEach(d => ids.push(d.id))
  }
  return ids
}

// ── Main validation ───────────────────────────────────────────────────────────

console.log('Validating content...\n')

// 1. Load and validate unit schemas
const units = loadUnits()
if (units.length === 0 && existsSync(UNITS_DIR) && readdirSync(UNITS_DIR).filter(f => f.endsWith('.json')).length > 0) {
  process.exit(1)
}

// 2. Load and validate tense schemas
if (existsSync(TENSES_DIR)) {
  for (const f of readdirSync(TENSES_DIR).filter(f => f.endsWith('.json'))) {
    const path = join(TENSES_DIR, f)
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown
    console.log(`[${f}]`)
    const result = TenseSchema.safeParse(raw)
    if (!result.success) {
      result.error.issues.forEach(i => error(`${i.path.join('.')}: ${i.message}`))
    } else {
      console.log('  ✓ valid')
    }
  }
}

// 3. Load and validate grammar frontmatter
if (existsSync(GRAMMAR_DIR)) {
  for (const f of readdirSync(GRAMMAR_DIR).filter(f => f.endsWith('.md'))) {
    const path = join(GRAMMAR_DIR, f)
    const { data } = matter(readFileSync(path, 'utf-8'))
    console.log(`[${f}]`)
    const result = GrammarFrontmatterSchema.safeParse(data)
    if (!result.success) {
      result.error.issues.forEach(i => error(`${i.path.join('.')}: ${i.message}`))
    } else {
      console.log('  ✓ valid')
    }
  }
}

if (units.length > 0) {
  // 4. Check for cycles in requires
  console.log('\n[requires]')
  const sorted = topoSort(units)
  if (!sorted) {
    error('Cycle detected in unit requires')
  } else {
    console.log('  ✓ no cycles')
  }

  // 5. Duplicate IDs
  console.log('\n[duplicate IDs]')
  const dupes = findDuplicateIds(units)
  if (dupes.length > 0) {
    dupes.forEach(d => error(d))
  } else {
    console.log('  ✓ no duplicates')
  }

  // 6. canDo presence and count (already enforced by Zod min/max, but log)
  console.log('\n[canDo]')
  for (const u of units) {
    if (u.canDo.length < 2 || u.canDo.length > 4) {
      error(`${u.id}: canDo must have 2-4 items, has ${u.canDo.length}`)
    }
  }
  if (errors === 0) console.log('  ✓ all units have 2-4 canDo goals')

  // 7. uses references (only known IDs from current/earlier units in topo order)
  if (sorted) {
    console.log('\n[uses references]')
    const knownAt = buildKnownIds(sorted)
    let usesOk = true
    for (const unit of sorted) {
      const known = knownAt.get(unit.id) ?? new Set()
      for (const s of unit.sentences) {
        for (const ref of s.uses) {
          if (!known.has(ref)) {
            error(`${unit.id}/${s.id}: uses unknown or future ID "${ref}"`)
            usesOk = false
          }
        }
      }
    }
    if (usesOk) console.log('  ✓ all uses references valid')
  }

  // 8. grammar file references
  console.log('\n[grammar file references]')
  let grammarOk = true
  for (const u of units) {
    for (const ref of u.grammar) {
      const grammarFile = join(GRAMMAR_DIR, `${ref}.md`)
      if (!existsSync(grammarFile)) {
        warn(`${u.id}: grammar ref "${ref}" has no matching file ${ref}.md`)
        grammarOk = false
      }
    }
  }
  if (grammarOk) console.log('  ✓ all grammar references valid')

  // 9. ID registry
  console.log('\n[ID registry]')
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8')) as { schema: number; ids: string[] }
  const registeredIds = new Set(registry.ids)
  const contentIds = collectAllIds(units)
  const unregistered = contentIds.filter(id => !registeredIds.has(id))

  if (unregistered.length > 0) {
    if (UPDATE_REGISTRY) {
      const newIds = [...new Set([...registry.ids, ...unregistered])].sort()
      writeFileSync(REGISTRY_PATH, JSON.stringify({ schema: 1, ids: newIds }, null, 2) + '\n')
      console.log(`  ✓ registry updated (+${unregistered.length} IDs)`)
    } else {
      unregistered.forEach(id => error(`ID "${id}" not in registry (run with --update-registry to add)`))
    }
  } else {
    console.log('  ✓ all IDs registered')
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
if (errors > 0) {
  console.error(`✗ ${errors} error(s), ${warnings} warning(s)`)
  process.exit(1)
} else if (warnings > 0) {
  console.warn(`✓ 0 errors, ${warnings} warning(s)`)
} else {
  console.log('✓ All checks passed')
}

import matter from 'gray-matter'
import { GrammarFrontmatterSchema, TenseSchema, UnitSchema } from './schemas.ts'
import type { GrammarFrontmatter, Tense, Unit } from './schemas.ts'

const unitModules = import.meta.glob('../../content/units/*.json', { eager: true })
const tenseModules = import.meta.glob('../../content/tenses/*.json', { eager: true })
const grammarModules = import.meta.glob('../../content/grammar/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})

export function loadUnits(): Unit[] {
  return Object.entries(unitModules).map(([path, mod]) => {
    const result = UnitSchema.safeParse((mod as { default: unknown }).default ?? mod)
    if (!result.success) {
      throw new Error(`Invalid unit at ${path}: ${result.error.message}`)
    }
    return result.data
  })
}

export function loadTenses(): Tense[] {
  return Object.entries(tenseModules).map(([path, mod]) => {
    const result = TenseSchema.safeParse((mod as { default: unknown }).default ?? mod)
    if (!result.success) {
      throw new Error(`Invalid tense at ${path}: ${result.error.message}`)
    }
    return result.data
  })
}

export function loadGrammar(): GrammarFrontmatter[] {
  return Object.entries(grammarModules).map(([path, raw]) => {
    const { data } = matter(raw as string)
    const result = GrammarFrontmatterSchema.safeParse(data)
    if (!result.success) {
      throw new Error(`Invalid grammar frontmatter at ${path}: ${result.error.message}`)
    }
    return result.data
  })
}

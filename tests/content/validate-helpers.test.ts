import { describe, it, expect } from 'vitest'
import { topoSort, buildKnownIds, findDuplicateIds, checkLadderContent } from '../../src/content/validate-helpers.ts'
import { makeContent } from '../exercises/helpers.ts'
import { ladderSentences, ladderUnit, tense_presente, verb_essere, word_ciao, word_signora } from '../exercises/fixtures.ts'
import type { Unit } from '../../src/content/schemas.ts'

function makeUnit(id: string, requires: string[] = [], wordIds: string[] = []): Unit {
  return {
    schema: 1,
    id,
    order: 1,
    title: id,
    canDo: ['Ik kan iets', 'Ik kan nog iets'],
    requires,
    words: wordIds.map(wid => ({
      id: wid,
      it: wid,
      pos: 'noun' as const,
      nl: ['test'],
      register: 'neutral' as const,
      core: false,
    })),
    verbs: [],
    sentences: [],
    dialogues: [],
    grammar: [],
    tenses: [],
    review: { status: 'draft' as const },
  }
}

describe('topoSort', () => {
  it('returns units in dependency order', () => {
    const u1 = makeUnit('u01', [])
    const u2 = makeUnit('u02', ['u01'])
    const result = topoSort([u2, u1])
    expect(result).not.toBeNull()
    expect(result!.map(u => u.id)).toEqual(['u01', 'u02'])
  })

  it('returns null on cycle', () => {
    const u1 = makeUnit('u01', ['u02'])
    const u2 = makeUnit('u02', ['u01'])
    expect(topoSort([u1, u2])).toBeNull()
  })

  it('handles a single unit with no deps', () => {
    const u1 = makeUnit('u01', [])
    const result = topoSort([u1])
    expect(result).toEqual([u1])
  })
})

describe('findDuplicateIds', () => {
  it('returns empty array when no duplicates', () => {
    const u1 = makeUnit('u01', [], ['w_ciao'])
    const u2 = makeUnit('u02', [], ['w_grazie'])
    expect(findDuplicateIds([u1, u2])).toEqual([])
  })

  it('detects a word ID appearing in two units', () => {
    const u1 = makeUnit('u01', [], ['w_ciao'])
    const u2 = makeUnit('u02', [], ['w_ciao'])
    const dupes = findDuplicateIds([u1, u2])
    expect(dupes).toHaveLength(1)
    expect(dupes[0]).toContain('w_ciao')
  })
})

describe('buildKnownIds', () => {
  it('includes own words and words from earlier units', () => {
    const u1 = makeUnit('u01', [], ['w_ciao'])
    const u2 = makeUnit('u02', ['u01'], ['w_grazie'])
    const sorted = topoSort([u1, u2])!
    const known = buildKnownIds(sorted)

    expect(known.get('u01')!.has('w_ciao')).toBe(true)
    expect(known.get('u01')!.has('w_grazie')).toBe(false)

    expect(known.get('u02')!.has('w_ciao')).toBe(true)
    expect(known.get('u02')!.has('w_grazie')).toBe(true)
  })
})

// ─── checkLadderContent ──────────────────────────────────────────────────────

describe('checkLadderContent()', () => {
  const cfg = { minSentencesPerItem: 3, optionCount: 4 }
  const content = (sentences = ladderSentences) =>
    makeContent({
      words: [word_ciao, word_signora],
      verbs: [verb_essere],
      sentences,
      tenses: [tense_presente],
      units: [{ ...ladderUnit, sentences }],
    })

  it('passes the ladder fixture except for items with too few sentences', () => {
    const { errors, warnings } = checkLadderContent(content(), cfg)
    expect(errors).toEqual([])
    expect(warnings).toEqual([`${word_ciao.id}: in 2 sentence(s), expected at least 3`])
  })

  it('reports an item in uses that is not in the sentence', () => {
    const broken = [...ladderSentences, { ...ladderSentences[0], id: 's_bad', uses: [word_signora.id] }]
    expect(checkLadderContent(content(broken), cfg).errors).toEqual([
      `s_bad: "${word_signora.id}" is in uses but cannot be found in the sentence`,
    ])
  })

  it('warns when an intro sentence introduces two items', () => {
    const { warnings } = checkLadderContent(content(ladderSentences.slice(1)), cfg)
    expect(warnings).toContain(`${word_ciao.id}: intro sentence s_l_002 also introduces ${verb_essere.id}`)
  })

  it('warns when there are fewer sentences than multiple-choice options', () => {
    const { warnings } = checkLadderContent(content(ladderSentences.slice(0, 2)), cfg)
    expect(warnings).toContain('only 2 sentences; multiple choice needs 4')
  })
})

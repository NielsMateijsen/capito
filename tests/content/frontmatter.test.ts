import { describe, it, expect } from 'vitest'
import { parseFrontmatter } from '../../src/content/frontmatter.ts'

describe('parseFrontmatter()', () => {
  it('splits YAML frontmatter from the body', () => {
    const raw = '---\nschema: 1\nid: g_x\ndrills:\n  - { type: conjugate, verbs: [v_a], tense: presente }\n---\n# Title\n\nText\n'
    expect(parseFrontmatter(raw)).toEqual({
      data: { schema: 1, id: 'g_x', drills: [{ type: 'conjugate', verbs: ['v_a'], tense: 'presente' }] },
      body: '# Title\n\nText\n',
    })
  })

  it('handles Windows line endings and a byte order mark', () => {
    const raw = '﻿---\r\nid: g_x\r\n---\r\nBody'
    expect(parseFrontmatter(raw)).toEqual({ data: { id: 'g_x' }, body: 'Body' })
  })

  it('returns the whole text as body without frontmatter', () => {
    expect(parseFrontmatter('# Only body')).toEqual({ data: {}, body: '# Only body' })
  })
})

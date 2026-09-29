import { describe, it, expect } from 'vitest'
import { buildTestQueue } from '../../src/engine/test-session.ts'

const KEYS = ['a:w1', 'a:w2', 'b:w1', 'b:w2', 'c:s1']

describe('buildTestQueue', () => {
  it('contains one card per type, in type order', () => {
    const queue = buildTestQueue(['c', 'a', 'b'], KEYS, () => true)
    expect(queue).toEqual([
      { kind: 'exercise', cardKey: 'c:s1', isNew: false },
      { kind: 'exercise', cardKey: 'a:w1', isNew: false },
      { kind: 'exercise', cardKey: 'b:w1', isNew: false },
    ])
  })

  it('skips cards that cannot be built', () => {
    const queue = buildTestQueue(['a'], KEYS, k => k !== 'a:w1')
    expect(queue).toEqual([{ kind: 'exercise', cardKey: 'a:w2', isNew: false }])
  })

  it('leaves out types without a buildable card', () => {
    const queue = buildTestQueue(['a', 'x', 'c'], KEYS, k => k !== 'c:s1')
    expect(queue.map(i => (i.kind === 'exercise' ? i.cardKey : i.itemId))).toEqual(['a:w1'])
  })

  it('starts with an intro when an item is given', () => {
    const queue = buildTestQueue(['a'], KEYS, () => true, 'w1')
    expect(queue[0]).toEqual({ kind: 'intro', itemId: 'w1' })
    expect(queue).toHaveLength(2)
  })

  it('is deterministic', () => {
    expect(buildTestQueue(['a', 'b'], KEYS, () => true)).toEqual(buildTestQueue(['a', 'b'], KEYS, () => true))
  })
})

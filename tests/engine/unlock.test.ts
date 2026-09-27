import { describe, it, expect } from 'vitest'
import { isUnitUnlocked } from '../../src/engine/unlock.ts'

describe('isUnitUnlocked()', () => {
  it('opens a unit without requirements', () => {
    expect(isUnitUnlocked({ requires: [] }, new Set())).toBe(true)
  })

  it('stays locked until the exam of the required unit is passed', () => {
    expect(isUnitUnlocked({ requires: ['u01'] }, new Set())).toBe(false)
    expect(isUnitUnlocked({ requires: ['u01'] }, new Set(['u01']))).toBe(true)
  })

  it('needs every required unit', () => {
    expect(isUnitUnlocked({ requires: ['u01', 'u02'] }, new Set(['u01']))).toBe(false)
    expect(isUnitUnlocked({ requires: ['u01', 'u02'] }, new Set(['u01', 'u02']))).toBe(true)
  })
})

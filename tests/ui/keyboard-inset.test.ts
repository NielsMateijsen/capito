import { describe, it, expect } from 'vitest'
import { keyboardInset } from '../../src/ui/keyboard-inset.ts'

describe('keyboardInset()', () => {
  it('is zero without a keyboard', () => {
    expect(keyboardInset(844, 844, 0)).toBe(0)
  })

  it('is the part of the layout viewport the keyboard covers', () => {
    expect(keyboardInset(844, 508, 0)).toBe(336)
  })

  it('takes a scrolled visual viewport into account', () => {
    expect(keyboardInset(844, 508, 120)).toBe(216)
  })

  it('never goes below zero and rounds to whole pixels', () => {
    expect(keyboardInset(844, 900, 0)).toBe(0)
    expect(keyboardInset(844, 507.6, 0)).toBe(336)
  })
})

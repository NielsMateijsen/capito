import { describe, it, expect, beforeEach } from 'vitest'
import { createNavigator, type HistoryLike, type Navigator } from '../../src/ui/navigation.ts'

// Minimal in-memory browser history; go() fires popstate synchronously.
class FakeHistory implements HistoryLike {
  entries: unknown[] = [null]
  index = 0
  exited = false
  onPop: (state: unknown) => void = () => {}

  get state() { return this.entries[this.index] }
  pushState(data: unknown) {
    this.entries = this.entries.slice(0, this.index + 1)
    this.entries.push(data)
    this.index++
  }
  replaceState(data: unknown) { this.entries[this.index] = data }
  go(delta: number) {
    const target = this.index + delta
    if (target < 0) { this.exited = true; return }
    this.index = Math.min(target, this.entries.length - 1)
    this.onPop(this.state)
  }
}

type View = { screen: string }

describe('createNavigator', () => {
  let history: FakeHistory
  let shown: View[]
  let nav: Navigator<View>
  const current = () => shown[shown.length - 1]

  beforeEach(() => {
    history = new FakeHistory()
    shown = []
    nav = createNavigator<View>(history, v => shown.push(v))
    history.onPop = s => nav.handlePop(s)
    nav.start({ screen: 'home' })
  })

  it('start shows the root view without adding a history entry', () => {
    expect(current()).toEqual({ screen: 'home' })
    expect(history.entries).toHaveLength(1)
  })

  it('browser back returns to the previous screen', () => {
    nav.navigate({ screen: 'unit' })
    nav.navigate({ screen: 'grammar' })
    history.go(-1)
    expect(current()).toEqual({ screen: 'unit' })
    history.go(-1)
    expect(current()).toEqual({ screen: 'home' })
  })

  it('browser back on the root screen leaves the app', () => {
    history.go(-1)
    expect(history.exited).toBe(true)
  })

  it('in-app back behaves like browser back', () => {
    nav.navigate({ screen: 'unit' })
    nav.back({ screen: 'home' })
    expect(current()).toEqual({ screen: 'home' })
    expect(history.index).toBe(0)
  })

  it('in-app back at the root shows the fallback and stays in the app', () => {
    nav.back({ screen: 'unit' })
    expect(current()).toEqual({ screen: 'unit' })
    expect(history.exited).toBe(false)
    expect(history.index).toBe(0)
  })

  it('home jumps back to the root entry, skipping screens in between', () => {
    nav.navigate({ screen: 'unit' })
    nav.navigate({ screen: 'session' })
    nav.home({ screen: 'home' })
    expect(current()).toEqual({ screen: 'home' })
    expect(history.index).toBe(0)
    history.go(-1)
    expect(history.exited).toBe(true)
  })

  it('home at the root replaces the current view', () => {
    nav.home({ screen: 'home' })
    expect(current()).toEqual({ screen: 'home' })
    expect(history.entries).toHaveLength(1)
  })

  it('ignores popstate entries it did not create', () => {
    expect(nav.handlePop(null)).toBe(false)
    expect(nav.handlePop({ foo: 1 })).toBe(false)
  })

  it('tracks depth after browser back so in-app back stays in sync', () => {
    nav.navigate({ screen: 'unit' })
    nav.navigate({ screen: 'grammar' })
    history.go(-1)
    nav.back({ screen: 'home' })
    expect(current()).toEqual({ screen: 'home' })
    expect(history.index).toBe(0)
  })
})

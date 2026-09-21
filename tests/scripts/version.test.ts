import { describe, it, expect } from 'vitest'
import { getBuildInfo } from '../../scripts/version.ts'

describe('getBuildInfo()', () => {
  const info = getBuildInfo()

  it('app matches package.json version', () => {
    expect(info.app).toBe('0.1.0')
  })

  it('commit is a short git hash or "dev"', () => {
    expect(info.commit).toMatch(/^([0-9a-f]{4,}|dev)$/)
  })

  it('content is exactly 8 hex characters', () => {
    expect(info.content).toMatch(/^[0-9a-f]{8}$/)
  })

  it('built is an ISO datetime string', () => {
    expect(info.built).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('all fields are non-empty strings', () => {
    for (const [k, v] of Object.entries(info)) {
      expect(typeof v, `${k} should be a string`).toBe('string')
      expect(v.length, `${k} should be non-empty`).toBeGreaterThan(0)
    }
  })
})

describe('__BUILD__ global (via vite define)', () => {
  it('has correct shape and values matching getBuildInfo()', () => {
    expect(__BUILD__.app).toBe('0.1.0')
    expect(__BUILD__.commit).toMatch(/^([0-9a-f]{4,}|dev)$/)
    expect(__BUILD__.content).toMatch(/^[0-9a-f]{8}$/)
    expect(__BUILD__.built).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})

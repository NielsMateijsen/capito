import { describe, it, expect } from 'vitest'
import { computeAudioKey, lookupAudio, VOICE_A, VOICE_B } from '../../src/engine/audio.ts'
import type { AudioManifest } from '../../src/engine/audio.ts'

describe('computeAudioKey', () => {
  it('returns 12 lowercase hex characters', async () => {
    const h = await computeAudioKey('ciao', VOICE_A)
    expect(h).toHaveLength(12)
    expect(h).toMatch(/^[0-9a-f]{12}$/)
  })

  it('is deterministic', async () => {
    const h1 = await computeAudioKey('ciao', VOICE_A)
    const h2 = await computeAudioKey('ciao', VOICE_A)
    expect(h1).toBe(h2)
  })

  it('matches Python hashlib.sha256 output — cross-platform consistency', async () => {
    // Verified: python -c "import hashlib; print(hashlib.sha256('ciao|it-IT-ElsaNeural'.encode()).hexdigest()[:12])"
    expect(await computeAudioKey('ciao', VOICE_A)).toBe('3f32d0fc46bc')
  })

  it('differs for different text', async () => {
    const h1 = await computeAudioKey('ciao', VOICE_A)
    const h2 = await computeAudioKey('arrivederci', VOICE_A)
    expect(h1).not.toBe(h2)
  })

  it('differs for different voice', async () => {
    const h1 = await computeAudioKey('ciao', VOICE_A)
    const h2 = await computeAudioKey('ciao', VOICE_B)
    expect(h1).not.toBe(h2)
  })
})

describe('lookupAudio', () => {
  it('returns the file path when the hash is present', async () => {
    const text = 'ciao'
    const key = await computeAudioKey(text, VOICE_A)
    const manifest: AudioManifest = { [key]: { file: `audio/${key}.mp3`, ids: ['w_ciao'] } }
    expect(await lookupAudio(text, VOICE_A, manifest)).toBe(`audio/${key}.mp3`)
  })

  it('returns null when the hash is absent', async () => {
    const manifest: AudioManifest = {}
    expect(await lookupAudio('ciao', VOICE_A, manifest)).toBeNull()
  })

  it('distinguishes same text with different voices', async () => {
    const text = 'ciao'
    const keyA = await computeAudioKey(text, VOICE_A)
    const manifest: AudioManifest = { [keyA]: { file: `audio/${keyA}.mp3`, ids: ['s_t_001'] } }
    expect(await lookupAudio(text, VOICE_A, manifest)).toBe(`audio/${keyA}.mp3`)
    expect(await lookupAudio(text, VOICE_B, manifest)).toBeNull()
  })
})

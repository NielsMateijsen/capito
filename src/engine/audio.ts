export const VOICE_A = 'it-IT-ElsaNeural'
export const VOICE_B = 'it-IT-DiegoNeural'
export const VOICE_DEFAULT = VOICE_A

export type AudioManifest = Record<string, { file: string; ids: string[] }>

/**
 * SHA-256("text|voice")[:12] — matches scripts/generate-audio.py make_hash().
 * Uses SubtleCrypto so it's async; result is 12 lowercase hex characters.
 */
export async function computeAudioKey(text: string, voice: string): Promise<string> {
  const data = new TextEncoder().encode(`${text}|${voice}`)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  const hex = Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return hex.slice(0, 12)
}

/** Look up a file path in the manifest; returns null when not present. */
export async function lookupAudio(
  text: string,
  voice: string,
  manifest: AudioManifest,
): Promise<string | null> {
  const key = await computeAudioKey(text, voice)
  return manifest[key]?.file ?? null
}

import type { AudioManifest } from '../engine/audio.ts'
import { lookupAudio, VOICE_DEFAULT } from '../engine/audio.ts'
import manifestData from '../generated/audio-manifest.json'

export { VOICE_A, VOICE_B, VOICE_DEFAULT } from '../engine/audio.ts'

const manifest = manifestData as AudioManifest

function speechSynthesisFallback(text: string) {
  if (!window.speechSynthesis) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'it-IT'
  speechSynthesis.speak(u)
}

/** Play Italian audio: tries the pre-generated mp3 from the manifest first,
 *  falls back to speechSynthesis so new content works before audio is generated. */
export async function playAudio(text: string, voice = VOICE_DEFAULT): Promise<void> {
  const file = await lookupAudio(text, voice, manifest)
  if (file) {
    try {
      await new Audio(file).play()
      return
    } catch {
      // Audio element failed (e.g. file missing on disk) — fall through
    }
  }
  speechSynthesisFallback(text)
}

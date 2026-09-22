export function speak(text: string) {
  if (!window.speechSynthesis) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'it-IT'
  speechSynthesis.speak(u)
}

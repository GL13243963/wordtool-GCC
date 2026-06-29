export type SpeechRate = 'normal' | 'slow'

const VOICE_NAME_PRIORITY = [
  'Google US English',
  'Microsoft Jenny',
  'Microsoft Aria',
  'Samantha',
  'Daniel',
  'Karen',
]

let cachedVoice: SpeechSynthesisVoice | null = null

const getSpeechRateValue = (rate: SpeechRate): number => (rate === 'slow' ? 0.65 : 0.9)

const getVoiceScore = (voice: SpeechSynthesisVoice): number => {
  const priorityIndex = VOICE_NAME_PRIORITY.findIndex((name) => voice.name.includes(name))
  if (priorityIndex >= 0) return 100 - priorityIndex
  if (voice.lang.startsWith('en-US')) return 50
  if (voice.lang.startsWith('en-GB')) return 45
  if (voice.lang.startsWith('en')) return 30
  return 0
}

const getVoice = (): SpeechSynthesisVoice | null => {
  if (cachedVoice) return cachedVoice
  if (!window.speechSynthesis) return null

  const voices = window.speechSynthesis.getVoices()
  cachedVoice = [...voices].sort((left, right) => getVoiceScore(right) - getVoiceScore(left))[0] ?? null

  return cachedVoice
}

export const speakWord = (word: string, rate: SpeechRate = 'normal'): void => {
  try {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return

    window.speechSynthesis.cancel()

    const utterance = new window.SpeechSynthesisUtterance(word)
    utterance.voice = getVoice()
    utterance.rate = getSpeechRateValue(rate)
    utterance.lang = 'en-US'

    window.speechSynthesis.speak(utterance)
  } catch {
    // 浏览器不支持语音合成时静默失败
  }
}

export const preloadVoices = (): void => {
  if (!('speechSynthesis' in window)) return

  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null
    getVoice()
  }
}

let cachedVoice: SpeechSynthesisVoice | null = null

const getVoice = () => {
  if (cachedVoice) return cachedVoice

  const voices = window.speechSynthesis.getVoices()
  cachedVoice =
    voices.find((v) => v.lang.startsWith('en-US')) ??
    voices.find((v) => v.lang.startsWith('en')) ??
    voices[0] ??
    null

  return cachedVoice
}

export const speakWord = (word: string, rate: number = 0.9) => {
  try {
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(word)
    utterance.voice = getVoice()
    utterance.rate = rate
    utterance.lang = 'en-US'

    window.speechSynthesis.speak(utterance)
  } catch {
    // 浏览器不支持语音合成时静默失败
  }
}

export const preloadVoices = () => {
  if ('speechSynthesis' in window) {
    // 触发语音列表加载
    window.speechSynthesis.getVoices()
    window.speechSynthesis.onvoiceschanged = () => {
      getVoice()
    }
  }
}

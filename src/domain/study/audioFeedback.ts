import type { AnswerResult } from './types'

const BASE_FREQUENCY = 523.25 // C5
const COMBO_FREQUENCY_STEP = 55 // 每个连击增加的频率 Hz

const SOUND_FREQUENCIES: Partial<Record<AnswerResult, number[]>> = {
  correct: [660, 880],
  wrong: [220, 165],
  fuzzy: [440],
  skipped: [330],
}

const SOUND_DURATION_MS: Record<AnswerResult, number> = {
  correct: 150,
  wrong: 190,
  fuzzy: 90,
  skipped: 80,
}

// 连击音效 - 随着连击数音调升高
export const playComboSound = (comboCount: number, enabled: boolean): void => {
  if (!enabled || comboCount < 2) return

  try {
    const audioContext = getAudioContext()
    if (!audioContext) return

    const now = audioContext.currentTime
    const gain = audioContext.createGain()
    const baseFreq = BASE_FREQUENCY + Math.min(comboCount - 2, 8) * COMBO_FREQUENCY_STEP
    const duration = 100

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000)
    gain.connect(audioContext.destination)

    const oscillator = audioContext.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(baseFreq, now)
    oscillator.connect(gain)
    oscillator.start(now)
    oscillator.stop(now + duration / 1000)

    window.setTimeout(() => {
      void audioContext.close()
    }, duration + 50)
  } catch {
    // 静默失败
  }
}

const getAudioContext = (): AudioContext | null => {
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext
  if (!AudioContextClass) return null

  return new AudioContextClass()
}

export const playAnswerSound = (result: AnswerResult, enabled: boolean): void => {
  if (!enabled) return

  try {
    const audioContext = getAudioContext()
    const frequencies = SOUND_FREQUENCIES[result]
    if (!audioContext || !frequencies) return

    const now = audioContext.currentTime
    const gain = audioContext.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + SOUND_DURATION_MS[result] / 1000)
    gain.connect(audioContext.destination)

    frequencies.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator()
      const startAt = now + index * 0.07
      oscillator.type = result === 'wrong' ? 'triangle' : 'sine'
      oscillator.frequency.setValueAtTime(frequency, startAt)
      oscillator.connect(gain)
      oscillator.start(startAt)
      oscillator.stop(startAt + SOUND_DURATION_MS[result] / 1000)
    })

    window.setTimeout(() => {
      void audioContext.close()
    }, SOUND_DURATION_MS[result] + 180)
  } catch {
    // Browsers may block audio in some contexts; answer flow should continue silently.
  }
}

export const speakEnglish = (text: string): void => {
  try {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return

    window.speechSynthesis.cancel()
    const utterance = new window.SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.88
    window.speechSynthesis.speak(utterance)
  } catch {
    // Speech synthesis support varies by browser/WebView; ignore failures.
  }
}

import { speakWord, type SpeechRate } from './speech'
import type { AnswerResult } from './types'

// 音效资源映射
const SOUND_FILES: Partial<Record<AnswerResult, string>> = {
  correct: '/wordtool-GCC/sounds/correct.wav',
  wrong: '/wordtool-GCC/sounds/wrong.wav',
}

const LESSON_COMPLETE_SOUND = '/wordtool-GCC/sounds/lesson.wav'

// 音频缓存 - 预加载避免首次播放延迟
const audioCache = new Map<string, HTMLAudioElement>()

// 移动端音频解锁：需要在用户手势中播放一次无声音频
// 这会在用户点击「开始学习」时触发
let audioUnlocked = false

export const unlockAudio = (): void => {
  if (audioUnlocked) return

  try {
    // 播放一个几乎无声的音频来解锁移动端音频
    const silentAudio = new Audio(SOUND_FILES.correct!)
    silentAudio.volume = 0.01
    silentAudio.play().then(() => {
      audioUnlocked = true
    }).catch(() => {
      // 如果仍然失败，下次再试
    })
  } catch {
    // 静默失败
  }
}

// 预加载音效
export const preloadSounds = (): void => {
  // 预加载所有音效
  const allSounds = [...Object.values(SOUND_FILES), LESSON_COMPLETE_SOUND]
  allSounds.forEach((src) => {
    if (!audioCache.has(src)) {
      const audio = new Audio(src)
      audio.preload = 'auto'
      audio.volume = 0.5
      audioCache.set(src, audio)
    }
  })
}

// 播放真实音效
export const playAnswerSound = (result: AnswerResult, enabled: boolean): void => {
  if (!enabled) return

  const src = SOUND_FILES[result]
  if (!src) {
    // fuzzy 和 skipped 没有真实音效，保持静音
    return
  }

  try {
    let audio = audioCache.get(src)
    if (!audio) {
      audio = new Audio(src)
      audio.volume = 0.5
      audioCache.set(src, audio)
    }

    // 重置并播放（处理重复点击时的快速重播）
    audio.currentTime = 0
    void audio.play().catch(() => {
      // 浏览器可能阻止自动播放，静默失败
      audioUnlocked = false
    })
  } catch {
    // 播放失败静默处理
  }
}

// 播放结算音效
export const playLessonComplete = (enabled: boolean): void => {
  if (!enabled) return

  try {
    let audio = audioCache.get(LESSON_COMPLETE_SOUND)
    if (!audio) {
      audio = new Audio(LESSON_COMPLETE_SOUND)
      audio.volume = 0.5
      audioCache.set(LESSON_COMPLETE_SOUND, audio)
    }

    audio.currentTime = 0
    void audio.play().catch(() => {})
  } catch {
    // 静默失败
  }
}

const BASE_FREQUENCY = 523.25 // C5
const COMBO_FREQUENCY_STEP = 55 // 每个连击增加的频率 Hz

const getAudioContext = (): AudioContext | null => {
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext
  if (!AudioContextClass) return null

  return new AudioContextClass()
}

// 连击音效 - 保持使用合成音效（更适合音调动态变化）
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

export const speakEnglish = (text: string, rate: SpeechRate = 'normal'): void => {
  speakWord(text, rate)
}

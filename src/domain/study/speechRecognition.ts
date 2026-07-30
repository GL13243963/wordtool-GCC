type SpeechRecognitionErrorCode = 'unsupported' | 'no-speech' | 'permission-denied' | 'unknown'

export type SpeechRecognitionFailure = {
  code: SpeechRecognitionErrorCode
  message: string
}

export class SpeechRecognitionError extends Error {
  code: SpeechRecognitionErrorCode

  constructor(failure: SpeechRecognitionFailure) {
    super(failure.message)
    this.name = 'SpeechRecognitionError'
    this.code = failure.code
  }
}

type SpeechRecognitionAlternativeLike = {
  transcript: string
}

type SpeechRecognitionResultLike = {
  readonly length: number
  item(index: number): SpeechRecognitionAlternativeLike
  [index: number]: SpeechRecognitionAlternativeLike
}

type SpeechRecognitionResultListLike = {
  readonly length: number
  item(index: number): SpeechRecognitionResultLike
  [index: number]: SpeechRecognitionResultLike
}

type SpeechRecognitionEventLike = Event & {
  results: SpeechRecognitionResultListLike
}

type SpeechRecognitionErrorEventLike = Event & {
  error?: string
}

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

const getRecognitionConstructor = (): SpeechRecognitionConstructor | undefined => {
  const speechWindow = window as SpeechRecognitionWindow
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
}

export const isSpeechRecognitionSupported = (): boolean => getRecognitionConstructor() !== undefined

const normalizeTranscript = (value: string): string =>
  value
    .toLocaleLowerCase()
    .replace(/[^a-z\s']/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export const scoreReadAloud = (expected: string, transcript: string): boolean => {
  const normalizedExpected = normalizeTranscript(expected)
  const normalizedTranscript = normalizeTranscript(transcript)

  if (!normalizedExpected || !normalizedTranscript) return false
  if (normalizedExpected === normalizedTranscript) return true
  return normalizedTranscript.split(' ').includes(normalizedExpected)
}

export const getReadAloudMatchScore = (expected: string, transcript: string): number => {
  const normalizedExpected = normalizeTranscript(expected)
  const normalizedTranscript = normalizeTranscript(transcript)
  if (!normalizedExpected || !normalizedTranscript) return 0
  if (normalizedExpected === normalizedTranscript) return 100
  return normalizedTranscript.split(' ').includes(normalizedExpected) ? 85 : 0
}

const mapRecognitionError = (error?: string): SpeechRecognitionFailure => {
  if (error === 'not-allowed' || error === 'service-not-allowed' || error === 'permission-denied') {
    return {
      code: 'permission-denied',
      message: '🔒 请允许麦克风权限：\n• 点击浏览器地址栏左侧的 🔒 或 ⓘ 图标\n• 找到「麦克风」设置并选择「允许」\n• 刷新页面后重试'
    }
  }

  if (error === 'no-speech') {
    return { code: 'no-speech', message: '🎤 没有听到声音，请大声朗读单词后再试。' }
  }

  if (error === 'audio-capture') {
    return { code: 'permission-denied', message: '❌ 无法访问麦克风，请检查设备连接和浏览器权限设置。' }
  }

  return { code: 'unknown', message: '语音识别失败，请再试一次。' }
}

export const recognizeEnglishOnce = (): Promise<string> => {
  const Recognition = getRecognitionConstructor()
  if (!Recognition) {
    return Promise.reject(new SpeechRecognitionError({ code: 'unsupported', message: '当前设备或浏览器未提供语音识别，请更新系统和浏览器后重试。' }))
  }

  return new Promise((resolve, reject) => {
    const recognition = new Recognition()
    let settled = false

    const settle = (callback: () => void) => {
      if (settled) return
      settled = true
      callback()
    }

    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 3

    recognition.onresult = (event) => {
      const result = event.results[0]
      const transcript = result?.[0]?.transcript ?? result?.item(0)?.transcript ?? ''
      settle(() => resolve(transcript.trim()))
    }

    recognition.onerror = (event) => {
      const failure = mapRecognitionError(event.error)
      settle(() => reject(new SpeechRecognitionError(failure)))
    }

    recognition.onend = () => {
      // 只有在没有收到结果时才触发 no-speech 错误
      // 如果 onresult 已经触发过，settled 会是 true，这里不会执行
      settle(() => reject(new SpeechRecognitionError({ code: 'no-speech', message: '🎤 没有听到声音，请大声朗读后再试。' })))
    }

    try {
      recognition.start()
    } catch {
      settle(() => reject(new SpeechRecognitionError({ code: 'unknown', message: '语音识别启动失败，请再试一次。' })))
    }
  })
}

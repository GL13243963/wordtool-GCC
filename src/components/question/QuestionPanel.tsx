import { useEffect, useMemo, useRef, useState } from 'react'
import { playAnswerSound, playComboSound, speakEnglish } from '../../domain/study/audioFeedback'
import { normalizeBuiltAnswer, normalizeChunkComparison } from '../../domain/study/chunking'
import { createQuestion, type StudyQuestion } from '../../domain/study/questionFactory'
import { getReadAloudMatchScore, isSpeechRecognitionSupported, recognizeEnglishOnce, scoreReadAloud } from '../../domain/study/speechRecognition'
import type { AnswerMetadata, AnswerResult } from '../../domain/study/types'
import type { Word } from '../../domain/vocabulary/types'
import { toggleWordStar } from '../../storage/progressRepository'
import { Button } from '../ui/Button'

const AUTO_ADVANCE_DELAYS: Record<AnswerResult, number> = {
  correct: 900,
  wrong: 1600,
  fuzzy: 800,
  skipped: 700,
}

const MAX_ATTEMPTS = 3

export type QuestionPanelProps = {
  word: Word
  allWords: Word[]
  questionType: StudyQuestion['questionType']
  soundEnabled: boolean
  isFirstEncounter?: boolean
  comboCount?: number
  isStarred?: boolean
  onAnswer: (result: AnswerResult, metadata?: AnswerMetadata) => Promise<void> | void
  onToggleStar?: (wordId: string) => void
}

type PendingAnswer = {
  result: AnswerResult
  feedback: string
  metadata?: AnswerMetadata
}

const beginLocalRecording = async (): Promise<(() => Promise<Blob | null>) | null> => {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return null

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const chunks: BlobPart[] = []
  const recorder = new MediaRecorder(stream)
  const stopped = new Promise<Blob | null>((resolve) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      resolve(chunks.length > 0 ? new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }) : null)
    }
    recorder.onerror = () => {
      stream.getTracks().forEach((track) => track.stop())
      resolve(null)
    }
  })
  recorder.start()
  return async () => {
    if (recorder.state !== 'inactive') recorder.stop()
    return stopped
  }
}

const getMicrophoneErrorMessage = (error: unknown) => {
  if (!window.isSecureContext) return '当前页面不是安全连接，浏览器不会开放麦克风。请使用下方 HTTPS 公网地址。'
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return '麦克风权限被拒绝。请到平板“设置 → 应用和服务 → 浏览器 → 权限 → 麦克风”中允许，然后回到网页重试。'
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') return '没有检测到可用麦克风，请检查设备麦克风。'
  return '麦克风启动失败，请关闭其他正在录音的应用后重试。'
}

const getQuestionInstruction = (questionType: StudyQuestion['questionType']) => {
  if (questionType === 'enToZh') return '阶段 1/3：看英文，选择中文意思'
  if (questionType === 'spelling') return '阶段 2/3：按音节块拼出英文'
  return '阶段 3/3：朗读英文单词'
}

export const QuestionPanel = ({ word, allWords, questionType, soundEnabled, isFirstEncounter, comboCount, isStarred, onAnswer, onToggleStar }: QuestionPanelProps) => {
  const question = useMemo(
    () => createQuestion({ word, allWords, questionType }),
    [allWords, questionType, word],
  )
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [selectedChunkIndices, setSelectedChunkIndices] = useState<number[]>([])
  const [spellingWrongCount, setSpellingWrongCount] = useState(0)
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false)
  const [readAloudAttemptCount, setReadAloudAttemptCount] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [recognizedTranscript, setRecognizedTranscript] = useState('')
  const [recognitionError, setRecognitionError] = useState('')
  const [recordingUrl, setRecordingUrl] = useState('')
  const [matchScore, setMatchScore] = useState<number | null>(null)
  const [microphoneStatus, setMicrophoneStatus] = useState<'idle' | 'checking' | 'granted' | 'denied'>('idle')
  const [pendingAnswer, setPendingAnswer] = useState<PendingAnswer | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleToggleStar = async () => {
    await toggleWordStar(word.id)
    onToggleStar?.(word.id)
  }
  const hasSubmittedRef = useRef(false)
  const autoAdvanceTimerRef = useRef<number | null>(null)
  const resetTimerRef = useRef<number | null>(null)
  const manualRecordingStopRef = useRef<(() => Promise<Blob | null>) | null>(null)
  const hasAnswered = pendingAnswer !== null
  const speechRecognitionSupported = typeof window !== 'undefined' && isSpeechRecognitionSupported()

  useEffect(() => {
    setSelectedAnswer(null)
    setSelectedChunkIndices([])
    setSpellingWrongCount(0)
    setShowCorrectAnswer(false)
    setReadAloudAttemptCount(0)
    setIsListening(false)
    setRecognizedTranscript('')
    setRecognitionError('')
    setMatchScore(null)
    setMicrophoneStatus('idle')
    if (manualRecordingStopRef.current) {
      void manualRecordingStopRef.current()
      manualRecordingStopRef.current = null
    }
    setRecordingUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl)
      return ''
    })
    setSubmitError('')
    setPendingAnswer(null)
    hasSubmittedRef.current = false
  }, [question])

  // 首次出现时自动发音（英译中阶段）
  useEffect(() => {
    if (isFirstEncounter && soundEnabled && questionType === 'enToZh') {
      const timer = window.setTimeout(() => {
        speakEnglish(word.text)
      }, 200)
      return () => window.clearTimeout(timer)
    }
  }, [isFirstEncounter, soundEnabled, word.text, questionType])

  useEffect(() => {
    if (soundEnabled && (questionType === 'readAloud' || questionType === 'spelling')) {
      const timer = window.setTimeout(() => speakEnglish(word.text), 300)
      return () => window.clearTimeout(timer)
    }
  }, [questionType, soundEnabled, word.text])

  const clearAutoAdvanceTimer = () => {
    if (autoAdvanceTimerRef.current === null) return

    window.clearTimeout(autoAdvanceTimerRef.current)
    autoAdvanceTimerRef.current = null
  }

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }
      if (recordingUrl) URL.revokeObjectURL(recordingUrl)
      if (manualRecordingStopRef.current) {
        void manualRecordingStopRef.current()
        manualRecordingStopRef.current = null
      }
    }
  }, [recordingUrl])

  const handleNext = async () => {
    if (!pendingAnswer || isSubmitting || hasSubmittedRef.current) return

    clearAutoAdvanceTimer()
    hasSubmittedRef.current = true
    setSubmitError('')
    setIsSubmitting(true)
    try {
      if (pendingAnswer.metadata) {
        await onAnswer(pendingAnswer.result, pendingAnswer.metadata)
      } else {
        await onAnswer(pendingAnswer.result)
      }
    } catch {
      hasSubmittedRef.current = false
      setSubmitError('保存失败，请检查浏览器本地存储后重试。')
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (!pendingAnswer || submitError) return undefined

    autoAdvanceTimerRef.current = window.setTimeout(() => {
      void handleNext()
    }, AUTO_ADVANCE_DELAYS[pendingAnswer.result])

    return clearAutoAdvanceTimer
  }, [pendingAnswer, submitError])

  const stageAnswer = (result: AnswerResult, feedback: string, metadata?: AnswerMetadata) => {
    if (hasAnswered || isSubmitting) return
    playAnswerSound(result, soundEnabled)
    if (result === 'correct' && comboCount && comboCount >= 2) {
      playComboSound(comboCount, soundEnabled)
    }
    setPendingAnswer({ result, feedback, metadata })
  }

  const handleChoice = (option: string) => {
    if (hasAnswered || isSubmitting) return

    setSelectedAnswer(option)
    const isCorrect = option === question.answer
    stageAnswer(isCorrect ? 'correct' : 'wrong', isCorrect ? '回答正确，马上进入下一题。' : `正确答案：${question.answer}`)
  }

  const handleSelectChunk = (chunkIndex: number) => {
    if (question.type !== 'spelling') return
    if (hasAnswered || isSubmitting || showCorrectAnswer) return
    if (selectedChunkIndices.includes(chunkIndex)) return

    setSelectedChunkIndices((indices) => [...indices, chunkIndex])
    setSubmitError('')
  }

  const handleUndoChunk = () => {
    if (hasAnswered || isSubmitting || showCorrectAnswer) return
    setSelectedChunkIndices((indices) => indices.slice(0, -1))
  }

  const handleClearChunks = () => {
    if (hasAnswered || isSubmitting || showCorrectAnswer) return
    setSelectedChunkIndices([])
  }

  const resetSpellingSelectionSoon = () => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current)
    }

    resetTimerRef.current = window.setTimeout(() => {
      setShowCorrectAnswer(false)
      setSelectedChunkIndices([])
      resetTimerRef.current = null
    }, 1500)
  }

  const handleSpellingSubmit = () => {
    if (question.type !== 'spelling') return
    if (hasAnswered || isSubmitting || showCorrectAnswer) return

    if (selectedChunkIndices.length === 0) {
      setSubmitError('请先选择字母组合')
      setTimeout(() => setSubmitError(''), 1500)
      return
    }

    const selectedChunks = selectedChunkIndices.map((chunkIndex) => question.chunkOptions[chunkIndex])
    const userAnswer = normalizeBuiltAnswer(selectedChunks)
    const isCorrect = normalizeChunkComparison(userAnswer) === normalizeChunkComparison(question.answer)
    if (isCorrect) {
      stageAnswer('correct', '拼写正确，马上进入下一题。')
      return
    }

    const newWrongCount = spellingWrongCount + 1
    setSpellingWrongCount(newWrongCount)
    setShowCorrectAnswer(true)
    if (soundEnabled) {
      setTimeout(() => speakEnglish(question.answer), 300)
    }

    if (newWrongCount >= MAX_ATTEMPTS) {
      stageAnswer('wrong', `已重试3次，正确拼写：${question.answer}`)
      return
    }

    resetSpellingSelectionSoon()
  }

  const handleReadAloudStart = async () => {
    if (question.type !== 'readAloud') return
    if (hasAnswered || isSubmitting || isListening) return

    if (!speechRecognitionSupported) {
      setRecognitionError('当前设备或浏览器未提供语音识别，请更新系统和浏览器后重试。')
      return
    }

    setMicrophoneStatus('checking')
    setIsListening(true)
    setRecognitionError('')
    setRecognizedTranscript('')
    setMatchScore(null)
    let stopRecording: (() => Promise<Blob | null>) | null = null

    try {
      stopRecording = await beginLocalRecording()
      setMicrophoneStatus(stopRecording ? 'granted' : 'idle')
    } catch (error) {
      setMicrophoneStatus('denied')
      setRecognitionError(getMicrophoneErrorMessage(error))
      setIsListening(false)
      return
    }

    try {
      const transcript = await recognizeEnglishOnce()
      const nextMatchScore = getReadAloudMatchScore(question.answer, transcript)
      const nextAttemptCount = readAloudAttemptCount + 1
      setRecognizedTranscript(transcript)
      setMatchScore(nextMatchScore)

      if (scoreReadAloud(question.answer, transcript)) {
        stageAnswer('correct', '朗读通过，马上进入下一题。', {
          pronunciation: {
            engine: 'browser-speech-recognition',
            transcript,
            matchScore: nextMatchScore,
            attemptCount: nextAttemptCount,
          },
        })
        return
      }

      setReadAloudAttemptCount(nextAttemptCount)
      if (nextAttemptCount >= MAX_ATTEMPTS) {
        stageAnswer('wrong', `已尝试3次，正确读音：${question.answer}`, {
          pronunciation: {
            engine: 'browser-speech-recognition',
            transcript,
            matchScore: nextMatchScore,
            attemptCount: nextAttemptCount,
          },
        })
        return
      }

      setRecognitionError(`我听到的是：${transcript || '未识别'}。请再读一次。`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '语音识别失败，请再试一次。'
      const nextAttemptCount = readAloudAttemptCount + 1
      setReadAloudAttemptCount(nextAttemptCount)
      setRecognitionError(message)
      if (nextAttemptCount >= MAX_ATTEMPTS) {
        stageAnswer('wrong', `已尝试3次，正确读音：${question.answer}`)
      }
    } finally {
      const recording = await stopRecording?.()
      if (recording) {
        setRecordingUrl((currentUrl) => {
          if (currentUrl) URL.revokeObjectURL(currentUrl)
          return URL.createObjectURL(recording)
        })
      }
      setIsListening(false)
    }
  }

  const saveRecording = (recording: Blob | null) => {
    if (!recording) return
    setRecordingUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl)
      return URL.createObjectURL(recording)
    })
  }

  const handleManualRecording = async () => {
    if (hasAnswered || isSubmitting) return

    if (manualRecordingStopRef.current) {
      const stop = manualRecordingStopRef.current
      manualRecordingStopRef.current = null
      saveRecording(await stop())
      setIsListening(false)
      setReadAloudAttemptCount((count) => count + 1)
      return
    }

    setRecognitionError('')
    setRecordingUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl)
      return ''
    })
    setMicrophoneStatus('checking')
    try {
      const stop = await beginLocalRecording()
      if (!stop) {
        setMicrophoneStatus('denied')
        setRecognitionError(window.isSecureContext
          ? '当前浏览器无法进行网页录音。建议安装最新版 Chrome，或在设置中暂时关闭朗读题。'
          : '请使用 HTTPS 公网地址打开，普通局域网 HTTP 地址不能使用麦克风。')
        return
      }
      manualRecordingStopRef.current = stop
      setMicrophoneStatus('granted')
      setIsListening(true)
    } catch (error) {
      setMicrophoneStatus('denied')
      setRecognitionError(getMicrophoneErrorMessage(error))
    }
  }

  const handleManualPass = () => {
    stageAnswer('correct', '已完成录音跟读。', {
      pronunciation: {
        engine: 'manual-recording',
        attemptCount: Math.max(1, readAloudAttemptCount),
      },
    })
  }

  const renderListenButtons = () => (
    <div className="listen-actions">
      <Button className="button--listen" onClick={() => speakEnglish(word.text)} type="button" variant="ghost">
        🔊 听发音
      </Button>
    </div>
  )

  const selectedChunks = question.type === 'spelling'
    ? selectedChunkIndices.map((chunkIndex) => question.chunkOptions[chunkIndex])
    : []

  return (
    <div className="question-panel">
      <div className="question-panel__header">
        <div>
          <div className="question-panel__meta">{getQuestionInstruction(questionType)}</div>
          {word.partOfSpeech && <div className="question-panel__hint">词性：{word.partOfSpeech}</div>}
        </div>
        <div className="question-panel__header-actions">
          <Button className="button--star" onClick={handleToggleStar} type="button" variant="ghost">
            {isStarred ? '⭐' : '☆'}
          </Button>
          {comboCount !== undefined && comboCount >= 2 && (
            <div className="question-panel__combo">
              <span className="question-panel__combo-fire">🔥</span>
              <span className="question-panel__combo-text">连击 ×{comboCount}</span>
            </div>
          )}
        </div>
      </div>
      <div className="question-panel__prompt-row">
        <h2 className="question-panel__prompt">{question.prompt}</h2>
        {questionType === 'enToZh' && renderListenButtons()}
      </div>

      {question.type === 'choice' && (
        <div className="question-panel__options">
          {question.options.map((option) => {
            const isSelected = selectedAnswer === option
            const isAnswer = option === question.answer
            return (
              <button
                className={`choice-option ${isSelected ? 'choice-option--selected' : ''} ${hasAnswered && isAnswer ? 'choice-option--answer' : ''}`}
                disabled={hasAnswered || isSubmitting}
                key={option}
                onClick={() => handleChoice(option)}
                type="button"
              >
                {option}
              </button>
            )
          })}
        </div>
      )}

      {question.type === 'spelling' && (
        <div className="chunk-builder">
          <div className="spelling-box__hint-row">
            <p className="spelling-box__hint-text">按顺序选择字母组合，拼出英文单词</p>
            {renderListenButtons()}
          </div>

          {showCorrectAnswer && !hasAnswered && (
            <p className="question-panel__feedback question-panel__feedback--wrong">
              正确答案：{question.answer}
            </p>
          )}

          <div className="chunk-builder__answer" aria-label="已选择的字母组合">
            {selectedChunks.length === 0 ? (
              <span className="chunk-builder__placeholder">点击下方组合开始拼词</span>
            ) : (
              selectedChunks.map((chunk, index) => (
                <span className="chunk-builder__selected" key={`${chunk}-${index}`}>{chunk}</span>
              ))
            )}
          </div>

          <div className="chunk-builder__options" aria-label="可选字母组合">
            {question.chunkOptions.map((chunk, index) => {
              const isSelected = selectedChunkIndices.includes(index)
              return (
                <button
                  className={`chunk-option ${isSelected ? 'chunk-option--selected' : ''}`}
                  disabled={isSelected || hasAnswered || isSubmitting || showCorrectAnswer}
                  key={`${chunk}-${index}`}
                  onClick={() => handleSelectChunk(index)}
                  type="button"
                >
                  {chunk}
                </button>
              )
            })}
          </div>

          <div className="chunk-builder__actions">
            <Button disabled={selectedChunkIndices.length === 0 || hasAnswered || isSubmitting || showCorrectAnswer} onClick={handleUndoChunk} type="button" variant="ghost">撤销</Button>
            <Button disabled={selectedChunkIndices.length === 0 || hasAnswered || isSubmitting || showCorrectAnswer} onClick={handleClearChunks} type="button" variant="secondary">清空</Button>
            <Button disabled={hasAnswered || isSubmitting || showCorrectAnswer} onClick={handleSpellingSubmit} type="button">提交</Button>
          </div>

          {spellingWrongCount > 0 && !hasAnswered && spellingWrongCount < MAX_ATTEMPTS && (
            <p className="question-panel__feedback">
              第 {spellingWrongCount} 次错误，还可以重试 {MAX_ATTEMPTS - spellingWrongCount} 次
            </p>
          )}
        </div>
      )}

      {question.type === 'readAloud' && (
        <div className={`read-aloud-box ${isListening ? 'read-aloud-box--recording' : ''}`}>
          <div>
            <p className="read-aloud-box__word">{question.answer}</p>
            <p className="muted">请听标准发音，然后点击开始朗读。</p>
          </div>
          {renderListenButtons()}
          {!speechRecognitionSupported && (
            <div className="read-aloud-fallback">
              <strong>兼容录音跟读</strong>
              <p>当前浏览器不支持自动语音评分，但仍可录音、回放并完成跟读。</p>
              <small>麦克风状态：{microphoneStatus === 'checking' ? '正在申请权限' : microphoneStatus === 'granted' ? '已开启' : microphoneStatus === 'denied' ? '未开启' : '等待开启'}</small>
            </div>
          )}
          {recognizedTranscript && (
            <p className="read-aloud-box__transcript">我听到的是：{recognizedTranscript}</p>
          )}
          {matchScore !== null && (
            <div className="read-aloud-score" aria-label={`识别匹配度 ${matchScore} 分`}>
              <strong>{matchScore}</strong>
              <span>识别匹配度</span>
              <small>当前为文字识别匹配，并非音素发音分</small>
            </div>
          )}
          {recordingUrl && (
            <div className="read-aloud-playback">
              <span>听听我的朗读</span>
              <audio controls playsInline preload="metadata" src={recordingUrl} />
            </div>
          )}
          {recognitionError && (
            <p className="question-panel__feedback question-panel__feedback--wrong">{recognitionError}</p>
          )}
          <div className="read-aloud-box__actions">
            {speechRecognitionSupported ? (
              <Button disabled={hasAnswered || isSubmitting || isListening} onClick={() => void handleReadAloudStart()} type="button">
                {isListening ? '● 正在录音并识别……' : '🎙 开始朗读'}
              </Button>
            ) : (
              <>
                <Button disabled={hasAnswered || isSubmitting} onClick={() => void handleManualRecording()} type="button">
                  {isListening ? '■ 停止录音' : recordingUrl ? '🎙 重新录音' : '🎙 开启麦克风并录音'}
                </Button>
                {recordingUrl && <Button disabled={hasAnswered || isSubmitting} onClick={handleManualPass} type="button" variant="secondary">朗读完成</Button>}
                <Button disabled={hasAnswered || isSubmitting || isListening} onClick={() => stageAnswer('skipped', '已跳过跟读题。')} type="button" variant="ghost">跳过本题</Button>
              </>
            )}
          </div>
          {readAloudAttemptCount > 0 && !hasAnswered && readAloudAttemptCount < MAX_ATTEMPTS && (
            <p className="question-panel__feedback">
              第 {readAloudAttemptCount} 次未通过，还可以重试 {MAX_ATTEMPTS - readAloudAttemptCount} 次
            </p>
          )}
        </div>
      )}

      {pendingAnswer && (
        <p className={`question-panel__feedback question-panel__feedback--${pendingAnswer.result}`}>
          {pendingAnswer.feedback}
        </p>
      )}
      {submitError && <p className="question-panel__feedback question-panel__feedback--error">{submitError}</p>}

      <div className="question-panel__actions">
        {pendingAnswer ? (
          <Button disabled={isSubmitting} onClick={handleNext} type="button">
            {isSubmitting ? '保存中……' : '立即下一题'}
          </Button>
        ) : (
          <>
            <Button disabled={isSubmitting || isListening} onClick={() => stageAnswer('fuzzy', '已标记为模糊，马上进入下一题。')} type="button" variant="secondary">模糊</Button>
            <Button disabled={isSubmitting || isListening} onClick={() => stageAnswer('skipped', '已跳过，之后会重新安排。')} type="button" variant="ghost">跳过</Button>
          </>
        )}
      </div>
    </div>
  )
}

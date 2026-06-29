import { useEffect, useMemo, useRef, useState } from 'react'
import { playAnswerSound, playComboSound, speakEnglish } from '../../domain/study/audioFeedback'
import { normalizeBuiltAnswer, normalizeChunkComparison } from '../../domain/study/chunking'
import { createQuestion, type StudyQuestion } from '../../domain/study/questionFactory'
import { isSpeechRecognitionSupported, recognizeEnglishOnce, scoreReadAloud } from '../../domain/study/speechRecognition'
import type { AnswerResult } from '../../domain/study/types'
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
  onAnswer: (result: AnswerResult) => Promise<void> | void
  onToggleStar?: (wordId: string) => void
}

type PendingAnswer = {
  result: AnswerResult
  feedback: string
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
    if (soundEnabled && questionType === 'readAloud') {
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
    }
  }, [])

  const handleNext = async () => {
    if (!pendingAnswer || isSubmitting || hasSubmittedRef.current) return

    clearAutoAdvanceTimer()
    hasSubmittedRef.current = true
    setSubmitError('')
    setIsSubmitting(true)
    try {
      await onAnswer(pendingAnswer.result)
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

  const stageAnswer = (result: AnswerResult, feedback: string) => {
    if (hasAnswered || isSubmitting) return
    playAnswerSound(result, soundEnabled)
    if (result === 'correct' && comboCount && comboCount >= 2) {
      playComboSound(comboCount, soundEnabled)
    }
    setPendingAnswer({ result, feedback })
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
      setRecognitionError('当前浏览器不支持语音识别，请使用 Chrome 或 Edge。')
      return
    }

    setIsListening(true)
    setRecognitionError('')
    setRecognizedTranscript('')

    try {
      const transcript = await recognizeEnglishOnce()
      setRecognizedTranscript(transcript)

      if (scoreReadAloud(question.answer, transcript)) {
        stageAnswer('correct', '朗读通过，马上进入下一题。')
        return
      }

      const nextAttemptCount = readAloudAttemptCount + 1
      setReadAloudAttemptCount(nextAttemptCount)
      if (nextAttemptCount >= MAX_ATTEMPTS) {
        stageAnswer('wrong', `已尝试3次，正确读音：${question.answer}`)
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
      setIsListening(false)
    }
  }

  const renderListenButtons = () => (
    <div className="listen-actions">
      <Button className="button--listen" onClick={() => speakEnglish(word.text)} type="button" variant="ghost">
        🔊 正常
      </Button>
      <Button className="button--listen" onClick={() => speakEnglish(word.text, 'slow')} type="button" variant="ghost">
        🐢 慢速
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
        <div className="read-aloud-box">
          <div>
            <p className="read-aloud-box__word">{question.answer}</p>
            <p className="muted">请听标准发音，然后点击开始朗读。</p>
          </div>
          {renderListenButtons()}
          {!speechRecognitionSupported && (
            <p className="question-panel__feedback question-panel__feedback--error">
              当前浏览器不支持语音识别，请使用 Chrome 或 Edge。你可以跳过本题。
            </p>
          )}
          {recognizedTranscript && (
            <p className="read-aloud-box__transcript">我听到的是：{recognizedTranscript}</p>
          )}
          {recognitionError && (
            <p className="question-panel__feedback question-panel__feedback--wrong">{recognitionError}</p>
          )}
          <div className="read-aloud-box__actions">
            <Button disabled={!speechRecognitionSupported || hasAnswered || isSubmitting || isListening} onClick={() => void handleReadAloudStart()} type="button">
              {isListening ? '正在听……' : '🎙 开始朗读'}
            </Button>
            {!speechRecognitionSupported && (
              <Button disabled={hasAnswered || isSubmitting} onClick={() => stageAnswer('skipped', '已跳过跟读题。')} type="button" variant="ghost">跳过本题</Button>
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

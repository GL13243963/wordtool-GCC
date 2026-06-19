import { useEffect, useMemo, useRef, useState } from 'react'
import { playAnswerSound, playComboSound, speakEnglish } from '../../domain/study/audioFeedback'
import { createQuestion, evaluateAnswer, type StudyQuestion } from '../../domain/study/questionFactory'
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
  if (questionType === 'enToZh') return '阶段 1/2：看英文，选择中文意思'
  return '阶段 2/2：根据中文意思拼写英文'
}

export const QuestionPanel = ({ word, allWords, questionType, soundEnabled, isFirstEncounter, comboCount, isStarred, onAnswer, onToggleStar }: QuestionPanelProps) => {
  const question = useMemo(
    () => createQuestion({ word, allWords, questionType }),
    [allWords, questionType, word],
  )
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [letterInputs, setLetterInputs] = useState<string[]>([]) // 每个字母的输入
  const [spellingWrongCount, setSpellingWrongCount] = useState(0) // 拼写错误次数（最多3次）
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false) // 是否暂时显示正确答案
  const [pendingAnswer, setPendingAnswer] = useState<PendingAnswer | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 初始化字母输入框
  useEffect(() => {
    if (question.type === 'spelling') {
      // 用 maskedWord 初始化，显示的字母预填充，隐藏的字母留空
      const initial = question.maskedWord.split('').map((char) => (char === '_' ? '' : char))
      setLetterInputs(initial)
    }
  }, [question])

  // 单个字母输入变化
  const handleLetterChange = (index: number, value: string) => {
    if (showCorrectAnswer || hasAnswered || isSubmitting) return

    // 只允许输入单个字母（保留用户输入的大小写）
    const letter = value.slice(-1)
    const newInputs = [...letterInputs]
    newInputs[index] = letter
    setLetterInputs(newInputs)

    // 自动聚焦到下一个空的输入框
    if (letter && index < newInputs.length - 1) {
      const nextEmpty = newInputs.findIndex((l, i) => i > index && l === '')
      if (nextEmpty !== -1) {
        const nextInput = document.querySelector(`[data-letter-index="${nextEmpty}"]`) as HTMLInputElement
        nextInput?.focus()
      }
    }
  }

  // 处理退格键
  const handleLetterKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !letterInputs[index] && index > 0) {
      // 当前为空，按退格则跳到上一个
      const prevInput = document.querySelector(`[data-letter-index="${index - 1}"]`) as HTMLInputElement
      prevInput?.focus()
    }
  }

  const handleToggleStar = async () => {
    await toggleWordStar(word.id)
    onToggleStar?.(word.id)
  }
  const hasSubmittedRef = useRef(false)
  const autoAdvanceTimerRef = useRef<number | null>(null)
  const hasAnswered = pendingAnswer !== null

  // 首次出现时自动发音（英译中阶段）
  useEffect(() => {
    if (isFirstEncounter && soundEnabled && questionType === 'enToZh') {
      const timer = window.setTimeout(() => {
        speakEnglish(word.text)
      }, 200)
      return () => window.clearTimeout(timer)
    }
  }, [isFirstEncounter, soundEnabled, word.text, questionType])

  const clearAutoAdvanceTimer = () => {
    if (autoAdvanceTimerRef.current === null) return

    window.clearTimeout(autoAdvanceTimerRef.current)
    autoAdvanceTimerRef.current = null
  }

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

  const handleSpellingSubmit = () => {
    if (question.type !== 'spelling') return
    if (hasAnswered || isSubmitting || showCorrectAnswer) return

    // 检查是否所有字母都填了
    if (letterInputs.some((l) => l === '')) {
      setSubmitError('请填完所有字母')
      setTimeout(() => setSubmitError(''), 1500)
      return
    }

    const userAnswer = letterInputs.join('')
    const isCorrect = evaluateAnswer(question.answer, userAnswer)
    if (isCorrect) {
      stageAnswer('correct', '拼写正确，马上进入下一题。')
      return
    }

    // 答错了
    const newWrongCount = spellingWrongCount + 1
    setSpellingWrongCount(newWrongCount)

    // 显示正确答案并朗读
    setShowCorrectAnswer(true)
    if (soundEnabled) {
      setTimeout(() => speakEnglish(question.answer), 300)
    }

    // 1.5秒后隐藏答案，重置输入框，让用户重试
    setTimeout(() => {
      setShowCorrectAnswer(false)
      // 重置为 maskedWord 的状态
      const reset = question.maskedWord.split('').map((char) => (char === '_' ? '' : char))
      setLetterInputs(reset)
      // 聚焦第一个空输入框
      const firstEmpty = reset.findIndex((l) => l === '')
      if (firstEmpty !== -1) {
        const firstInput = document.querySelector(`[data-letter-index="${firstEmpty}"]`) as HTMLInputElement
        firstInput?.focus()
      }
    }, 1500)

    // 第3次答错后才标记为错误并进入下一题
    if (newWrongCount >= 3) {
      stageAnswer('wrong', `已重试3次，正确拼写：${question.answer}`)
    }
  }

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
        {questionType === 'enToZh' && (
          <Button className="button--listen" onClick={() => speakEnglish(word.text)} type="button" variant="ghost">
            🔊 听发音
          </Button>
        )}
      </div>

      {question.type === 'choice' ? (
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
      ) : (
        <div className="spelling-box">
          <div className="spelling-box__hint-row">
            <p className="spelling-box__hint-text">根据中文意思，补全单词拼写</p>
            <Button className="button--listen" onClick={() => speakEnglish(word.text)} type="button" variant="ghost">
              🔊 听发音
            </Button>
          </div>

          {/* 暂时显示正确答案 */}
          {showCorrectAnswer && !hasAnswered && (
            <p className="question-panel__feedback question-panel__feedback--wrong">
              正确答案：{question.answer}
            </p>
          )}

          {/* 填字母输入框 */}
          <div className="letter-inputs">
            {letterInputs.map((letter, index) => {
              const isHidden = question.maskedWord[index] === '_'
              return (
                <input
                  key={index}
                  aria-label={`第${index + 1}个字母`}
                  className={`letter-input ${isHidden ? 'letter-input--hidden' : 'letter-input--shown'}`}
                  data-letter-index={index}
                  disabled={hasAnswered || isSubmitting || showCorrectAnswer || !isHidden}
                  maxLength={1}
                  onChange={(event) => handleLetterChange(index, event.target.value)}
                  onKeyDown={(event) => handleLetterKeyDown(index, event)}
                  value={letter}
                />
              )
            })}
          </div>

          <Button disabled={hasAnswered || isSubmitting || showCorrectAnswer} onClick={handleSpellingSubmit} type="button">提交</Button>

          {spellingWrongCount > 0 && !hasAnswered && spellingWrongCount < 3 && (
            <p className="question-panel__feedback">
              第 {spellingWrongCount} 次错误，还可以重试 {3 - spellingWrongCount} 次
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
            <Button disabled={isSubmitting} onClick={() => stageAnswer('fuzzy', '已标记为模糊，马上进入下一题。')} type="button" variant="secondary">模糊</Button>
            <Button disabled={isSubmitting} onClick={() => stageAnswer('skipped', '已跳过，之后会重新安排。')} type="button" variant="ghost">跳过</Button>
          </>
        )}
      </div>
    </div>
  )
}

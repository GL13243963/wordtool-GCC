import { useEffect, useMemo, useRef, useState } from 'react'
import { playAnswerSound, speakEnglish } from '../../domain/study/audioFeedback'
import { createQuestion, evaluateAnswer, type StudyQuestion } from '../../domain/study/questionFactory'
import type { AnswerResult } from '../../domain/study/types'
import type { Word } from '../../domain/vocabulary/types'
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
  onAnswer: (result: AnswerResult) => Promise<void> | void
}

type PendingAnswer = {
  result: AnswerResult
  feedback: string
}

const getQuestionInstruction = (questionType: StudyQuestion['questionType']) => {
  if (questionType === 'enToZh') return '看英文，选择中文意思'
  if (questionType === 'zhToEn') return '看中文，选择英文单词'
  return '根据中文意思拼写英文'
}

export const QuestionPanel = ({ word, allWords, questionType, soundEnabled, onAnswer }: QuestionPanelProps) => {
  const question = useMemo(
    () => createQuestion({ word, allWords, questionType }),
    [allWords, questionType, word],
  )
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [spellingAnswer, setSpellingAnswer] = useState('')
  const [spellingAttempts, setSpellingAttempts] = useState(0)
  const [pendingAnswer, setPendingAnswer] = useState<PendingAnswer | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const hasSubmittedRef = useRef(false)
  const autoAdvanceTimerRef = useRef<number | null>(null)
  const hasAnswered = pendingAnswer !== null

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
    if (!spellingAnswer.trim() || hasAnswered || isSubmitting) return

    const isCorrect = evaluateAnswer(question.answer, spellingAnswer)
    if (isCorrect) {
      stageAnswer('correct', '拼写正确，马上进入下一题。')
      return
    }

    if (spellingAttempts === 0) {
      setSpellingAttempts(1)
      return
    }

    stageAnswer('wrong', `正确拼写：${question.answer}`)
  }

  return (
    <div className="question-panel">
      <div>
        <div className="question-panel__meta">{getQuestionInstruction(questionType)}</div>
        {word.partOfSpeech && <div className="question-panel__hint">词性：{word.partOfSpeech}</div>}
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
          <p className="question-panel__hint">提示：{question.answer.length} 个字符，首字母 {question.answer[0]?.toUpperCase()}</p>
          <input
            aria-label="输入英文拼写"
            className="spelling-box__input"
            disabled={hasAnswered || isSubmitting}
            onChange={(event) => setSpellingAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSpellingSubmit()
            }}
            placeholder="输入英文单词"
            value={spellingAnswer}
          />
          <Button disabled={hasAnswered || isSubmitting} onClick={handleSpellingSubmit} type="button">提交</Button>
          {spellingAttempts === 1 && !hasAnswered && (
            <p className="question-panel__feedback">再试一次，注意拼写。</p>
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

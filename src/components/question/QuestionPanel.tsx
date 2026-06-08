import { useMemo, useState } from 'react'
import { createQuestion, evaluateAnswer, type StudyQuestion } from '../../domain/study/questionFactory'
import type { AnswerResult } from '../../domain/study/types'
import type { Word } from '../../domain/vocabulary/types'
import { Button } from '../ui/Button'

export type QuestionPanelProps = {
  word: Word
  allWords: Word[]
  questionType: StudyQuestion['questionType']
  onAnswer: (result: AnswerResult) => Promise<void> | void
}

type PendingAnswer = {
  result: AnswerResult
  feedback: string
}

export const QuestionPanel = ({ word, allWords, questionType, onAnswer }: QuestionPanelProps) => {
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
  const hasAnswered = pendingAnswer !== null

  const stageAnswer = (result: AnswerResult, feedback: string) => {
    if (hasAnswered || isSubmitting) return
    setPendingAnswer({ result, feedback })
  }

  const handleChoice = (option: string) => {
    if (hasAnswered || isSubmitting) return

    setSelectedAnswer(option)
    const isCorrect = option === question.answer
    stageAnswer(isCorrect ? 'correct' : 'wrong', isCorrect ? '回答正确！' : `正确答案：${question.answer}`)
  }

  const handleSpellingSubmit = () => {
    if (question.type !== 'spelling') return
    if (!spellingAnswer.trim() || hasAnswered || isSubmitting) return

    const isCorrect = evaluateAnswer(question.answer, spellingAnswer)
    if (isCorrect) {
      stageAnswer('correct', '拼写正确！')
      return
    }

    if (spellingAttempts === 0) {
      setSpellingAttempts(1)
      return
    }

    stageAnswer('wrong', `正确拼写：${question.answer}`)
  }

  const handleNext = async () => {
    if (!pendingAnswer || isSubmitting) return

    setSubmitError('')
    setIsSubmitting(true)
    try {
      await onAnswer(pendingAnswer.result)
    } catch {
      setSubmitError('保存失败，请检查浏览器本地存储后重试。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="question-panel">
      <div className="question-panel__meta">{questionType === 'spelling' ? '拼写题' : '选择题'}</div>
      <h2 className="question-panel__prompt">{question.prompt}</h2>

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

      {pendingAnswer && <p className="question-panel__feedback">{pendingAnswer.feedback}</p>}
      {submitError && <p className="question-panel__feedback question-panel__feedback--error">{submitError}</p>}

      <div className="question-panel__actions">
        {pendingAnswer ? (
          <Button disabled={isSubmitting} onClick={handleNext} type="button">
            {isSubmitting ? '保存中……' : '下一题'}
          </Button>
        ) : (
          <>
            <Button disabled={isSubmitting} onClick={() => stageAnswer('fuzzy', '已标记为模糊，稍后会加强复习。')} type="button" variant="secondary">模糊</Button>
            <Button disabled={isSubmitting} onClick={() => stageAnswer('skipped', '已跳过，之后会重新安排。')} type="button" variant="ghost">跳过</Button>
          </>
        )}
      </div>
    </div>
  )
}

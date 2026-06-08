import type { AppSettings } from '../settings/types'
import type { Word } from '../vocabulary/types'
import type { QuestionItem, QuestionType, WordProgress } from './types'

const QUESTION_SEQUENCE: QuestionType[] = ['enToZh', 'zhToEn', 'spelling']

const getEnabledQuestionTypes = (settings: AppSettings): QuestionType[] =>
  QUESTION_SEQUENCE.filter((questionType) => {
    if (questionType === 'enToZh') return settings.questionTypesEnabled.enToZh
    if (questionType === 'zhToEn') return settings.questionTypesEnabled.zhToEn
    return settings.questionTypesEnabled.spelling
  })

const getNextQuestionType = (enabledQuestionTypes: QuestionType[], progress?: WordProgress): QuestionType => {
  const fallback = enabledQuestionTypes[0] ?? 'enToZh'
  if (!progress || progress.completedQuestionTypes.length === 0) return fallback

  return enabledQuestionTypes.find((questionType) => !progress.completedQuestionTypes.includes(questionType)) ?? fallback
}

const byPriority = (now: number) => (left: WordProgress, right: WordProgress) => {
  const leftDue = left.nextReviewAt ?? 0
  const rightDue = right.nextReviewAt ?? 0
  const leftWrongWeight = left.wrongCount * 10 + left.fuzzyCount * 5
  const rightWrongWeight = right.wrongCount * 10 + right.fuzzyCount * 5

  if (leftWrongWeight !== rightWrongWeight) return rightWrongWeight - leftWrongWeight
  return Math.min(leftDue, now) - Math.min(rightDue, now)
}

export type DailyTaskPlan = {
  newWords: Word[]
  reviewWords: Word[]
  questionQueue: QuestionItem[]
}

export const createDailyTaskPlan = ({
  words,
  progressByWordId,
  settings,
  now,
}: {
  words: Word[]
  progressByWordId: Map<string, WordProgress>
  settings: AppSettings
  now: number
}): DailyTaskPlan => {
  const enabledQuestionTypes = getEnabledQuestionTypes(settings)
  const currentUnitWords = words.filter((word) => word.unitId === settings.currentUnitId)
  const newWords = currentUnitWords
    .filter((word) => !progressByWordId.has(word.id) || progressByWordId.get(word.id)?.status === 'new')
    .slice(0, settings.dailyNewWordLimit)

  const newWordIds = new Set(newWords.map((word) => word.id))
  const reviewWords = words
    .filter((word) => !newWordIds.has(word.id))
    .filter((word) => {
      const progress = progressByWordId.get(word.id)
      return progress?.nextReviewAt !== undefined && progress.nextReviewAt <= now
    })
    .sort((left, right) => byPriority(now)(progressByWordId.get(left.id)!, progressByWordId.get(right.id)!))
    .slice(0, settings.dailyReviewLimit)

  const orderedWords = [...reviewWords.slice(0, 3), ...newWords, ...reviewWords.slice(3)]
  const questionQueue = orderedWords.map((word, index) => {
    const progress = progressByWordId.get(word.id)
    const questionType = progress
      ? getNextQuestionType(enabledQuestionTypes, progress)
      : enabledQuestionTypes[index % enabledQuestionTypes.length]

    return {
      id: `${now}-${word.id}-${index}`,
      wordId: word.id,
      unitId: word.unitId,
      questionType,
      status: 'pending' as const,
    }
  })

  return { newWords, reviewWords, questionQueue }
}

import type { AppSettings } from '../settings/types'
import type { Word } from '../vocabulary/types'
import type { QuestionItem, WordProgress } from './types'



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
  const questionQueue: QuestionItem[] = []

  orderedWords.forEach((word, _wordIndex) => {
    const progress = progressByWordId.get(word.id)
    let questionIndex = 0

    // 总是生成英译中题
    questionQueue.push({
      id: `${now}-${word.id}-${questionIndex++}`,
      wordId: word.id,
      unitId: word.unitId,
      questionType: 'enToZh',
      status: 'pending' as const,
    })

    // 如果已见过（不是全新单词），额外生成拼写题
    if (progress && progress.seenCount >= 1) {
      questionQueue.push({
        id: `${now}-${word.id}-${questionIndex++}`,
        wordId: word.id,
        unitId: word.unitId,
        questionType: 'spelling',
        status: 'pending' as const,
      })
    }
  })

  return { newWords, reviewWords, questionQueue }
}

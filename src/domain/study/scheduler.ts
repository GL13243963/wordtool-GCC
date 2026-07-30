import type { AppSettings } from '../settings/types'
import type { Word } from '../vocabulary/types'
import type { QuestionItem, WordProgress } from './types'

const MAX_DAILY_READ_ALOUD_QUESTIONS = 5

export type DailyTaskPlan = {
  newWords: Word[]
  reviewWords: Word[]
  questionQueue: QuestionItem[]
}

const getWordPriority = (_word: Word, progress: WordProgress | undefined, now: number) => {
  if (!progress) return 20

  const isDue = progress.nextReviewAt !== undefined && progress.nextReviewAt <= now
  const recencyBoost = progress.lastAnswerResult === 'wrong'
    ? 60
    : progress.lastAnswerResult === 'fuzzy'
      ? 35
      : 0
  const weaknessScore = progress.wrongCount * 12 + progress.fuzzyCount * 7
  const dueScore = isDue ? 25 : 0
  const lowMasteryScore = Math.max(0, 100 - progress.masteryScore) / 5

  return recencyBoost + weaknessScore + dueScore + lowMasteryScore
}

const orderWordsForPractice = (words: Word[], progressByWordId: Map<string, WordProgress>, now: number) =>
  [...words].sort((left, right) => {
    const rightPriority = getWordPriority(right, progressByWordId.get(right.id), now)
    const leftPriority = getWordPriority(left, progressByWordId.get(left.id), now)

    if (rightPriority !== leftPriority) return rightPriority - leftPriority
    return left.id.localeCompare(right.id)
  })

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
  const orderedWords = orderWordsForPractice(currentUnitWords, progressByWordId, now)
  const newWordCandidates = orderedWords.filter((word) => {
    const progress = progressByWordId.get(word.id)
    return !progress || progress.status === 'new'
  })
  const reviewWordCandidates = orderedWords.filter((word) => !newWordCandidates.includes(word))
  const selectedWords = [
    ...newWordCandidates.slice(0, settings.dailyNewWordLimit),
    ...reviewWordCandidates.slice(0, settings.dailyReviewLimit),
  ]
  const choiceWords = settings.questionTypesEnabled.enToZh ? selectedWords : []
  // The queue is created before the lesson starts. New words therefore need all
  // enabled stages scheduled up front; waiting for seenCount to change would make
  // the lesson end after the choice stage without ever adding spelling or reading.
  const spellingWords = settings.questionTypesEnabled.spelling ? selectedWords : []
  const readAloudWords = settings.questionTypesEnabled.readAloud
    ? selectedWords.slice(0, MAX_DAILY_READ_ALOUD_QUESTIONS)
    : []

  const newWords = selectedWords.filter((word) => {
    const progress = progressByWordId.get(word.id)
    return !progress || progress.status === 'new'
  })
  const reviewWords = selectedWords.filter((word) => newWords.indexOf(word) === -1)

  const choiceQuestions: QuestionItem[] = choiceWords.map((word) => ({
    id: `${now}-${word.id}-enToZh`,
    wordId: word.id,
    unitId: word.unitId,
    questionType: 'enToZh',
    status: 'pending' as const,
  }))

  const spellingQuestions: QuestionItem[] = spellingWords.map((word) => ({
    id: `${now}-${word.id}-spelling`,
    wordId: word.id,
    unitId: word.unitId,
    questionType: 'spelling',
    status: 'pending' as const,
  }))

  const readAloudQuestions: QuestionItem[] = readAloudWords.map((word) => ({
    id: `${now}-${word.id}-readAloud`,
    wordId: word.id,
    unitId: word.unitId,
    questionType: 'readAloud',
    status: 'pending' as const,
  }))

  return { newWords, reviewWords, questionQueue: [...choiceQuestions, ...spellingQuestions, ...readAloudQuestions] }
}

import type { AppSettings } from '../settings/types'
import type { Word } from '../vocabulary/types'
import type { QuestionItem, WordProgress } from './types'

const MAX_DAILY_CHOICE_QUESTIONS = 20
const MAX_DAILY_SPELLING_QUESTIONS = 20

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
  const choiceWords = settings.questionTypesEnabled.enToZh ? orderedWords.slice(0, MAX_DAILY_CHOICE_QUESTIONS) : []
  const spellingWords = settings.questionTypesEnabled.spelling
    ? orderedWords
      .filter((word) => (progressByWordId.get(word.id)?.seenCount ?? 0) >= 1)
      .slice(0, MAX_DAILY_SPELLING_QUESTIONS)
    : []
  const selectedWords = Array.from(new Map([...choiceWords, ...spellingWords].map((word) => [word.id, word])).values())

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

  return { newWords, reviewWords, questionQueue: [...choiceQuestions, ...spellingQuestions] }
}

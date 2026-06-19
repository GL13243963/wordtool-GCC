import type { AppSettings } from '../settings/types'
import type { Word } from '../vocabulary/types'
import type { QuestionItem, WordProgress } from './types'

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

  // 所有单词按优先级排序：错词优先，然后是新词，然后是到复习时间的词
  const orderedWords = [...currentUnitWords].sort((left, right) => {
    const leftProgress = progressByWordId.get(left.id)
    const rightProgress = progressByWordId.get(right.id)

    // 全新词排后面
    if (!leftProgress) return 1
    if (!rightProgress) return -1

    // 错的多的排前面
    const leftWrong = leftProgress.wrongCount * 10 + leftProgress.fuzzyCount * 5
    const rightWrong = rightProgress.wrongCount * 10 + rightProgress.fuzzyCount * 5

    return rightWrong - leftWrong
  })

  const newWords = orderedWords.filter((word) => {
    const progress = progressByWordId.get(word.id)
    return !progress || progress.status === 'new'
  })
  const reviewWords = orderedWords.filter((word) => newWords.indexOf(word) === -1)

  const questionQueue: QuestionItem[] = []

  // 第一阶段：所有单词先生成英译中选择题
  orderedWords.forEach((word, _wordIndex) => {
    questionQueue.push({
      id: `${now}-${word.id}-enToZh`,
      wordId: word.id,
      unitId: word.unitId,
      questionType: 'enToZh',
      status: 'pending' as const,
    })
  })

  // 第二阶段：所有已见过的单词生成拼写题
  orderedWords.forEach((word) => {
    const progress = progressByWordId.get(word.id)
    if (progress && progress.seenCount >= 1) {
      questionQueue.push({
        id: `${now}-${word.id}-spelling`,
        wordId: word.id,
        unitId: word.unitId,
        questionType: 'spelling',
        status: 'pending' as const,
      })
    }
  })

  return { newWords, reviewWords, questionQueue }
}

import type { Word } from '../vocabulary/types'
import type { WordProgress } from './types'

export type UnitStats = {
  learnedCount: number
  masteredCount: number
  masteryRate: number
}

export const getUnitStats = (unitWords: Word[], progressMap: Map<string, WordProgress>): UnitStats => {
  if (unitWords.length === 0) {
    return { learnedCount: 0, masteredCount: 0, masteryRate: 0 }
  }

  const totalMasteryScore = unitWords.reduce((sum, word) => sum + (progressMap.get(word.id)?.masteryScore ?? 0), 0)
  const learnedCount = unitWords.filter((word) => (progressMap.get(word.id)?.seenCount ?? 0) > 0).length
  const masteredCount = unitWords.filter((word) => progressMap.get(word.id)?.status === 'mastered').length

  return {
    learnedCount,
    masteredCount,
    masteryRate: totalMasteryScore / unitWords.length / 100,
  }
}

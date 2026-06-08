import type { Word } from '../vocabulary/types'
import type { UnitProgress, WordProgress } from './types'

export const calculateUnitMasteryRate = ({
  unitWords,
  progressByWordId,
}: {
  unitWords: Word[]
  progressByWordId: Map<string, WordProgress>
}) => {
  if (unitWords.length === 0) return 0

  const masteredCount = unitWords.filter((word) => progressByWordId.get(word.id)?.status === 'mastered').length
  return masteredCount / unitWords.length
}

export const getAppearedWordCount = ({
  unitWords,
  progressByWordId,
}: {
  unitWords: Word[]
  progressByWordId: Map<string, WordProgress>
}) => unitWords.filter((word) => (progressByWordId.get(word.id)?.seenCount ?? 0) > 0).length

export const canTakeUnitQuiz = ({
  unitWords,
  progressByWordId,
  masteryThreshold,
}: {
  unitWords: Word[]
  progressByWordId: Map<string, WordProgress>
  masteryThreshold: number
}) =>
  unitWords.length > 0 &&
  getAppearedWordCount({ unitWords, progressByWordId }) === unitWords.length &&
  calculateUnitMasteryRate({ unitWords, progressByWordId }) >= masteryThreshold

export const deriveUnitProgress = ({
  studentId,
  unitId,
  unitWords,
  progressByWordId,
  masteryThreshold,
  existing,
  now,
}: {
  studentId: string
  unitId: string
  unitWords: Word[]
  progressByWordId: Map<string, WordProgress>
  masteryThreshold: number
  existing?: UnitProgress
  now: number
}): UnitProgress => {
  const masteryRate = calculateUnitMasteryRate({ unitWords, progressByWordId })
  const appearedWordCount = getAppearedWordCount({ unitWords, progressByWordId })
  const isReady = unitWords.length > 0 && appearedWordCount === unitWords.length && masteryRate >= masteryThreshold
  const status = existing?.status === 'passed'
    ? 'passed'
    : isReady
      ? 'readyForTest'
      : appearedWordCount > 0
        ? 'inProgress'
        : 'available'

  return {
    id: `${studentId}:${unitId}`,
    studentId,
    unitId,
    status,
    appearedWordCount,
    totalWordCount: unitWords.length,
    masteryRate,
    lastTestScore: existing?.lastTestScore,
    testAttemptCount: existing?.testAttemptCount ?? 0,
    passedAt: existing?.passedAt,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
}

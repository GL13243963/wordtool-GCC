import type { AnswerResult, QuestionType, WordProgress, WordStatus } from './types'

const SCORE_LIMITS = {
  min: 0,
  max: 100,
}

const QUESTION_SCORE_DELTA: Record<QuestionType, { correct: number; wrong: number }> = {
  enToZh: { correct: 10, wrong: -10 },
  spelling: { correct: 20, wrong: -20 },
  readAloud: { correct: 15, wrong: -15 },
}

const REVIEW_INTERVALS = [
  { maxScore: 20, delayMs: 10 * 60 * 1000 },
  { maxScore: 40, delayMs: 24 * 60 * 60 * 1000 },
  { maxScore: 60, delayMs: 2 * 24 * 60 * 60 * 1000 },
  { maxScore: 75, delayMs: 4 * 24 * 60 * 60 * 1000 },
  { maxScore: 85, delayMs: 7 * 24 * 60 * 60 * 1000 },
  { maxScore: 95, delayMs: 14 * 24 * 60 * 60 * 1000 },
  { maxScore: 100, delayMs: 30 * 24 * 60 * 60 * 1000 },
]

export type ApplyAnswerInput = {
  progress: WordProgress
  result: AnswerResult
  questionType: QuestionType
  answeredAt: number
}

export const clampMasteryScore = (score: number) =>
  Math.min(SCORE_LIMITS.max, Math.max(SCORE_LIMITS.min, score))

export const getReviewDelayMs = (masteryScore: number) =>
  REVIEW_INTERVALS.find((interval) => masteryScore <= interval.maxScore)?.delayMs ??
  REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1].delayMs

const getScoreDelta = (result: AnswerResult, questionType: QuestionType) => {
  if (result === 'correct') return QUESTION_SCORE_DELTA[questionType].correct
  if (result === 'wrong') return QUESTION_SCORE_DELTA[questionType].wrong
  if (result === 'fuzzy') return 2
  return 0
}

const getStatus = (progress: WordProgress, masteryScore: number, result: AnswerResult): WordStatus => {
  if (result === 'wrong' || result === 'fuzzy') return 'learning'

  const hasBothStages = new Set(progress.completedQuestionTypes).size >= 2
    || progress.completedQuestionTypes.includes('spelling')
  const hasEnoughSeenCount = progress.seenCount >= 3

  if (masteryScore >= 80 && hasBothStages && hasEnoughSeenCount) {
    return 'mastered'
  }

  return masteryScore >= 50 ? 'reviewing' : 'learning'
}

export const applyAnswerToProgress = ({
  progress,
  result,
  questionType,
  answeredAt,
}: ApplyAnswerInput): WordProgress => {
  const scoreDelta = getScoreDelta(result, questionType)
  const masteryScore = clampMasteryScore(progress.masteryScore + scoreDelta)
  const completedQuestionTypes = result === 'skipped'
    ? progress.completedQuestionTypes
    : Array.from(new Set([...progress.completedQuestionTypes, questionType]))
  const nextReviewAt = answeredAt + getReviewDelayMs(masteryScore)
  const seenCount = progress.seenCount + (result === 'skipped' ? 0 : 1)
  const nextProgress = {
    ...progress,
    seenCount,
    correctCount: progress.correctCount + (result === 'correct' ? 1 : 0),
    wrongCount: progress.wrongCount + (result === 'wrong' ? 1 : 0),
    fuzzyCount: progress.fuzzyCount + (result === 'fuzzy' ? 1 : 0),
    skippedCount: progress.skippedCount + (result === 'skipped' ? 1 : 0),
    masteryScore,
    completedQuestionTypes,
    familiarity: result === 'correct' ? 'known' : result === 'fuzzy' ? 'fuzzy' : progress.familiarity,
    firstSeenAt: progress.firstSeenAt ?? answeredAt,
    lastSeenAt: result === 'skipped' ? progress.lastSeenAt : answeredAt,
    nextReviewAt,
    lastQuestionType: questionType,
    lastAnswerResult: result,
    updatedAt: answeredAt,
  } satisfies WordProgress

  return {
    ...nextProgress,
    status: getStatus(nextProgress, masteryScore, result),
  }
}

export const createInitialWordProgress = ({
  studentId,
  wordId,
  unitId,
  now,
}: {
  studentId: string
  wordId: string
  unitId: string
  now: number
}): WordProgress => ({
  id: `${studentId}:${wordId}`,
  studentId,
  wordId,
  unitId,
  status: 'new',
  familiarity: 'unknown',
  seenCount: 0,
  correctCount: 0,
  wrongCount: 0,
  fuzzyCount: 0,
  skippedCount: 0,
  masteryScore: 0,
  completedQuestionTypes: [],
  createdAt: now,
  updatedAt: now,
})

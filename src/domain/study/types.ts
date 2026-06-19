import type { AppSettings } from '../settings/types'

export type QuestionType = 'enToZh' | 'spelling'

export type AnswerResult = 'correct' | 'wrong' | 'fuzzy' | 'skipped'

export type Familiarity = 'unknown' | 'fuzzy' | 'known'

export type WordStatus = 'new' | 'learning' | 'reviewing' | 'mastered'

export type WordProgress = {
  id: string
  studentId: string
  wordId: string
  unitId: string
  status: WordStatus
  familiarity: Familiarity
  seenCount: number
  correctCount: number
  wrongCount: number
  fuzzyCount: number
  skippedCount: number
  masteryScore: number
  completedQuestionTypes: QuestionType[]
  starred?: boolean
  firstSeenAt?: number
  lastSeenAt?: number
  nextReviewAt?: number
  lastQuestionType?: QuestionType
  lastAnswerResult?: AnswerResult
  createdAt: number
  updatedAt: number
}

export type QuestionItem = {
  id: string
  wordId: string
  unitId: string
  questionType: QuestionType
  status: 'pending' | 'answered' | 'skipped'
  answerResult?: AnswerResult
  answeredAt?: number
}

export type StudySession = {
  id: string
  studentId: string
  type: 'daily' | 'dailyQuiz' | 'unitQuiz'
  status: 'active' | 'paused' | 'completed' | 'abandoned'
  unitId?: string
  sessionDate: string
  questionQueue: QuestionItem[]
  currentQuestionIndex: number
  plannedNewWordIds: string[]
  plannedReviewWordIds: string[]
  completedWordIds: string[]
  settingsSnapshot: AppSettings
  startedAt: number
  pausedAt?: number
  completedAt?: number
}

export type UnitProgress = {
  id: string
  studentId: string
  unitId: string
  status: 'locked' | 'available' | 'inProgress' | 'readyForTest' | 'passed'
  appearedWordCount: number
  totalWordCount: number
  masteryRate: number
  lastTestScore?: number
  testAttemptCount: number
  passedAt?: number
  createdAt: number
  updatedAt: number
}

export type TestResult = {
  id: string
  studentId: string
  unitId: string
  type: 'dailyQuiz' | 'unitQuiz'
  totalCount: number
  correctCount: number
  wrongCount: number
  score: number
  passed: boolean
  completedAt: number
}

import type { BookId } from '../vocabulary/types'

export type QuestionTypeSettings = {
  enToZh: boolean
  spelling: boolean
}

export type AppSettings = {
  studentId: string
  dailyNewWordLimit: number
  dailyReviewLimit: number
  dailyTimeLimitMinutes: number
  currentBookId: BookId
  currentUnitId: string
  autoAdvanceUnit: boolean
  unitMasteryThreshold: number
  unitQuizPassThreshold: number
  questionTypesEnabled: QuestionTypeSettings
  soundEnabled: boolean
  updatedAt: number
}

export const DEFAULT_STUDENT_ID = 'default-student'

export const DEFAULT_SETTINGS: AppSettings = {
  studentId: DEFAULT_STUDENT_ID,
  dailyNewWordLimit: 10,
  dailyReviewLimit: 20,
  dailyTimeLimitMinutes: 15,
  currentBookId: 'grade-7a',
  currentUnitId: 'g7a-u1',
  autoAdvanceUnit: true,
  unitMasteryThreshold: 0.8,
  unitQuizPassThreshold: 0.8,
  questionTypesEnabled: {
    enToZh: true,
    spelling: true,
  },
  soundEnabled: true,
  updatedAt: 0,
}

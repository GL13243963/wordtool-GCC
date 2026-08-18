import { z } from 'zod'
import { appSettingsSchema } from '../settings/schema'
import type { AnswerRecord, QuestionItem, StudySession, TestResult, UnitProgress, WordProgress } from './types'

export const questionTypeSchema = z.enum(['enToZh', 'spelling', 'readAloud'])
export const answerResultSchema = z.enum(['correct', 'wrong', 'fuzzy', 'skipped'])
export const pronunciationAssessmentSchema = z.object({
  engine: z.enum(['browser-speech-recognition', 'manual-recording']),
  transcript: z.string().max(500).optional(),
  matchScore: z.number().min(0).max(100).optional(),
  attemptCount: z.number().int().min(1).max(20),
})

export const wordProgressSchema = z.object({
  id: z.string().min(1).max(160),
  studentId: z.string().min(1).max(80),
  wordId: z.string().min(1).max(120),
  unitId: z.string().min(1).max(80),
  status: z.enum(['new', 'learning', 'reviewing', 'mastered']),
  familiarity: z.enum(['unknown', 'fuzzy', 'known']),
  seenCount: z.number().int().min(0).max(10_000),
  correctCount: z.number().int().min(0).max(10_000),
  wrongCount: z.number().int().min(0).max(10_000),
  fuzzyCount: z.number().int().min(0).max(10_000),
  skippedCount: z.number().int().min(0).max(10_000),
  masteryScore: z.number().min(0).max(100),
  completedQuestionTypes: z.array(questionTypeSchema).max(3),
  starred: z.boolean().optional(),
  firstSeenAt: z.number().int().min(0).optional(),
  lastSeenAt: z.number().int().min(0).optional(),
  nextReviewAt: z.number().int().min(0).optional(),
  lastQuestionType: questionTypeSchema.optional(),
  lastAnswerResult: answerResultSchema.optional(),
  createdAt: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
}) satisfies z.ZodType<WordProgress>

export const questionItemSchema = z.object({
  id: z.string().min(1).max(180),
  wordId: z.string().min(1).max(120),
  unitId: z.string().min(1).max(80),
  questionType: questionTypeSchema,
  status: z.enum(['pending', 'answered', 'skipped']),
  answerResult: answerResultSchema.optional(),
  answeredAt: z.number().int().min(0).optional(),
}) satisfies z.ZodType<QuestionItem>

export const studySessionSchema = z.object({
  id: z.string().min(1).max(160),
  studentId: z.string().min(1).max(80),
  type: z.enum(['daily', 'dailyQuiz', 'unitQuiz']),
  status: z.enum(['active', 'paused', 'completed', 'abandoned']),
  unitId: z.string().min(1).max(80).optional(),
  sessionDate: z.string().min(8).max(16),
  questionQueue: z.array(questionItemSchema).max(500),
  currentQuestionIndex: z.number().int().min(0).max(500),
  plannedNewWordIds: z.array(z.string().max(120)).max(300),
  plannedReviewWordIds: z.array(z.string().max(120)).max(300),
  completedWordIds: z.array(z.string().max(120)).max(500),
  settingsSnapshot: appSettingsSchema,
  startedAt: z.number().int().min(0),
  pausedAt: z.number().int().min(0).optional(),
  completedAt: z.number().int().min(0).optional(),
}) satisfies z.ZodType<StudySession>

export const answerRecordSchema = z.object({
  id: z.string().min(1).max(200),
  sessionId: z.string().min(1).max(160),
  studentId: z.string().min(1).max(80),
  wordId: z.string().min(1).max(120),
  unitId: z.string().min(1).max(80),
  questionType: questionTypeSchema,
  result: answerResultSchema,
  answeredAt: z.number().int().min(0),
  responseTimeMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
  masteryBefore: z.number().min(0).max(100),
  masteryAfter: z.number().min(0).max(100),
  pronunciation: pronunciationAssessmentSchema.optional(),
}) satisfies z.ZodType<AnswerRecord>

export const unitProgressSchema = z.object({
  id: z.string().min(1).max(160),
  studentId: z.string().min(1).max(80),
  unitId: z.string().min(1).max(80),
  status: z.enum(['locked', 'available', 'inProgress', 'readyForTest', 'passed']),
  appearedWordCount: z.number().int().min(0).max(10_000),
  totalWordCount: z.number().int().min(0).max(10_000),
  masteryRate: z.number().min(0).max(1),
  lastTestScore: z.number().min(0).max(1).optional(),
  testAttemptCount: z.number().int().min(0).max(10_000),
  passedAt: z.number().int().min(0).optional(),
  createdAt: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
}) satisfies z.ZodType<UnitProgress>

export const testResultSchema = z.object({
  id: z.string().min(1).max(160),
  studentId: z.string().min(1).max(80),
  unitId: z.string().min(1).max(80),
  type: z.enum(['dailyQuiz', 'unitQuiz']),
  totalCount: z.number().int().min(0).max(500),
  correctCount: z.number().int().min(0).max(500),
  wrongCount: z.number().int().min(0).max(500),
  score: z.number().min(0).max(1),
  passed: z.boolean(),
  completedAt: z.number().int().min(0),
}) satisfies z.ZodType<TestResult>

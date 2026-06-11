import { z } from 'zod'
import type { AppSettings } from './types'

export const questionTypeSettingsSchema = z.object({
  enToZh: z.boolean(),
  zhToEn: z.boolean(),
  spelling: z.boolean(),
}).refine(
  (value) => value.enToZh || value.zhToEn || value.spelling,
  '至少需要启用一种题型',
)

export const appSettingsSchema = z.object({
  studentId: z.string().min(1).max(80),
  dailyNewWordLimit: z.number().int().min(1).max(100),
  dailyReviewLimit: z.number().int().min(0).max(300),
  dailyTimeLimitMinutes: z.number().int().min(5).max(180),
  currentBookId: z.enum(['grade-6a', 'grade-6b', 'grade-7a']),
  currentUnitId: z.string().min(1).max(80),
  autoAdvanceUnit: z.boolean(),
  unitMasteryThreshold: z.number().min(0).max(1),
  unitQuizPassThreshold: z.number().min(0).max(1),
  questionTypesEnabled: questionTypeSettingsSchema,
  updatedAt: z.number().int().min(0),
}) satisfies z.ZodType<AppSettings>

export const parseAppSettings = (settings: AppSettings): AppSettings =>
  appSettingsSchema.parse(settings)

import { z } from 'zod'
import { appSettingsSchema } from '../domain/settings/schema'
import { answerRecordSchema, studySessionSchema, testResultSchema, unitProgressSchema, wordProgressSchema } from '../domain/study/schema'
import type { AppMeta } from './db'
import { db } from './db'

const appMetaSchema = z.object({
  key: z.string().min(1).max(120),
  value: z.string().max(500),
}) satisfies z.ZodType<AppMeta>

const BackupSchema = z.object({
  backupVersion: z.literal(1),
  appVersion: z.string().min(1).max(40),
  exportedAt: z.string().datetime(),
  data: z.object({
    settings: z.array(appSettingsSchema).max(5),
    wordProgress: z.array(wordProgressSchema).max(20_000),
    unitProgress: z.array(unitProgressSchema).max(2_000),
    sessions: z.array(studySessionSchema).max(5_000),
    answerRecords: z.array(answerRecordSchema).max(100_000).default([]),
    testResults: z.array(testResultSchema).max(10_000),
    appMeta: z.array(appMetaSchema).max(100),
  }),
})

export type BackupFile = z.infer<typeof BackupSchema>

export const exportBackup = async (): Promise<BackupFile> => {
  const [settings, wordProgress, unitProgress, sessions, answerRecords, testResults, appMeta] = await Promise.all([
    db.settings.toArray(),
    db.wordProgress.toArray(),
    db.unitProgress.toArray(),
    db.sessions.toArray(),
    db.answerRecords.toArray(),
    db.testResults.toArray(),
    db.appMeta.toArray(),
  ])

  return BackupSchema.parse({
    backupVersion: 1,
    appVersion: '0.5.0',
    exportedAt: new Date().toISOString(),
    data: {
      settings,
      wordProgress,
      unitProgress,
      sessions,
      answerRecords,
      testResults,
      appMeta,
    },
  })
}

export const restoreBackup = async (backup: unknown) => {
  const parsed = BackupSchema.parse(backup)

  await db.transaction(
    'rw',
    [db.settings, db.wordProgress, db.unitProgress, db.sessions, db.answerRecords, db.testResults, db.appMeta],
    async () => {
      await Promise.all([
        db.settings.clear(),
        db.wordProgress.clear(),
        db.unitProgress.clear(),
        db.sessions.clear(),
        db.answerRecords.clear(),
        db.testResults.clear(),
        db.appMeta.clear(),
      ])

      await Promise.all([
        db.settings.bulkPut(parsed.data.settings),
        db.wordProgress.bulkPut(parsed.data.wordProgress),
        db.unitProgress.bulkPut(parsed.data.unitProgress),
        db.sessions.bulkPut(parsed.data.sessions),
        db.answerRecords.bulkPut(parsed.data.answerRecords),
        db.testResults.bulkPut(parsed.data.testResults),
        db.appMeta.bulkPut(parsed.data.appMeta),
      ])
    },
  )

  return parsed
}

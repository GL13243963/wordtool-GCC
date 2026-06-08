import { describe, expect, test } from 'vitest'
import { restoreBackup } from './backupService'

describe('backupService', () => {
  test('rejects backup records with invalid settings shape', async () => {
    const invalidBackup = {
      backupVersion: 1,
      appVersion: '0.1.0',
      exportedAt: new Date(0).toISOString(),
      data: {
        settings: [{ studentId: 'default-student', dailyNewWordLimit: 'many' }],
        wordProgress: [],
        unitProgress: [],
        sessions: [],
        testResults: [],
        appMeta: [],
      },
    }

    await expect(restoreBackup(invalidBackup)).rejects.toThrow()
  })
})

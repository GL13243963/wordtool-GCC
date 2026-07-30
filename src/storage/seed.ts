import { builtinUnits, builtinWords } from '../data/vocabulary'
import { DEFAULT_SETTINGS } from '../domain/settings/types'
import { db } from './db'

const SEED_DATA_VERSION = '2026-06-08-grade-7a-upgrade'
const TEST_DATA_RESET_VERSION = '2026-07-30-production-baseline'

export const ensureSeedData = async () => {
  const resetVersion = await db.appMeta.get('testDataResetVersion')
  if (resetVersion?.value !== TEST_DATA_RESET_VERSION) {
    await db.transaction(
      'rw',
      [db.wordProgress, db.unitProgress, db.sessions, db.answerRecords, db.testResults, db.appMeta],
      async () => {
        await Promise.all([
          db.wordProgress.clear(),
          db.unitProgress.clear(),
          db.sessions.clear(),
          db.answerRecords.clear(),
          db.testResults.clear(),
        ])
        await db.appMeta.put({ key: 'testDataResetVersion', value: TEST_DATA_RESET_VERSION })
      },
    )
  }

  const seedVersion = await db.appMeta.get('seedDataVersion')
  if (seedVersion?.value === SEED_DATA_VERSION) return

  const now = Date.now()

  await db.transaction('rw', db.words, db.units, db.settings, db.appMeta, async () => {
    await db.units.bulkPut(builtinUnits)
    await db.words.bulkPut(builtinWords)

    const existingSettings = await db.settings.get(DEFAULT_SETTINGS.studentId)
    if (!existingSettings) {
      await db.settings.put({ ...DEFAULT_SETTINGS, updatedAt: now })
    } else if (existingSettings.currentBookId === 'grade-6b' && existingSettings.currentUnitId === 'g6b-u1') {
      await db.settings.put({
        ...existingSettings,
        currentBookId: DEFAULT_SETTINGS.currentBookId,
        currentUnitId: DEFAULT_SETTINGS.currentUnitId,
        updatedAt: now,
      })
    }

    await db.appMeta.put({ key: 'seedDataVersion', value: SEED_DATA_VERSION })
  })
}

import { builtinUnits, builtinWords } from '../data/vocabulary'
import { DEFAULT_SETTINGS } from '../domain/settings/types'
import { db } from './db'

const SEED_DATA_VERSION = '2026-06-06-initial-sample'

export const ensureSeedData = async () => {
  const seedVersion = await db.appMeta.get('seedDataVersion')
  if (seedVersion?.value === SEED_DATA_VERSION) return

  const now = Date.now()

  await db.transaction('rw', db.words, db.units, db.settings, db.appMeta, async () => {
    await db.units.bulkPut(builtinUnits)
    await db.words.bulkPut(builtinWords)

    const existingSettings = await db.settings.get(DEFAULT_SETTINGS.studentId)
    if (!existingSettings) {
      await db.settings.put({ ...DEFAULT_SETTINGS, updatedAt: now })
    }

    await db.appMeta.put({ key: 'seedDataVersion', value: SEED_DATA_VERSION })
  })
}

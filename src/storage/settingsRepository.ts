import { parseAppSettings } from '../domain/settings/schema'
import { DEFAULT_SETTINGS, type AppSettings } from '../domain/settings/types'
import { db } from './db'

export const getSettings = async () => {
  const settings = await db.settings.get(DEFAULT_SETTINGS.studentId)
  return settings ? parseAppSettings(settings) : { ...DEFAULT_SETTINGS, updatedAt: Date.now() }
}

export const saveSettings = async (settings: AppSettings) => {
  const nextSettings = parseAppSettings({ ...settings, updatedAt: Date.now() })
  await db.settings.put(nextSettings)
  return nextSettings
}

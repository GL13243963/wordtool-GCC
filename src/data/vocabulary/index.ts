import { grade6aVocabulary } from './grade6a'
import { grade6bVocabulary } from './grade6b'

export const builtinUnits = [
  ...grade6aVocabulary.units,
  ...grade6bVocabulary.units,
]

export const builtinWords = [
  ...grade6aVocabulary.words,
  ...grade6bVocabulary.words,
]

export const getWordsByUnitId = (unitId: string) =>
  builtinWords.filter((word) => word.unitId === unitId)

export const getUnitById = (unitId: string) =>
  builtinUnits.find((unit) => unit.id === unitId)

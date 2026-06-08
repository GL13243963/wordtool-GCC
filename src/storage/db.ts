import Dexie, { type EntityTable } from 'dexie'
import type { AppSettings } from '../domain/settings/types'
import type { QuestionItem, StudySession, TestResult, UnitProgress, WordProgress } from '../domain/study/types'
import type { Unit, Word } from '../domain/vocabulary/types'

export type AppMeta = {
  key: string
  value: string
}

export class VocabTrainerDatabase extends Dexie {
  words!: EntityTable<Word, 'id'>
  units!: EntityTable<Unit, 'id'>
  wordProgress!: EntityTable<WordProgress, 'id'>
  unitProgress!: EntityTable<UnitProgress, 'id'>
  settings!: EntityTable<AppSettings, 'studentId'>
  sessions!: EntityTable<StudySession, 'id'>
  testResults!: EntityTable<TestResult, 'id'>
  appMeta!: EntityTable<AppMeta, 'key'>

  constructor(name = 'OxfordVocabTrainer') {
    super(name)

    this.version(1).stores({
      words: 'id, bookId, unitId, text, source',
      units: 'id, bookId, order',
      wordProgress: 'id, studentId, wordId, unitId, status, nextReviewAt, updatedAt',
      unitProgress: 'id, studentId, unitId, status, updatedAt',
      settings: 'studentId, currentBookId, currentUnitId, updatedAt',
      sessions: 'id, studentId, status, sessionDate, startedAt',
      testResults: 'id, studentId, unitId, type, completedAt',
      appMeta: 'key',
    })
  }
}

export const db = new VocabTrainerDatabase()

export type { QuestionItem }

import { DEFAULT_STUDENT_ID } from '../domain/settings/types'
import { applyAnswerToProgress, createInitialWordProgress } from '../domain/study/mastery'
import type { AnswerResult, QuestionType, StudySession, WordProgress } from '../domain/study/types'
import type { Word } from '../domain/vocabulary/types'
import { db } from './db'

export const getAllWords = () => db.words.toArray()

export const getAllUnits = () => db.units.toArray()

export const getProgressForStudent = (studentId = DEFAULT_STUDENT_ID) =>
  db.wordProgress.where('studentId').equals(studentId).toArray()

export const getProgressMap = async (studentId = DEFAULT_STUDENT_ID) => {
  const progress = await getProgressForStudent(studentId)
  return new Map(progress.map((item) => [item.wordId, item]))
}

export const getOrCreateWordProgress = async (word: Word, now: number, studentId = DEFAULT_STUDENT_ID) => {
  const existing = await db.wordProgress.get(`${studentId}:${word.id}`)
  if (existing) return existing

  const progress = createInitialWordProgress({ studentId, wordId: word.id, unitId: word.unitId, now })
  await db.wordProgress.put(progress)
  return progress
}

export const submitWordAnswer = async ({
  word,
  result,
  questionType,
  answeredAt,
  studentId = DEFAULT_STUDENT_ID,
}: {
  word: Word
  result: AnswerResult
  questionType: QuestionType
  answeredAt: number
  studentId?: string
}): Promise<WordProgress> => {
  const progress = await getOrCreateWordProgress(word, answeredAt, studentId)
  const nextProgress = applyAnswerToProgress({ progress, result, questionType, answeredAt })
  await db.wordProgress.put(nextProgress)
  return nextProgress
}

export const saveSession = async (session: StudySession) => {
  await db.sessions.put(session)
  return session
}

export const getActiveSession = (studentId = DEFAULT_STUDENT_ID) =>
  db.sessions
    .where('studentId')
    .equals(studentId)
    .filter((session) => session.status === 'active' || session.status === 'paused')
    .last()

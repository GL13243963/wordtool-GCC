import { DEFAULT_STUDENT_ID } from '../domain/settings/types'
import { applyAnswerToProgress, createInitialWordProgress } from '../domain/study/mastery'
import type { AnswerRecord, AnswerResult, QuestionType, StudySession, WordProgress } from '../domain/study/types'
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

export const saveAnswerRecord = (record: AnswerRecord) => db.answerRecords.put(record)

export const getAnswerRecordsForStudent = (studentId = DEFAULT_STUDENT_ID) =>
  db.answerRecords.where('studentId').equals(studentId).sortBy('answeredAt')

export const getSessionsForStudent = (studentId = DEFAULT_STUDENT_ID) =>
  db.sessions.where('studentId').equals(studentId).sortBy('startedAt')

export const clearStudyRecords = async (studentId = DEFAULT_STUDENT_ID) => {
  await db.transaction(
    'rw',
    [db.wordProgress, db.unitProgress, db.sessions, db.answerRecords, db.testResults],
    async () => {
      await Promise.all([
        db.wordProgress.where('studentId').equals(studentId).delete(),
        db.unitProgress.where('studentId').equals(studentId).delete(),
        db.sessions.where('studentId').equals(studentId).delete(),
        db.answerRecords.where('studentId').equals(studentId).delete(),
        db.testResults.where('studentId').equals(studentId).delete(),
      ])
    },
  )
}

export const getActiveSession = (studentId = DEFAULT_STUDENT_ID) =>
  db.sessions
    .where('studentId')
    .equals(studentId)
    .filter((session) => session.status === 'active' || session.status === 'paused')
    .last()

// 错题本只收集反复出错或错误明显多于正确的单词
export const getWrongWords = async (studentId = DEFAULT_STUDENT_ID) => {
  const progress = await getProgressForStudent(studentId)
  return progress.filter((item) => {
    if (item.wrongCount < 2) return false
    return item.wrongCount >= item.correctCount || item.lastAnswerResult === 'wrong'
  })
}

// 获取学习统计数据
export const getStudyStats = async (studentId = DEFAULT_STUDENT_ID) => {
  const progress = await getProgressForStudent(studentId)
  const masteredCount = progress.filter((item) => item.status === 'mastered').length
  const totalCorrect = progress.reduce((sum, item) => sum + item.correctCount, 0)
  const totalWrong = progress.reduce((sum, item) => sum + item.wrongCount, 0)
  const totalAnswered = totalCorrect + totalWrong
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0

  const studyDays = new Set(
    progress
      .filter((item) => item.firstSeenAt)
      .map((item) => new Date(item.firstSeenAt!).toDateString()),
  ).size

  return {
    masteredCount,
    totalWords: progress.length,
    totalCorrect,
    totalWrong,
    accuracy,
    studyDays,
  }
}

// 切换单词收藏状态
export const toggleWordStar = async (wordId: string, studentId = DEFAULT_STUDENT_ID) => {
  const progress = await db.wordProgress.get(`${studentId}:${wordId}`)
  if (!progress) return false

  const nextProgress = {
    ...progress,
    starred: !progress.starred,
    updatedAt: Date.now(),
  }
  await db.wordProgress.put(nextProgress)
  return nextProgress.starred
}

// 获取收藏的单词
export const getStarredWords = async (studentId = DEFAULT_STUDENT_ID) => {
  const progress = await getProgressForStudent(studentId)
  return progress.filter((item) => item.starred)
}

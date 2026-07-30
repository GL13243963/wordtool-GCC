import { describe, expect, test } from 'vitest'
import { builtinWords } from '../../data/vocabulary'
import { DEFAULT_SETTINGS } from '../settings/types'
import { createInitialWordProgress } from './mastery'
import { createDailyTaskPlan } from './scheduler'

describe('daily task scheduler', () => {
  test('limits daily questions to 20 choices, 20 spelling questions, and 5 read-aloud questions', () => {
    const progressMap = new Map()
    const currentUnitWords = builtinWords.filter((word) => word.unitId === DEFAULT_SETTINGS.currentUnitId)

    for (const word of currentUnitWords) {
      progressMap.set(word.id, {
        ...createInitialWordProgress({ studentId: 'student', wordId: word.id, unitId: word.unitId, now: 0 }),
        seenCount: 3,
        status: 'learning',
      })
    }

    const plan = createDailyTaskPlan({
      words: builtinWords,
      progressByWordId: progressMap,
      settings: DEFAULT_SETTINGS,
      now: 1_000,
    })

    expect(plan.questionQueue.filter((item) => item.questionType === 'enToZh')).toHaveLength(Math.min(20, currentUnitWords.length))
    expect(plan.questionQueue.filter((item) => item.questionType === 'spelling')).toHaveLength(Math.min(20, currentUnitWords.length))
    expect(plan.questionQueue.filter((item) => item.questionType === 'readAloud')).toHaveLength(Math.min(5, currentUnitWords.length))
    expect(plan.questionQueue.length).toBeLessThanOrEqual(45)
  })

  test('prioritizes words with wrong answers first', () => {
    const currentUnitWords = builtinWords.filter((word) => word.unitId === DEFAULT_SETTINGS.currentUnitId)
    const wrongWord = currentUnitWords[0]
    const normalWord = currentUnitWords[1]

    const progressMap = new Map([
      [
        wrongWord.id,
        {
          ...createInitialWordProgress({ studentId: 'student', wordId: wrongWord.id, unitId: wrongWord.unitId, now: 0 }),
          wrongCount: 5,
          seenCount: 10,
          status: 'learning' as const,
        },
      ],
      [
        normalWord.id,
        {
          ...createInitialWordProgress({ studentId: 'student', wordId: normalWord.id, unitId: normalWord.unitId, now: 0 }),
          wrongCount: 0,
          seenCount: 10,
          status: 'learning' as const,
        },
      ],
    ])

    const plan = createDailyTaskPlan({
      words: builtinWords,
      progressByWordId: progressMap,
      settings: DEFAULT_SETTINGS,
      now: 1_000,
    })

    // 错词应该排在前面
    const wrongIndex = plan.questionQueue.findIndex((item) => item.wordId === wrongWord.id)
    const normalIndex = plan.questionQueue.findIndex((item) => item.wordId === normalWord.id)
    expect(wrongIndex).toBeLessThan(normalIndex)
  })

  test('respects enabled question type settings', () => {
    const progressMap = new Map()
    const currentUnitWords = builtinWords.filter((word) => word.unitId === DEFAULT_SETTINGS.currentUnitId)

    for (const word of currentUnitWords.slice(0, 3)) {
      progressMap.set(word.id, {
        ...createInitialWordProgress({ studentId: 'student', wordId: word.id, unitId: word.unitId, now: 0 }),
        seenCount: 5,
        status: 'learning',
      })
    }

    const plan = createDailyTaskPlan({
      words: builtinWords,
      progressByWordId: progressMap,
      settings: {
        ...DEFAULT_SETTINGS,
        questionTypesEnabled: {
          enToZh: false,
          spelling: true,
          readAloud: false,
        },
      },
      now: 1_000,
    })

    expect(plan.questionQueue.length).toBeGreaterThan(0)
    expect(plan.questionQueue.some((item) => item.questionType === 'enToZh')).toBe(false)
    expect(plan.questionQueue.some((item) => item.questionType === 'spelling')).toBe(true)
  })

  test('respects daily new word and review limits from settings', () => {
    const currentUnitWords = builtinWords.filter((word) => word.unitId === DEFAULT_SETTINGS.currentUnitId)
    const reviewWords = currentUnitWords.slice(6, 14)
    const progressMap = new Map()

    for (const word of reviewWords) {
      progressMap.set(word.id, {
        ...createInitialWordProgress({ studentId: 'student', wordId: word.id, unitId: word.unitId, now: 0 }),
        seenCount: 3,
        status: 'learning',
      })
    }

    const plan = createDailyTaskPlan({
      words: currentUnitWords,
      progressByWordId: progressMap,
      settings: {
        ...DEFAULT_SETTINGS,
        dailyNewWordLimit: 2,
        dailyReviewLimit: 3,
        questionTypesEnabled: {
          enToZh: true,
          spelling: false,
          readAloud: false,
        },
      },
      now: 1_000,
    })

    expect(plan.newWords).toHaveLength(2)
    expect(plan.reviewWords).toHaveLength(3)
    expect(plan.questionQueue).toHaveLength(5)
  })

  test('does not schedule review words when daily review limit is zero', () => {
    const currentUnitWords = builtinWords.filter((word) => word.unitId === DEFAULT_SETTINGS.currentUnitId)
    const progressMap = new Map()

    for (const word of currentUnitWords) {
      progressMap.set(word.id, {
        ...createInitialWordProgress({ studentId: 'student', wordId: word.id, unitId: word.unitId, now: 0 }),
        seenCount: 3,
        status: 'learning',
      })
    }

    const plan = createDailyTaskPlan({
      words: currentUnitWords,
      progressByWordId: progressMap,
      settings: {
        ...DEFAULT_SETTINGS,
        dailyReviewLimit: 0,
      },
      now: 1_000,
    })

    expect(plan.reviewWords).toHaveLength(0)
    expect(plan.questionQueue).toHaveLength(0)
  })

  test('schedules spelling and read-aloud stages for new words in the same lesson', () => {
    const progressMap = new Map()

    const plan = createDailyTaskPlan({
      words: builtinWords,
      progressByWordId: progressMap,
      settings: DEFAULT_SETTINGS,
      now: 1_000,
    })

    const selectedWordIds = plan.newWords.map((word) => word.id)
    const spellingQuestions = plan.questionQueue.filter((item) => item.questionType === 'spelling')
    const readAloudQuestions = plan.questionQueue.filter((item) => item.questionType === 'readAloud')
    expect(spellingQuestions.map((item) => item.wordId)).toEqual(selectedWordIds)
    expect(readAloudQuestions.map((item) => item.wordId)).toEqual(selectedWordIds.slice(0, 5))
  })
})

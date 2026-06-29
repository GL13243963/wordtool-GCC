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
        },
      },
      now: 1_000,
    })

    expect(plan.questionQueue.length).toBeGreaterThan(0)
    expect(plan.questionQueue.some((item) => item.questionType === 'enToZh')).toBe(false)
    expect(plan.questionQueue.some((item) => item.questionType === 'spelling')).toBe(true)
  })

  test('generates spelling questions for seen words', () => {
    // 对已见过的单词生成拼写题
    const progressMap = new Map()
    const currentUnitWords = builtinWords.filter((word) => word.unitId === DEFAULT_SETTINGS.currentUnitId)

    for (const word of currentUnitWords.slice(0, 3)) {
      progressMap.set(word.id, {
        ...createInitialWordProgress({ studentId: 'student', wordId: word.id, unitId: word.unitId, now: 0 }),
        seenCount: 5, // seenCount >= 1 应该生成拼写题
        correctCount: 5,
        masteryScore: 50,
        status: 'learning',
      })
    }

    const plan = createDailyTaskPlan({
      words: builtinWords,
      progressByWordId: progressMap,
      settings: DEFAULT_SETTINGS,
      now: 1_000,
    })

    // 已见过的单词应该有拼写题
    const spellingQuestions = plan.questionQueue.filter((item) => item.questionType === 'spelling')
    expect(spellingQuestions.length).toBeGreaterThan(0)
  })
})

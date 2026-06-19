import { describe, expect, test } from 'vitest'
import { builtinWords } from '../../data/vocabulary'
import { DEFAULT_SETTINGS } from '../settings/types'
import { createInitialWordProgress } from './mastery'
import { createDailyTaskPlan } from './scheduler'

describe('daily task scheduler', () => {
  test('includes all words from current unit (test mode)', () => {
    const plan = createDailyTaskPlan({
      words: builtinWords,
      progressByWordId: new Map(),
      settings: { ...DEFAULT_SETTINGS, dailyNewWordLimit: 2, dailyReviewLimit: 20 },
      now: 1_000,
    })

    const currentUnitWords = builtinWords.filter((word) => word.unitId === DEFAULT_SETTINGS.currentUnitId)
    // 测试模式下包含当前单元所有单词
    expect(plan.newWords.length + plan.reviewWords.length).toBeGreaterThanOrEqual(currentUnitWords.length)
    expect(plan.questionQueue.length).toBeGreaterThan(0)
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

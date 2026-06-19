import { describe, expect, test } from 'vitest'
import { builtinWords } from '../../data/vocabulary'
import { DEFAULT_SETTINGS } from '../settings/types'
import { createInitialWordProgress } from './mastery'
import { createDailyTaskPlan } from './scheduler'

describe('daily task scheduler', () => {
  test('selects current unit new words up to the configured limit', () => {
    const plan = createDailyTaskPlan({
      words: builtinWords,
      progressByWordId: new Map(),
      settings: { ...DEFAULT_SETTINGS, dailyNewWordLimit: 2, dailyReviewLimit: 20 },
      now: 1_000,
    })

    expect(plan.newWords).toHaveLength(2)
    expect(plan.newWords.every((word) => word.unitId === DEFAULT_SETTINGS.currentUnitId)).toBe(true)
    expect(plan.questionQueue).toHaveLength(2)
    expect(plan.questionQueue.every((item) => item.questionType === 'enToZh')).toBe(true)
  })

  test('prioritizes due review words with wrong answers', () => {
    const dueWord = builtinWords.find((word) => word.id === 'g6a-u1-family')!
    const progress = {
      ...createInitialWordProgress({ studentId: 'student', wordId: dueWord.id, unitId: dueWord.unitId, now: 0 }),
      wrongCount: 2,
      nextReviewAt: 500,
      status: 'learning' as const,
    }

    const plan = createDailyTaskPlan({
      words: builtinWords,
      progressByWordId: new Map([[dueWord.id, progress]]),
      settings: { ...DEFAULT_SETTINGS, dailyNewWordLimit: 1, dailyReviewLimit: 1 },
      now: 1_000,
    })

    expect(plan.reviewWords[0].id).toBe(dueWord.id)
    expect(plan.questionQueue.some((item) => item.wordId === dueWord.id)).toBe(true)
  })

  test('uses only enabled question types', () => {
    // 创建有进度的单词并设置复习时间，触发拼写题
    const progressMap = new Map()
    for (const word of builtinWords.slice(0, 3)) {
      progressMap.set(word.id, {
        ...createInitialWordProgress({ studentId: 'student', wordId: word.id, unitId: word.unitId, now: 0 }),
        seenCount: 5,
        correctCount: 5,
        masteryScore: 50,
        nextReviewAt: 500, // 设置为已到复习时间
        status: 'reviewing',
      })
    }

    const plan = createDailyTaskPlan({
      words: builtinWords,
      progressByWordId: progressMap,
      settings: {
        ...DEFAULT_SETTINGS,
        dailyNewWordLimit: 0,
        dailyReviewLimit: 3,
        questionTypesEnabled: {
          enToZh: false,
          spelling: true,
        },
      },
      now: 1_000,
    })

    expect(plan.questionQueue).not.toHaveLength(0)
    expect(plan.questionQueue.every((item) => item.questionType === 'spelling')).toBe(true)
  })
})

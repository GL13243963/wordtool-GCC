import { describe, expect, test } from 'vitest'
import type { WordProgress } from './types'
import { applyAnswerToProgress, createInitialWordProgress, getReviewDelayMs } from './mastery'

describe('mastery algorithm', () => {
  test('raises mastery and schedules a later review after a correct answer', () => {
    const progress = createInitialWordProgress({
      studentId: 'student',
      wordId: 'word',
      unitId: 'unit',
      now: 0,
    })

    const next = applyAnswerToProgress({
      progress,
      result: 'correct',
      questionType: 'enToZh',
      answeredAt: 1_000,
    })

    expect(next.masteryScore).toBe(10)
    expect(next.correctCount).toBe(1)
    expect(next.nextReviewAt).toBe(1_000 + getReviewDelayMs(10))
    expect(next.status).toBe('learning')
  })

  test('lowers mastery and records wrong answers for spelling mistakes', () => {
    const progress = {
      ...createInitialWordProgress({ studentId: 'student', wordId: 'word', unitId: 'unit', now: 0 }),
      masteryScore: 50,
    }

    const next = applyAnswerToProgress({
      progress,
      result: 'wrong',
      questionType: 'spelling',
      answeredAt: 2_000,
    })

    expect(next.masteryScore).toBe(30)
    expect(next.wrongCount).toBe(1)
    expect(next.status).toBe('learning')
  })

  test('records read-aloud practice with its own score delta', () => {
    const progress = createInitialWordProgress({ studentId: 'student', wordId: 'word', unitId: 'unit', now: 0 })

    const next = applyAnswerToProgress({
      progress,
      result: 'correct',
      questionType: 'readAloud',
      answeredAt: 2_500,
    })

    expect(next.masteryScore).toBe(15)
    expect(next.completedQuestionTypes).toContain('readAloud')
    expect(next.correctCount).toBe(1)
  })

  test('marks a word as mastered only after enough varied successful practice', () => {
    const progress: WordProgress = {
      ...createInitialWordProgress({ studentId: 'student', wordId: 'word', unitId: 'unit', now: 0 }),
      masteryScore: 75,
      seenCount: 3,
      completedQuestionTypes: ['enToZh', 'spelling'],
    }

    const next = applyAnswerToProgress({
      progress,
      result: 'correct',
      questionType: 'spelling',
      answeredAt: 3_000,
    })

    expect(next.masteryScore).toBe(95)
    expect(next.status).toBe('mastered')
  })
})

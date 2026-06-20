import { describe, expect, test } from 'vitest'
import type { Word } from '../vocabulary/types'
import { createInitialWordProgress } from './mastery'
import { getUnitStats } from './progressStats'

const createWord = (id: string): Word => ({
  id,
  bookId: 'grade-7a',
  grade: '七年级',
  semester: '上册',
  unitId: 'unit-1',
  unitTitle: 'Unit 1',
  text: id,
  meaningZh: [id],
  source: 'builtin',
})

describe('progressStats', () => {
  test('averages mastery score across all unit words including unseen words', () => {
    const words = [createWord('alpha'), createWord('beta'), createWord('gamma')]
    const progressMap = new Map([
      [
        'alpha',
        {
          ...createInitialWordProgress({ studentId: 'student', wordId: 'alpha', unitId: 'unit-1', now: 0 }),
          masteryScore: 60,
          seenCount: 2,
          status: 'reviewing' as const,
        },
      ],
      [
        'beta',
        {
          ...createInitialWordProgress({ studentId: 'student', wordId: 'beta', unitId: 'unit-1', now: 0 }),
          masteryScore: 30,
          seenCount: 1,
          status: 'learning' as const,
        },
      ],
    ])

    expect(getUnitStats(words, progressMap).masteryRate).toBe(0.3)
  })

  test('counts learned and mastered words separately', () => {
    const words = [createWord('alpha'), createWord('beta')]
    const progressMap = new Map([
      [
        'alpha',
        {
          ...createInitialWordProgress({ studentId: 'student', wordId: 'alpha', unitId: 'unit-1', now: 0 }),
          seenCount: 3,
          status: 'mastered' as const,
        },
      ],
      [
        'beta',
        {
          ...createInitialWordProgress({ studentId: 'student', wordId: 'beta', unitId: 'unit-1', now: 0 }),
          seenCount: 0,
          status: 'learning' as const,
        },
      ],
    ])

    expect(getUnitStats(words, progressMap)).toMatchObject({
      learnedCount: 1,
      masteredCount: 1,
    })
  })

  test('returns zero values for empty units', () => {
    expect(getUnitStats([], new Map())).toEqual({ learnedCount: 0, masteredCount: 0, masteryRate: 0 })
  })
})

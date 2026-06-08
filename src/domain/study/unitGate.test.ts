import { describe, expect, test } from 'vitest'
import { builtinWords } from '../../data/vocabulary'
import { createInitialWordProgress } from './mastery'
import { calculateUnitMasteryRate, canTakeUnitQuiz, getAppearedWordCount } from './unitGate'

describe('unit gate', () => {
  test('calculates appeared words and mastery rate', () => {
    const unitWords = builtinWords.filter((word) => word.unitId === 'g6b-u1')
    const progressMap = new Map(
      unitWords.map((word, index) => [
        word.id,
        {
          ...createInitialWordProgress({ studentId: 'student', wordId: word.id, unitId: word.unitId, now: 0 }),
          seenCount: 1,
          status: index === 0 ? 'mastered' as const : 'learning' as const,
        },
      ]),
    )

    expect(getAppearedWordCount({ unitWords, progressByWordId: progressMap })).toBe(unitWords.length)
    expect(calculateUnitMasteryRate({ unitWords, progressByWordId: progressMap })).toBe(1 / unitWords.length)
  })

  test('allows unit quiz only after all words appeared and mastery reaches threshold', () => {
    const unitWords = builtinWords.filter((word) => word.unitId === 'g6b-u1')
    const progressMap = new Map(
      unitWords.map((word) => [
        word.id,
        {
          ...createInitialWordProgress({ studentId: 'student', wordId: word.id, unitId: word.unitId, now: 0 }),
          seenCount: 3,
          status: 'mastered' as const,
        },
      ]),
    )

    expect(canTakeUnitQuiz({ unitWords, progressByWordId: progressMap, masteryThreshold: 0.8 })).toBe(true)
  })
})

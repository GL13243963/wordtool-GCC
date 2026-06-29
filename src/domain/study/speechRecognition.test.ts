import { describe, expect, test } from 'vitest'
import { scoreReadAloud } from './speechRecognition'

describe('speechRecognition', () => {
  test('scores exact and case-insensitive transcripts as correct', () => {
    expect(scoreReadAloud('Family', 'family')).toBe(true)
    expect(scoreReadAloud('family', 'Family')).toBe(true)
  })

  test('scores transcripts containing the target word as correct', () => {
    expect(scoreReadAloud('family', 'the word family')).toBe(true)
  })

  test('rejects unrelated transcripts', () => {
    expect(scoreReadAloud('family', 'finally')).toBe(false)
  })
})

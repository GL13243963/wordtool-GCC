import { describe, expect, test } from 'vitest'
import { getReadAloudMatchScore, scoreReadAloud } from './speechRecognition'

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

  test('reports a transparent transcript match score', () => {
    expect(getReadAloudMatchScore('Family', 'family!')).toBe(100)
    expect(getReadAloudMatchScore('family', 'my family')).toBe(85)
    expect(getReadAloudMatchScore('family', 'finally')).toBe(0)
  })
})

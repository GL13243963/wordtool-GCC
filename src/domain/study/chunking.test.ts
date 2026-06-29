import { describe, expect, test } from 'vitest'
import { createChunkOptions, normalizeBuiltAnswer, splitWordIntoChunks } from './chunking'

describe('chunking', () => {
  test('keeps common phonics patterns together', () => {
    expect(splitWordIntoChunks('teacher')).toEqual(expect.arrayContaining(['ea', 'ch', 'er']))
    expect(splitWordIntoChunks('shopping')).toContain('sh')
    expect(splitWordIntoChunks('reading')).toContain('ing')
  })

  test('keeps spaces and punctuation as chunks', () => {
    expect(splitWordIntoChunks("Take somebody's place").join('')).toBe("take somebody's place")
  })

  test('creates deterministic chunk options that include all answer chunks', () => {
    const answerChunks = splitWordIntoChunks('family')
    const options = createChunkOptions('family', 'family-id')

    expect(options).toEqual(expect.arrayContaining(answerChunks))
    expect(createChunkOptions('family', 'family-id')).toEqual(options)
  })

  test('normalizes built answer from selected chunks', () => {
    expect(normalizeBuiltAnswer(['fa', 'mi', 'ly'])).toBe('family')
  })
})

import { describe, expect, test } from 'vitest'
import { builtinWords } from '../../data/vocabulary'
import type { Word } from '../vocabulary/types'
import { createQuestion, evaluateAnswer } from './questionFactory'

const createSyntheticWord = (id: string, text: string): Word => ({
  id,
  bookId: 'grade-6a',
  grade: '六年级',
  semester: '上册',
  unitId: 'synthetic-unit',
  unitTitle: 'Synthetic Unit',
  text,
  meaningZh: [`${text} 的中文`],
  source: 'builtin',
})

describe('questionFactory', () => {
  test('creates English-to-Chinese choice questions', () => {
    const word = builtinWords.find((item) => item.text === 'different')!
    const question = createQuestion({ word, allWords: builtinWords, questionType: 'enToZh' })

    expect(question.type).toBe('choice')
    if (question.type !== 'choice') throw new Error('Expected a choice question')
    expect(question.prompt).toBe('different')
    expect(question.answer).toBe('不同的')
    expect(question.options).toContain('不同的')
  })

  test('creates spelling questions and trims case-insensitive answers', () => {
    const word = builtinWords.find((item) => item.text === 'family')!
    const question = createQuestion({ word, allWords: builtinWords, questionType: 'spelling' })

    expect(question.type).toBe('spelling')
    expect(question.answer).toBe('family')
    expect(evaluateAnswer(question.answer, ' Family ')).toBe(true)
  })

  test('creates chunk-button spelling questions', () => {
    const word = createSyntheticWord('chunk-family', 'Family')
    const question = createQuestion({ word, allWords: [word], questionType: 'spelling' })

    expect(question.type).toBe('spelling')
    if (question.type !== 'spelling') throw new Error('Expected a spelling question')
    expect(question.answer).toBe('Family')
    expect(question.answerChunks.join('')).toBe('family')
    expect(question.chunkOptions).toEqual(expect.arrayContaining(question.answerChunks))
    expect(evaluateAnswer(question.answer, 'family')).toBe(true)
  })

  test('keeps spaces and punctuation in spelling chunks', () => {
    const word = createSyntheticWord('phrase-even', "Take somebody's place")
    const question = createQuestion({ word, allWords: [word], questionType: 'spelling' })

    expect(question.type).toBe('spelling')
    if (question.type !== 'spelling') throw new Error('Expected a spelling question')
    expect(question.answerChunks.join('')).toBe("take somebody's place")
    expect(question.answerChunks).toContain(' ')
    expect(question.answerChunks).toContain("'")
  })

  test('creates read-aloud questions', () => {
    const word = createSyntheticWord('read-family', 'family')
    const question = createQuestion({ word, allWords: [word], questionType: 'readAloud' })

    expect(question.type).toBe('readAloud')
    expect(question.prompt).toBe('family 的中文')
    expect(question.answer).toBe('family')
  })
})

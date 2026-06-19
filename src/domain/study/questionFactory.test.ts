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

  test('uses full spelling masks for 50% of spelling questions', () => {
    const words = Array.from({ length: 10 }, (_, index) => createSyntheticWord(`word-${index}`, `word${String.fromCharCode(97 + index)}`))
    const spellingQuestions = words.map((word) => createQuestion({ word, allWords: words, questionType: 'spelling' }))
    const fullSpellingCount = spellingQuestions.filter(
      (question) => question.type === 'spelling' && question.maskedWord === '_'.repeat(question.answer.length),
    ).length

    expect(fullSpellingCount).toBe(5)
  })

  test('displays spelling masks in lowercase while keeping answers case-insensitive', () => {
    const word = createSyntheticWord('odd-id', 'Family')
    const question = createQuestion({ word, allWords: [word], questionType: 'spelling' })

    expect(question.type).toBe('spelling')
    if (question.type !== 'spelling') throw new Error('Expected a spelling question')
    expect(question.maskedWord).toBe(question.maskedWord.toLocaleLowerCase())
    expect(question.answer).toBe('Family')
    expect(evaluateAnswer(question.answer, 'family')).toBe(true)
  })

  test('keeps spaces and punctuation visible in phrase spelling masks', () => {
    const word = createSyntheticWord('phrase-even', "Take somebody's place")
    const question = createQuestion({ word, allWords: [word], questionType: 'spelling' })

    expect(question.type).toBe('spelling')
    if (question.type !== 'spelling') throw new Error('Expected a spelling question')
    expect(question.maskedWord).toContain(' ')
    expect(question.maskedWord).toContain("'")
    expect(question.maskedWord.replace(/_/g, '')).toBe(" ' ")
  })

  test('creates partial masks for 17-letter words without hanging', () => {
    const word = createSyntheticWord('partial-seventeen', 'abcdefghijklmnopq')
    const question = createQuestion({ word, allWords: [word], questionType: 'spelling' })

    expect(question.type).toBe('spelling')
    if (question.type !== 'spelling') throw new Error('Expected a spelling question')
    expect(question.maskedWord).toContain('_')
    expect(question.maskedWord).not.toBe('_'.repeat(word.text.length))
  })
})

import { describe, expect, test } from 'vitest'
import { builtinWords } from '../../data/vocabulary'
import { createQuestion, evaluateAnswer } from './questionFactory'

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
})

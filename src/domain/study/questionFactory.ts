import type { Word } from '../vocabulary/types'
import type { QuestionType } from './types'

export type ChoiceQuestion = {
  type: 'choice'
  questionType: 'enToZh' | 'zhToEn'
  word: Word
  prompt: string
  options: string[]
  answer: string
}

export type SpellingQuestion = {
  type: 'spelling'
  questionType: 'spelling'
  word: Word
  prompt: string
  answer: string
}

export type StudyQuestion = ChoiceQuestion | SpellingQuestion

const unique = <T,>(items: T[]) => Array.from(new Set(items))

const getMeaning = (word: Word) => word.meaningZh[0] ?? ''

const getStableOffset = (seed: string, length: number) => {
  if (length <= 1) return 0

  const rawOffset = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0) % length
  return rawOffset === 0 ? 1 : rawOffset
}

const rotateOptions = (options: string[], seed: string) => {
  const offset = getStableOffset(seed, options.length)
  return [...options.slice(offset), ...options.slice(0, offset)]
}

const getDistractorPool = (word: Word, allWords: Word[]) => {
  const otherWords = allWords.filter((candidate) => candidate.id !== word.id)
  const sameUnitWords = otherWords.filter((candidate) => candidate.unitId === word.unitId)
  const sameBookWords = otherWords.filter((candidate) => candidate.bookId === word.bookId)

  return unique([...sameUnitWords, ...sameBookWords, ...otherWords])
}

export const createQuestion = ({
  word,
  allWords,
  questionType,
}: {
  word: Word
  allWords: Word[]
  questionType: QuestionType
}): StudyQuestion => {
  if (questionType === 'spelling') {
    return {
      type: 'spelling',
      questionType,
      word,
      prompt: getMeaning(word),
      answer: word.text,
    }
  }

  const isEnglishToChinese = questionType === 'enToZh'
  const answer = isEnglishToChinese ? getMeaning(word) : word.text
  const distractors = getDistractorPool(word, allWords)
    .map((candidate) => (isEnglishToChinese ? getMeaning(candidate) : candidate.text))
    .filter(Boolean)

  return {
    type: 'choice',
    questionType,
    word,
    prompt: isEnglishToChinese ? word.text : getMeaning(word),
    options: rotateOptions(unique([answer, ...distractors]).slice(0, 4), `${word.id}:${questionType}`),
    answer,
  }
}

export const normalizeAnswer = (answer: string) => answer.trim().toLocaleLowerCase()

export const evaluateAnswer = (expected: string, actual: string) =>
  normalizeAnswer(expected) === normalizeAnswer(actual)

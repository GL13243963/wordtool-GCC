import type { Word } from '../vocabulary/types'
import type { QuestionType } from './types'

export type ChoiceQuestion = {
  type: 'choice'
  questionType: 'enToZh'
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
  maskedWord: string // 带空格的单词，如 "s_ud_"
}

export type StudyQuestion = ChoiceQuestion | SpellingQuestion

const unique = <T,>(items: T[]) => Array.from(new Set(items))

const getMeaning = (word: Word) => word.meaningZh[0] ?? ''

const getSeedValue = (seed: string): number => Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0)

const shouldUseFullSpelling = (seed: string): boolean => getSeedValue(seed) % 2 === 0

const isEnglishLetter = (char: string): boolean => /^[a-z]$/i.test(char)

const createFullSpellingMask = (word: string): string =>
  word
    .split('')
    .map((char) => (isEnglishLetter(char) ? '_' : char))
    .join('')

// 生成带空格的单词，随机隐藏 30% 的字母（至少隐藏 1 个，最多隐藏一半）
const generateMaskedWord = (word: string, seed: string): string => {
  const letterIndices = word
    .split('')
    .map((char, index) => (isEnglishLetter(char) ? index : -1))
    .filter((index) => index >= 0)

  if (letterIndices.length <= 2) return word // 太短的单词不隐藏

  // 基于 seed 生成稳定的随机数
  const seedValue = getSeedValue(seed)

  const hideCount = Math.max(1, Math.min(Math.floor(letterIndices.length * 0.3), Math.floor(letterIndices.length / 2)))

  // 生成要隐藏的索引：按稳定权重排序，避免固定步长在特定长度下死循环
  const indicesToHide = [...letterIndices]
    .sort((left, right) => ((left + seedValue) * 31) % word.length - (((right + seedValue) * 31) % word.length))
    .slice(0, hideCount)

  // 替换为下划线
  return word
    .split('')
    .map((char, index) => (indicesToHide.includes(index) ? '_' : char))
    .join('')
}

const createSpellingMask = (word: string, seed: string): string => {
  const spellingWord = word.toLocaleLowerCase()
  return shouldUseFullSpelling(seed) ? createFullSpellingMask(spellingWord) : generateMaskedWord(spellingWord, seed)
}

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
      maskedWord: createSpellingMask(word.text, word.id),
    }
  }

  // enToZh - 英译中选择题
  const answer = getMeaning(word)
  const distractors = getDistractorPool(word, allWords)
    .map((candidate) => getMeaning(candidate))
    .filter(Boolean)

  return {
    type: 'choice',
    questionType,
    word,
    prompt: word.text,
    options: rotateOptions(unique([answer, ...distractors]).slice(0, 4), `${word.id}:${questionType}`),
    answer,
  }
}

export const normalizeAnswer = (answer: string) => answer.trim().toLocaleLowerCase()

export const evaluateAnswer = (expected: string, actual: string) =>
  normalizeAnswer(expected) === normalizeAnswer(actual)

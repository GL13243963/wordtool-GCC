const COMMON_PATTERNS = [
  'tion', 'sion', 'ough', 'augh', 'eigh', 'igh', 'ing', 'tch', 'dge',
  'ch', 'sh', 'th', 'ph', 'wh', 'ck', 'ng', 'qu',
  'ai', 'ay', 'ee', 'ea', 'oa', 'oo', 'ou', 'ow', 'oi', 'oy',
  'ar', 'er', 'ir', 'or', 'ur',
  'ed', 'ly', 'ful', 'less', 'ness', 'ment', 'est',
]

const DEFAULT_DISTRACTOR_CHUNKS = ['th', 'sh', 'ch', 'er', 'or', 'ar', 'oo', 'ea', 'ai', 'ay', 'ing', 'ly']

const isEnglishLetter = (char: string): boolean => /^[a-z]$/i.test(char)

const getSeedValue = (seed: string): number => Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0)

const rotateItems = <T,>(items: T[], seed: string): T[] => {
  if (items.length <= 1) return items

  const offset = getSeedValue(seed) % items.length
  return [...items.slice(offset), ...items.slice(0, offset)]
}

const splitLongChunk = (chunk: string): string[] => {
  if (chunk.length <= 4) return [chunk]

  const splitAt = Math.ceil(chunk.length / 2)
  return [chunk.slice(0, splitAt), chunk.slice(splitAt)]
}

const splitLetterRun = (run: string): string[] => {
  const chunks: string[] = []
  let index = 0

  while (index < run.length) {
    const remaining = run.slice(index)
    const matchedPattern = COMMON_PATTERNS.find((pattern) => remaining.startsWith(pattern))

    if (matchedPattern) {
      chunks.push(matchedPattern)
      index += matchedPattern.length
      continue
    }

    const nextPatternIndex = COMMON_PATTERNS
      .map((pattern) => remaining.slice(1).indexOf(pattern))
      .filter((patternIndex) => patternIndex >= 0)
      .map((patternIndex) => patternIndex + 1)
      .sort((left, right) => left - right)[0]

    const nextIndex = nextPatternIndex ?? Math.min(remaining.length, run.length <= 4 ? 1 : 2)
    chunks.push(...splitLongChunk(remaining.slice(0, nextIndex)))
    index += nextIndex
  }

  return chunks.filter(Boolean)
}

export const splitWordIntoChunks = (word: string): string[] => {
  const lowerWord = word.toLocaleLowerCase()
  const chunks: string[] = []
  let buffer = ''

  lowerWord.split('').forEach((char) => {
    if (isEnglishLetter(char)) {
      buffer += char
      return
    }

    if (buffer) {
      chunks.push(...splitLetterRun(buffer))
      buffer = ''
    }
    chunks.push(char)
  })

  if (buffer) {
    chunks.push(...splitLetterRun(buffer))
  }

  return chunks
}

export const normalizeBuiltAnswer = (chunks: string[]): string => chunks.join('')

// 拼词比较时忽略空格/标点等非字母分隔符，只比较字母序列
export const normalizeChunkComparison = (value: string): string =>
  value.toLocaleLowerCase().replace(/[^a-z]/g, '')

export const createChunkOptions = (answer: string, seed: string): string[] => {
  const correctChunks = splitWordIntoChunks(answer)
  const selectableCorrectChunks = correctChunks.filter((chunk) => Array.from(chunk).some(isEnglishLetter))
  const optionTargetCount = Math.min(10, Math.max(selectableCorrectChunks.length + 2, 6))
  const distractors = DEFAULT_DISTRACTOR_CHUNKS.filter((chunk) => !selectableCorrectChunks.includes(chunk))
  const options = [...selectableCorrectChunks]

  rotateItems(distractors, seed).some((chunk) => {
    if (options.length >= optionTargetCount) return true
    options.push(chunk)
    return false
  })

  return rotateItems(options, `${seed}:options`)
}

export type BookId = 'grade-6a' | 'grade-6b'

export type Semester = '上册' | '下册'

export type WordSource = 'builtin' | 'imported'

export type Unit = {
  id: string
  bookId: BookId
  grade: string
  semester: Semester
  order: number
  title: string
}

export type Word = {
  id: string
  bookId: BookId
  grade: string
  semester: Semester
  unitId: string
  unitTitle: string
  text: string
  meaningZh: string[]
  meaningEn?: string[]
  phonetic?: string
  partOfSpeech?: string
  example?: string
  exampleZh?: string
  tags?: string[]
  source: WordSource
}

export type BuiltinVocabulary = {
  units: Unit[]
  words: Word[]
}

import { Packer } from 'docx'
import { describe, expect, test } from 'vitest'
import { createInitialWordProgress } from '../study/mastery'
import type { Word } from '../vocabulary/types'
import { createWrongWordsDocument } from './wrongWordsDocx'

const sampleWord: Word = {
  id: 'sample-word',
  bookId: 'grade-7a',
  grade: '七年级',
  semester: '上册',
  unitId: 'g7a-u1',
  unitTitle: 'Friendship',
  text: 'friendship',
  meaningZh: ['友谊'],
  phonetic: '/ˈfrendʃɪp/',
  partOfSpeech: 'n.',
  example: 'Friendship makes school life better.',
  exampleZh: '友谊让学校生活更美好。',
  source: 'builtin',
}

describe('wrongWordsDocx', () => {
  test('creates a non-empty Word package for printable cards', async () => {
    const progress = {
      ...createInitialWordProgress({
        studentId: 'default-student',
        wordId: sampleWord.id,
        unitId: sampleWord.unitId,
        now: 1,
      }),
      wrongCount: 3,
      correctCount: 1,
    }
    const buffer = await Packer.toBuffer(createWrongWordsDocument([{ word: sampleWord, progress }]))

    expect(buffer.byteLength).toBeGreaterThan(5_000)
    expect(buffer[0]).toBe(0x50)
    expect(buffer[1]).toBe(0x4b)
  })
})

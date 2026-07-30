import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { builtinWords } from '../../data/vocabulary'
import type { Word } from '../../domain/vocabulary/types'
import { QuestionPanel } from './QuestionPanel'

const createWord = (id: string, text: string): Word => ({
  id,
  bookId: 'grade-7a',
  grade: '七年级',
  semester: '上册',
  unitId: 'unit-1',
  unitTitle: 'Unit 1',
  text,
  meaningZh: [text],
  source: 'builtin',
})

describe('QuestionPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('auto-advances after correct choice feedback', async () => {
    const onAnswer = vi.fn()
    const word = builtinWords.find((item) => item.text === 'guitar')!

    render(
      <QuestionPanel
        allWords={builtinWords}
        onAnswer={onAnswer}
        questionType="enToZh"
        soundEnabled={false}
        word={word}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '吉他' }))

    expect(screen.getByText('回答正确，马上进入下一题。')).toBeTruthy()
    expect(onAnswer).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(900)
    })

    expect(onAnswer).toHaveBeenCalledWith('correct')
  })

  test('builds spelling answers from chunk buttons without text inputs', async () => {
    const onAnswer = vi.fn()
    const word = createWord('chunk-cat', 'cat')

    const { container } = render(
      <QuestionPanel
        allWords={[word]}
        onAnswer={onAnswer}
        questionType="spelling"
        soundEnabled={false}
        word={word}
      />,
    )

    expect(container.querySelector('.letter-input')).toBeNull()

    for (const chunk of ['c', 'a', 't']) {
      fireEvent.click(screen.getByRole('button', { name: chunk }))
    }
    fireEvent.click(screen.getByRole('button', { name: '提交' }))

    expect(screen.getByText('拼写正确，马上进入下一题。')).toBeTruthy()

    await act(async () => {
      vi.advanceTimersByTime(900)
    })

    expect(onAnswer).toHaveBeenCalledWith('correct')
  })

  test('shows read-aloud unsupported fallback and can skip', async () => {
    const onAnswer = vi.fn()
    const word = createWord('read-cat', 'cat')

    render(
      <QuestionPanel
        allWords={[word]}
        onAnswer={onAnswer}
        questionType="readAloud"
        soundEnabled={false}
        word={word}
      />,
    )

    expect(screen.getByText(/当前设备或浏览器未提供语音识别/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '跳过本题' }))

    await act(async () => {
      vi.advanceTimersByTime(700)
    })

    expect(onAnswer).toHaveBeenCalledWith('skipped')
  })

  test('gives spelling three retries before marking wrong', async () => {
    const onAnswer = vi.fn()
    const word = createWord('wrong-cat', 'cat')

    const { container } = render(
      <QuestionPanel
        allWords={[word]}
        onAnswer={onAnswer}
        questionType="spelling"
        soundEnabled={false}
        word={word}
      />,
    )

    const selectWrongChunk = () => {
      const wrongButton = Array.from(container.querySelectorAll('.chunk-option')).find(
        (button) => !['c', 'a', 't'].includes(button.textContent ?? ''),
      ) as HTMLButtonElement
      fireEvent.click(wrongButton)
    }

    selectWrongChunk()
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    expect(screen.getByText('第 1 次错误，还可以重试 2 次')).toBeTruthy()
    expect(onAnswer).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1500)
    })

    selectWrongChunk()
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    expect(screen.getByText('第 2 次错误，还可以重试 1 次')).toBeTruthy()
    expect(onAnswer).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1500)
    })

    selectWrongChunk()
    fireEvent.click(screen.getByRole('button', { name: '提交' }))

    await act(async () => {
      vi.advanceTimersByTime(1600)
    })

    expect(onAnswer).toHaveBeenCalledWith('wrong')
  })
})

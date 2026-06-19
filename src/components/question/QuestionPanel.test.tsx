import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { builtinWords } from '../../data/vocabulary'
import { QuestionPanel } from './QuestionPanel'

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

  test('gives spelling three retries before marking wrong', async () => {
    const onAnswer = vi.fn()
    const word = builtinWords.find((item) => item.text === 'guitar')!

    render(
      <QuestionPanel
        allWords={builtinWords}
        onAnswer={onAnswer}
        questionType="spelling"
        soundEnabled={false}
        word={word}
      />,
    )

    // 第1次错误 - 输入错误的第6个字母
    fireEvent.change(screen.getByLabelText('第6个字母'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    expect(screen.getByText('第 1 次错误，还可以重试 2 次')).toBeTruthy()
    expect(onAnswer).not.toHaveBeenCalled()

    // 等待1.5秒让输入框重置
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })

    // 第2次错误
    fireEvent.change(screen.getByLabelText('第6个字母'), { target: { value: 'y' } })
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    expect(screen.getByText('第 2 次错误，还可以重试 1 次')).toBeTruthy()
    expect(onAnswer).not.toHaveBeenCalled()

    // 等待1.5秒让输入框重置
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })

    // 第3次错误 - 这次应该标记为 wrong
    fireEvent.change(screen.getByLabelText('第6个字母'), { target: { value: 'z' } })
    fireEvent.click(screen.getByRole('button', { name: '提交' }))

    await act(async () => {
      vi.advanceTimersByTime(1600)
    })

    expect(onAnswer).toHaveBeenCalledWith('wrong')
  })
})

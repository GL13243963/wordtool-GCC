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

  test('gives spelling one retry before auto-advancing wrong answers', async () => {
    const onAnswer = vi.fn()
    const word = builtinWords.find((item) => item.text === 'guitar')!

    render(
      <QuestionPanel
        allWords={builtinWords}
        onAnswer={onAnswer}
        questionType="spelling"
        word={word}
      />,
    )

    fireEvent.change(screen.getByLabelText('输入英文拼写'), { target: { value: 'guita' } })
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    expect(screen.getByText('再试一次，注意拼写。')).toBeTruthy()
    expect(onAnswer).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    expect(screen.getByText('正确拼写：guitar')).toBeTruthy()
    expect(onAnswer).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1600)
    })

    expect(onAnswer).toHaveBeenCalledWith('wrong')
  })
})

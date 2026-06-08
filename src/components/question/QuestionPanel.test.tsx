import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { builtinWords } from '../../data/vocabulary'
import { QuestionPanel } from './QuestionPanel'

describe('QuestionPanel', () => {
  test('stages correct choice answers before moving next', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    const word = builtinWords.find((item) => item.text === 'different')!

    render(
      <QuestionPanel
        allWords={builtinWords}
        onAnswer={onAnswer}
        questionType="enToZh"
        word={word}
      />,
    )

    await user.click(screen.getByRole('button', { name: '不同的' }))

    expect(screen.getByText('回答正确！')).toBeTruthy()
    expect(onAnswer).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '下一题' }))
    expect(onAnswer).toHaveBeenCalledWith('correct')
  })

  test('gives spelling one retry before marking wrong', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    const word = builtinWords.find((item) => item.text === 'family')!

    render(
      <QuestionPanel
        allWords={builtinWords}
        onAnswer={onAnswer}
        questionType="spelling"
        word={word}
      />,
    )

    await user.type(screen.getByLabelText('输入英文拼写'), 'famil')
    await user.click(screen.getByRole('button', { name: '提交' }))
    expect(screen.getByText('再试一次，注意拼写。')).toBeTruthy()
    expect(onAnswer).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '提交' }))
    expect(screen.getByText('正确拼写：family')).toBeTruthy()
    expect(onAnswer).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '下一题' }))
    expect(onAnswer).toHaveBeenCalledWith('wrong')
  })
})

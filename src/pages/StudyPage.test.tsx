import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { builtinWords } from '../data/vocabulary'
import { DEFAULT_SETTINGS } from '../domain/settings/types'
import { StudyPage } from './StudyPage'

vi.mock('../storage/settingsRepository', () => ({
  getSettings: vi.fn(async () => DEFAULT_SETTINGS),
}))

vi.mock('../storage/progressRepository', () => ({
  getAllWords: vi.fn(async () => builtinWords),
  getProgressMap: vi.fn(async () => new Map()),
  submitWordAnswer: vi.fn(),
}))

vi.mock('../domain/study/audioFeedback', () => ({
  playLessonComplete: vi.fn(),
  playAnswerSound: vi.fn(),
  playComboSound: vi.fn(),
  speakEnglish: vi.fn(),
}))

const waitForStudyPageLoad = async () => {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('StudyPage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('pauses with a 3 minute countdown and auto returns home', async () => {
    const onNavigate = vi.fn()

    render(<StudyPage mode="study" onNavigate={onNavigate} />)
    await waitForStudyPageLoad()

    fireEvent.click(screen.getByRole('button', { name: '暂停' }))

    expect(screen.getByText('3:00')).toBeTruthy()
    expect(screen.getByText('练习已暂停')).toBeTruthy()

    await act(async () => {
      vi.advanceTimersByTime(180_000)
    })

    expect(onNavigate).toHaveBeenCalledWith('home')
  })

  test('can resume from pause without returning home', async () => {
    const onNavigate = vi.fn()

    render(<StudyPage mode="study" onNavigate={onNavigate} />)
    await waitForStudyPageLoad()

    fireEvent.click(screen.getByRole('button', { name: '暂停' }))

    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })

    expect(screen.getByText('2:59')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '继续练习' }))

    expect(onNavigate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '暂停' })).toBeTruthy()
  })
})

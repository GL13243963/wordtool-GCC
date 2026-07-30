import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { builtinWords } from '../data/vocabulary'
import { DEFAULT_SETTINGS } from '../domain/settings/types'
import { getActiveSession, saveSession } from '../storage/progressRepository'
import { StudyPage } from './StudyPage'

vi.mock('../storage/settingsRepository', () => ({
  getSettings: vi.fn(async () => DEFAULT_SETTINGS),
}))

vi.mock('../storage/progressRepository', () => ({
  getActiveSession: vi.fn(async () => undefined),
  getAllWords: vi.fn(async () => builtinWords),
  getProgressMap: vi.fn(async () => new Map()),
  saveAnswerRecord: vi.fn(),
  saveSession: vi.fn(),
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
    vi.mocked(getActiveSession).mockResolvedValue(undefined)
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

  test('resumes a saved daily session from its current question', async () => {
    const firstWord = builtinWords.find((word) => word.unitId === DEFAULT_SETTINGS.currentUnitId)!
    const secondWord = builtinWords.find((word) => word.unitId === DEFAULT_SETTINGS.currentUnitId && word.id !== firstWord.id)!
    vi.mocked(getActiveSession).mockResolvedValue({
      id: 'saved-session',
      studentId: DEFAULT_SETTINGS.studentId,
      type: 'daily',
      status: 'paused',
      unitId: DEFAULT_SETTINGS.currentUnitId,
      sessionDate: '2026-07-30',
      questionQueue: [
        { id: 'q1', wordId: firstWord.id, unitId: firstWord.unitId, questionType: 'enToZh', status: 'answered', answerResult: 'correct' },
        { id: 'q2', wordId: secondWord.id, unitId: secondWord.unitId, questionType: 'enToZh', status: 'pending' },
      ],
      currentQuestionIndex: 1,
      plannedNewWordIds: [firstWord.id, secondWord.id],
      plannedReviewWordIds: [],
      completedWordIds: [firstWord.id],
      settingsSnapshot: DEFAULT_SETTINGS,
      startedAt: Date.now() - 60_000,
      pausedAt: Date.now() - 30_000,
    })

    render(<StudyPage mode="study" onNavigate={vi.fn()} />)
    await waitForStudyPageLoad()

    expect(screen.getByText(secondWord.text)).toBeTruthy()
    expect(vi.mocked(saveSession).mock.calls.at(-1)?.[0].questionQueue.map((item) => item.questionType))
      .toEqual(['enToZh', 'enToZh', 'spelling', 'spelling', 'readAloud', 'readAloud'])
  })
})

import { useEffect, useMemo, useRef, useState } from 'react'
import { QuestionPanel } from '../components/question/QuestionPanel'
import { ProgressBar } from '../components/study/ProgressBar'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { playLessonComplete } from '../domain/study/audioFeedback'
import { createDailyTaskPlan } from '../domain/study/scheduler'
import type { AnswerMetadata, AnswerResult, QuestionItem, StudyMode, StudySession, WordProgress } from '../domain/study/types'
import type { Word } from '../domain/vocabulary/types'
import {
  getActiveSession,
  getAllWords,
  getProgressMap,
  saveAnswerRecord,
  saveSession,
  submitWordAnswer,
} from '../storage/progressRepository'
import { getSettings } from '../storage/settingsRepository'
import type { AppView } from '../App'
import type { AppSettings } from '../domain/settings/types'

type StudyPageProps = {
  onNavigate: (view: AppView) => void
  mode: StudyMode
}

const PAUSE_AUTO_RETURN_SECONDS = 180

const getLocalDateKey = (timestamp: number) => {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const createSessionId = (now: number) =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `session-${now}-${Math.random().toString(36).slice(2)}`

const formatPauseTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export const StudyPage = ({ onNavigate, mode }: StudyPageProps) => {
  const [words, setWords] = useState<Word[]>([])
  const [queue, setQueue] = useState<QuestionItem[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, WordProgress>>(new Map())
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [session, setSession] = useState<StudySession | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [comboCount, setComboCount] = useState(0)
  const [seenWordIds, setSeenWordIds] = useState<Set<string>>(new Set())
  const [isPaused, setIsPaused] = useState(false)
  const [pauseSecondsRemaining, setPauseSecondsRemaining] = useState(PAUSE_AUTO_RETURN_SECONDS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const questionStartedAtRef = useRef(Date.now())

  const isTestMode = mode === 'test'

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [settings, allWords, progressData, activeSession] = await Promise.all([
          getSettings(),
          getAllWords(),
          getProgressMap(),
          mode === 'study' ? getActiveSession() : Promise.resolve(undefined),
        ])
        if (cancelled) return

        const now = Date.now()
        const plan = createDailyTaskPlan({ words: allWords, progressByWordId: progressData, settings, now })
        const canResume = activeSession
          && activeSession.type === 'daily'
          && activeSession.unitId === settings.currentUnitId
          && activeSession.currentQuestionIndex < activeSession.questionQueue.length
        const nextSession: StudySession | null = isTestMode
          ? null
          : canResume
            ? { ...activeSession, status: 'active', pausedAt: undefined }
            : {
                id: createSessionId(now),
                studentId: settings.studentId,
                type: 'daily',
                status: 'active',
                unitId: settings.currentUnitId,
                sessionDate: getLocalDateKey(now),
                questionQueue: plan.questionQueue,
                currentQuestionIndex: 0,
                plannedNewWordIds: plan.newWords.map((word) => word.id),
                plannedReviewWordIds: plan.reviewWords.map((word) => word.id),
                completedWordIds: [],
                settingsSnapshot: settings,
                startedAt: now,
              }
        setSettings(settings)
        setWords(allWords)
        setProgressMap(progressData)
        setQueue(nextSession?.questionQueue ?? plan.questionQueue)
        setCurrentIndex(nextSession?.currentQuestionIndex ?? 0)
        setCompletedCount(nextSession?.currentQuestionIndex ?? 0)
        setSession(nextSession)
        if (nextSession) await saveSession(nextSession)
        questionStartedAtRef.current = now
      } catch {
        if (!cancelled) setError('今日任务生成失败，请返回首页后重试。')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [isTestMode, mode])

  useEffect(() => {
    if (!isPaused) return undefined

    const timer = window.setInterval(() => {
      setPauseSecondsRemaining((seconds) => {
        const nextSeconds = seconds - 1
        if (nextSeconds <= 0) {
          window.clearInterval(timer)
          onNavigate('home')
          return 0
        }
        return nextSeconds
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [isPaused, onNavigate])

  const currentQuestion = queue[currentIndex]
  const currentWord = useMemo(
    () => words.find((word) => word.id === currentQuestion?.wordId),
    [currentQuestion?.wordId, words],
  )

  const moveNext = () => {
    setCompletedCount((count) => count + 1)
    setCurrentIndex((index) => index + 1)
    questionStartedAtRef.current = Date.now()
  }

  const persistPausedSession = async () => {
    if (!session) return
    const nextSession = { ...session, status: 'paused' as const, pausedAt: Date.now(), currentQuestionIndex: currentIndex }
    setSession(nextSession)
    await saveSession(nextSession)
  }

  const handlePause = () => {
    setPauseSecondsRemaining(PAUSE_AUTO_RETURN_SECONDS)
    setIsPaused(true)
    void persistPausedSession()
  }

  const handleResume = () => {
    setIsPaused(false)
    setPauseSecondsRemaining(PAUSE_AUTO_RETURN_SECONDS)
    if (session) {
      const nextSession = { ...session, status: 'active' as const, pausedAt: undefined }
      setSession(nextSession)
      void saveSession(nextSession)
    }
    questionStartedAtRef.current = Date.now()
  }

  const handleReturnHome = () => {
    void persistPausedSession()
    onNavigate('home')
  }

  const handleAnswer = async (result: AnswerResult, metadata?: AnswerMetadata) => {
    if (!currentQuestion || !currentWord) return

    // 更新连击计数
    if (result === 'correct') {
      setComboCount((count) => count + 1)
    } else if (result === 'wrong') {
      setWrongCount((count) => count + 1)
      setComboCount(0)
    } else {
      setComboCount(0)
    }

    // 标记为已见过
    setSeenWordIds((prev) => new Set([...prev, currentWord.id]))

    // 测试模式不保存进度
    if (!isTestMode) {
      const answeredAt = Date.now()
      const masteryBefore = progressMap.get(currentWord.id)?.masteryScore ?? 0
      const nextProgress = await submitWordAnswer({
        word: currentWord,
        result,
        questionType: currentQuestion.questionType,
        answeredAt,
      })
      setProgressMap((current) => new Map(current).set(currentWord.id, nextProgress))

      if (session) {
        const nextQueue = queue.map((item, index) => index === currentIndex
          ? {
              ...item,
              status: result === 'skipped' ? 'skipped' as const : 'answered' as const,
              answerResult: result,
              answeredAt,
            }
          : item)
        const nextCompletedWordIds = Array.from(new Set([...session.completedWordIds, currentWord.id]))
        const isLastQuestion = currentIndex === queue.length - 1
        const nextSession: StudySession = {
          ...session,
          status: isLastQuestion ? 'completed' : 'active',
          questionQueue: nextQueue,
          currentQuestionIndex: currentIndex + 1,
          completedWordIds: nextCompletedWordIds,
          completedAt: isLastQuestion ? answeredAt : undefined,
        }
        await Promise.all([
          saveAnswerRecord({
            id: `${session.id}:${currentQuestion.id}`,
            sessionId: session.id,
            studentId: session.studentId,
            wordId: currentWord.id,
            unitId: currentWord.unitId,
            questionType: currentQuestion.questionType,
            result,
            answeredAt,
            responseTimeMs: Math.max(0, answeredAt - questionStartedAtRef.current),
            masteryBefore,
            masteryAfter: nextProgress.masteryScore,
            pronunciation: metadata?.pronunciation,
          }),
          saveSession(nextSession),
        ])
        setQueue(nextQueue)
        setSession(nextSession)
      }
    }

    // 如果是最后一题，播放结算音效
    if (currentIndex === queue.length - 1) {
      playLessonComplete(settings?.soundEnabled ?? true)
    }

    moveNext()
  }

  if (loading) return <Card><p>正在生成今日任务……</p></Card>

  if (error) {
    return (
      <Card className="center-card">
        <h1>任务加载失败</h1>
        <p className="muted">{error}</p>
        <Button onClick={() => onNavigate('home')} type="button">返回首页</Button>
      </Card>
    )
  }

  if (queue.length === 0) {
    return (
      <Card className="center-card">
        <h1>今天暂时没有任务</h1>
        <p className="muted">当前单元的新词可能已经学完，旧词也还没有到复习时间。</p>
        <Button onClick={() => onNavigate('home')} type="button">返回首页</Button>
      </Card>
    )
  }

  if (!currentQuestion || !currentWord) {
    return (
      <div className="study-layout study-layout--focused">
        <Card className="center-card study-result-card">
          <h1>{isTestMode ? '测试完成！' : '今日任务完成！'}</h1>
          <p>完成 {completedCount} 题，错题 {wrongCount} 题。</p>
          {isTestMode && <p className="muted">测试模式不记录学习进度</p>}
          <Button onClick={handleReturnHome} type="button">回到首页</Button>
        </Card>
      </div>
    )
  }

  if (isPaused) {
    return (
      <div className="study-layout study-layout--focused">
        <Card className="pause-card">
          <p className="eyebrow">练习已暂停</p>
          <h1>{formatPauseTime(pauseSecondsRemaining)}</h1>
          <p className="muted">超过 3 分钟将自动返回首页，本次未完成的题目会在下次重新开始。</p>
          <div className="study-footer-actions">
            <Button onClick={handleResume} type="button">继续练习</Button>
            <Button onClick={handleReturnHome} type="button" variant="ghost">返回首页</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="study-layout study-layout--focused">
      <div className="study-focus-header">
        <div>
          <p className="eyebrow">{isTestMode ? '测试模式' : '学习模式'}</p>
          <h1>{currentQuestion.questionType === 'enToZh' ? '选择正确释义' : currentQuestion.questionType === 'spelling' ? '拼出单词' : '朗读单词'}</h1>
          <p className="study-focus-header__unit">{currentWord.unitTitle}</p>
        </div>
        <div className="study-focus-header__actions">
          <Button onClick={handlePause} type="button" variant="secondary">暂停</Button>
          <Button onClick={handleReturnHome} type="button" variant="ghost">首页</Button>
        </div>
      </div>
      <ProgressBar current={Math.min(currentIndex + 1, queue.length)} total={queue.length} />
      <Card className="study-card study-card--focused">
        <QuestionPanel
          allWords={words}
          comboCount={comboCount}
          isFirstEncounter={!seenWordIds.has(currentWord.id)}
          isStarred={progressMap.get(currentWord.id)?.starred}
          key={currentQuestion.id}
          onAnswer={handleAnswer}
          onToggleStar={() => {
            // 刷新 progressMap 以更新收藏状态
            getProgressMap().then(setProgressMap)
          }}
          questionType={currentQuestion.questionType}
          soundEnabled={settings?.soundEnabled ?? true}
          word={currentWord}
        />
      </Card>
    </div>
  )
}

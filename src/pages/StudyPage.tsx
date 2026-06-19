import { useEffect, useMemo, useState } from 'react'
import { QuestionPanel } from '../components/question/QuestionPanel'
import { ProgressBar } from '../components/study/ProgressBar'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { playLessonComplete } from '../domain/study/audioFeedback'
import { createDailyTaskPlan } from '../domain/study/scheduler'
import type { AnswerResult, QuestionItem, StudyMode } from '../domain/study/types'
import type { Word } from '../domain/vocabulary/types'
import { getAllWords, getProgressMap, submitWordAnswer } from '../storage/progressRepository'
import { getSettings } from '../storage/settingsRepository'
import type { AppView } from '../App'
import type { AppSettings } from '../domain/settings/types'

type StudyPageProps = {
  onNavigate: (view: AppView) => void
  mode: StudyMode
}

export const StudyPage = ({ onNavigate, mode }: StudyPageProps) => {
  const [words, setWords] = useState<Word[]>([])
  const [queue, setQueue] = useState<QuestionItem[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, any>>(new Map())
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [comboCount, setComboCount] = useState(0)
  const [seenWordIds, setSeenWordIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isTestMode = mode === 'test'

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [settings, allWords, progressData] = await Promise.all([
          getSettings(),
          getAllWords(),
          getProgressMap(),
        ])
        if (cancelled) return

        const plan = createDailyTaskPlan({ words: allWords, progressByWordId: progressData, settings, now: Date.now() })
        setSettings(settings)
        setWords(allWords)
        setProgressMap(progressData)
        setQueue(plan.questionQueue)
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
  }, [])

  const currentQuestion = queue[currentIndex]
  const currentWord = useMemo(
    () => words.find((word) => word.id === currentQuestion?.wordId),
    [currentQuestion?.wordId, words],
  )

  const moveNext = () => {
    setCompletedCount((count) => count + 1)
    setCurrentIndex((index) => index + 1)
  }

  const handleAnswer = async (result: AnswerResult) => {
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
      await submitWordAnswer({
        word: currentWord,
        result,
        questionType: currentQuestion.questionType,
        answeredAt: Date.now(),
      })
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
      <Card className="center-card">
        <h1>{isTestMode ? '测试完成！' : '今日任务完成！'}</h1>
        <p>完成 {completedCount} 题，错题 {wrongCount} 题。</p>
        {isTestMode && <p className="muted">测试模式不记录学习进度</p>}
        <Button onClick={() => onNavigate('home')} type="button">回到首页</Button>
      </Card>
    )
  }

  return (
    <div className="study-layout">
      <div className="study-header-card">
        <div>
          <p className="eyebrow">{isTestMode ? '测试模式' : '今日练习'}</p>
          <h1>{currentWord.unitTitle}</h1>
        </div>
        <ProgressBar current={Math.min(currentIndex + 1, queue.length)} total={queue.length} />
      </div>
      <Card className="study-card">
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
      <Button onClick={() => onNavigate('home')} type="button" variant="ghost">暂停并返回首页</Button>
    </div>
  )
}

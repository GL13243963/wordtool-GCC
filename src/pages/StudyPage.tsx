import { useEffect, useMemo, useState } from 'react'
import { QuestionPanel } from '../components/question/QuestionPanel'
import { ProgressBar } from '../components/study/ProgressBar'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { createDailyTaskPlan } from '../domain/study/scheduler'
import type { AnswerResult, QuestionItem } from '../domain/study/types'
import type { Word } from '../domain/vocabulary/types'
import { getAllWords, getProgressMap, submitWordAnswer } from '../storage/progressRepository'
import { getSettings } from '../storage/settingsRepository'
import type { AppView } from '../App'

type StudyPageProps = {
  onNavigate: (view: AppView) => void
}

export const StudyPage = ({ onNavigate }: StudyPageProps) => {
  const [words, setWords] = useState<Word[]>([])
  const [queue, setQueue] = useState<QuestionItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [settings, allWords, progressMap] = await Promise.all([
          getSettings(),
          getAllWords(),
          getProgressMap(),
        ])
        if (cancelled) return

        const plan = createDailyTaskPlan({ words: allWords, progressByWordId: progressMap, settings, now: Date.now() })
        setWords(allWords)
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

    if (result === 'wrong') setWrongCount((count) => count + 1)
    await submitWordAnswer({
      word: currentWord,
      result,
      questionType: currentQuestion.questionType,
      answeredAt: Date.now(),
    })
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
        <h1>今日任务完成！</h1>
        <p>完成 {completedCount} 题，错题 {wrongCount} 题。</p>
        <Button onClick={() => onNavigate('home')} type="button">回到首页</Button>
      </Card>
    )
  }

  return (
    <div className="study-layout">
      <ProgressBar current={Math.min(currentIndex + 1, queue.length)} total={queue.length} />
      <Card>
        <QuestionPanel
          allWords={words}
          key={currentQuestion.id}
          onAnswer={handleAnswer}
          questionType={currentQuestion.questionType}
          word={currentWord}
        />
      </Card>
      <Button onClick={() => onNavigate('home')} type="button" variant="ghost">暂停并返回首页</Button>
    </div>
  )
}

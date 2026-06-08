import { useEffect, useMemo, useState } from 'react'
import type { AppView } from '../App'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { createDailyTaskPlan } from '../domain/study/scheduler'
import type { WordProgress } from '../domain/study/types'
import type { Unit, Word } from '../domain/vocabulary/types'
import { getAllUnits, getAllWords, getProgressMap } from '../storage/progressRepository'
import { getSettings } from '../storage/settingsRepository'

type HomePageProps = {
  onNavigate: (view: AppView) => void
}

export const HomePage = ({ onNavigate }: HomePageProps) => {
  const [words, setWords] = useState<Word[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, WordProgress>>(new Map())
  const [currentUnitId, setCurrentUnitId] = useState('g6b-u1')
  const [taskCount, setTaskCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [settings, nextWords, nextUnits, nextProgressMap] = await Promise.all([
          getSettings(),
          getAllWords(),
          getAllUnits(),
          getProgressMap(),
        ])
        if (cancelled) return

        const plan = createDailyTaskPlan({
          words: nextWords,
          progressByWordId: nextProgressMap,
          settings,
          now: Date.now(),
        })

        setCurrentUnitId(settings.currentUnitId)
        setTaskCount(plan.questionQueue.length)
        setWords(nextWords)
        setUnits(nextUnits)
        setProgressMap(nextProgressMap)
      } catch {
        if (!cancelled) setError('学习数据加载失败，请刷新页面或从备份恢复。')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const currentUnit = units.find((unit) => unit.id === currentUnitId)
  const currentUnitWords = useMemo(
    () => words.filter((word) => word.unitId === currentUnitId),
    [currentUnitId, words],
  )
  const masteredCount = currentUnitWords.filter((word) => progressMap.get(word.id)?.status === 'mastered').length
  const dueReviewCount = Array.from(progressMap.values()).filter(
    (progress) => progress.nextReviewAt !== undefined && progress.nextReviewAt <= Date.now(),
  ).length

  if (loading) return <Card><p>正在加载学习数据……</p></Card>

  if (error) {
    return (
      <Card className="center-card">
        <h1>首页加载失败</h1>
        <p className="muted">{error}</p>
        <Button onClick={() => onNavigate('settings')} type="button">打开设置与备份</Button>
      </Card>
    )
  }

  return (
    <div className="page-grid">
      <Card className="hero-card">
        <p className="eyebrow">今日任务</p>
        <h1>开始 {currentUnit?.title ?? '当前单元'} 的单词闯关</h1>
        <p className="muted">
          当前范围：{currentUnit?.grade} {currentUnit?.semester} · {currentUnit?.title}
        </p>
        <div className="hero-actions">
          <Button onClick={() => onNavigate('study')} type="button">开始今日任务（{taskCount} 题）</Button>
          <Button onClick={() => onNavigate('progress')} type="button" variant="secondary">查看进度</Button>
        </div>
      </Card>

      <Card>
        <h2>Unit 掌握情况</h2>
        <p className="stat-number">{masteredCount} / {currentUnitWords.length}</p>
        <p className="muted">已掌握单词 / 当前单元单词</p>
      </Card>

      <Card>
        <h2>待复习</h2>
        <p className="stat-number">{dueReviewCount}</p>
        <p className="muted">到期旧词会优先出现在今日任务中。</p>
      </Card>

      <Card>
        <h2>家长设置与备份</h2>
        <p className="muted">调整每日新词数、复习数，并定期导出本地学习数据。</p>
        <Button onClick={() => onNavigate('settings')} type="button" variant="ghost">打开设置</Button>
      </Card>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import type { AppView } from '../App'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { AppSettings } from '../domain/settings/types'
import { createDailyTaskPlan } from '../domain/study/scheduler'
import type { WordProgress } from '../domain/study/types'
import type { Unit, Word } from '../domain/vocabulary/types'
import { getAllUnits, getAllWords, getProgressMap } from '../storage/progressRepository'
import { getSettings, saveSettings } from '../storage/settingsRepository'

type HomePageProps = {
  onNavigate: (view: AppView) => void
}

type UnitNodeStatus = 'passed' | 'learning' | 'available' | 'upcoming'

const getUnitMasteryRate = (unitWords: Word[], progressMap: Map<string, WordProgress>) => {
  if (unitWords.length === 0) return 0

  const masteredCount = unitWords.filter((word) => progressMap.get(word.id)?.status === 'mastered').length
  return masteredCount / unitWords.length
}

const getUnitNodeStatus = ({
  unit,
  currentUnitId,
  masteryRate,
  hasProgress,
}: {
  unit: Unit
  currentUnitId: string
  masteryRate: number
  hasProgress: boolean
}): UnitNodeStatus => {
  if (masteryRate >= 0.8) return 'passed'
  if (unit.id === currentUnitId) return 'learning'
  if (hasProgress) return 'available'
  return unit.order <= 2 ? 'available' : 'upcoming'
}


export const HomePage = ({ onNavigate }: HomePageProps) => {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [words, setWords] = useState<Word[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, WordProgress>>(new Map())
  const [taskCount, setTaskCount] = useState(0)
  const [isSelectingUnit, setIsSelectingUnit] = useState(false)
  const [selectionError, setSelectionError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [nextSettings, nextWords, nextUnits, nextProgressMap] = await Promise.all([
          getSettings(),
          getAllWords(),
          getAllUnits(),
          getProgressMap(),
        ])
        if (cancelled) return

        const plan = createDailyTaskPlan({
          words: nextWords,
          progressByWordId: nextProgressMap,
          settings: nextSettings,
          now: Date.now(),
        })

        setSettings(nextSettings)
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

  const currentUnit = units.find((unit) => unit.id === settings?.currentUnitId)
  const currentBookUnits = useMemo(
    () => units.filter((unit) => unit.bookId === settings?.currentBookId).sort((a, b) => a.order - b.order),
    [settings?.currentBookId, units],
  )
  const currentUnitWords = useMemo(
    () => words.filter((word) => word.unitId === settings?.currentUnitId),
    [settings?.currentUnitId, words],
  )
  const currentMasteryRate = getUnitMasteryRate(currentUnitWords, progressMap)
  const masteredCount = currentUnitWords.filter((word) => progressMap.get(word.id)?.status === 'mastered').length
  const dueReviewCount = Array.from(progressMap.values()).filter(
    (progress) => progress.nextReviewAt !== undefined && progress.nextReviewAt <= Date.now(),
  ).length

  // 统计数据
  const masteredTotal = Array.from(progressMap.values()).filter((p) => p.status === 'mastered').length
  const totalCorrect = Array.from(progressMap.values()).reduce((sum, p) => sum + p.correctCount, 0)
  const studyDays = new Set(
    Array.from(progressMap.values())
      .filter((item) => item.firstSeenAt)
      .map((item) => new Date(item.firstSeenAt!).toDateString()),
  ).size

  const handleSelectUnit = async (unit: Unit) => {
    if (!settings || isSelectingUnit) return

    setIsSelectingUnit(true)
    setSelectionError('')
    try {
      const nextSettings = await saveSettings({
        ...settings,
        currentBookId: unit.bookId,
        currentUnitId: unit.id,
      })
      const plan = createDailyTaskPlan({ words, progressByWordId: progressMap, settings: nextSettings, now: Date.now() })
      setSettings(nextSettings)
      setTaskCount(plan.questionQueue.length)
    } catch {
      setSelectionError('切换 Unit 失败，请稍后重试。')
    } finally {
      setIsSelectingUnit(false)
    }
  }

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
    <div className="page-stack">
      {/* 今日任务 - 置顶，全宽大卡片 */}
      <Card className="hero-card hero-card--today">
        <div className="today-task-header">
          <div>
            <p className="eyebrow">今日任务</p>
            <h1>开始今天的单词练习</h1>
          </div>
          <div className="today-task-stats">
            <div className="stat-mini">
              <span className="stat-mini__value">{settings?.dailyNewWordLimit ?? 10}</span>
              <span className="stat-mini__label">新词</span>
            </div>
            <div className="stat-mini">
              <span className="stat-mini__value">{dueReviewCount}</span>
              <span className="stat-mini__label">待复习</span>
            </div>
          </div>
        </div>
        <div className="today-task-footer">
          <Button onClick={() => onNavigate('study')} size="large" type="button">
            开始学习 · {taskCount} 题
          </Button>
        </div>
      </Card>

      {/* 学习统计 */}
      <div className="stats-grid">
        <Card className="stat-card">
          <p className="stat-card__value">{studyDays || 1}</p>
          <p className="stat-card__label">学习天数</p>
        </Card>
        <Card className="stat-card">
          <p className="stat-card__value">{masteredTotal}</p>
          <p className="stat-card__label">已掌握单词</p>
        </Card>
        <Card className="stat-card">
          <p className="stat-card__value">{totalCorrect}</p>
          <p className="stat-card__label">累计答对</p>
        </Card>
        <Card className="stat-card">
          <p className="stat-card__value">{Math.round(currentMasteryRate * 100)}%</p>
          <p className="stat-card__label">当前单元掌握</p>
        </Card>
      </div>

      {/* 学习地图 + 当前单元 */}
      <div className="page-grid">
        <Card className="compact-map-card">
          <p className="eyebrow">学习地图</p>
          <div className="unit-path unit-path--compact" aria-label="Unit 闯关节点图">
            {currentBookUnits.map((unit) => {
              const unitWords = words.filter((word) => word.unitId === unit.id)
              const masteryRate = getUnitMasteryRate(unitWords, progressMap)
              const hasProgress = unitWords.some((word) => (progressMap.get(word.id)?.seenCount ?? 0) > 0)
              const status = getUnitNodeStatus({
                unit,
                currentUnitId: settings?.currentUnitId ?? '',
                masteryRate,
                hasProgress,
              })

              return (
                <button
                  className={`unit-node unit-node--compact unit-node--${status}`}
                  disabled={isSelectingUnit}
                  key={unit.id}
                  onClick={() => void handleSelectUnit(unit)}
                  type="button"
                >
                  <span className="unit-node__badge unit-node__badge--small">U{unit.order}</span>
                  <span className="unit-node__meta">{Math.round(masteryRate * 100)}%</span>
                </button>
              )
            })}
          </div>
          {selectionError && <p className="question-panel__feedback question-panel__feedback--error">{selectionError}</p>}
        </Card>

        <Card className="current-unit-card">
          <p className="eyebrow">当前关卡</p>
          <h2>{currentUnit?.title ?? '当前单元'}</h2>
          <p className="muted">
            {currentUnit?.grade} {currentUnit?.semester} · 已掌握 {masteredCount} / {currentUnitWords.length} 个词
          </p>
          <div className="mastery-ring" aria-label={`当前掌握率 ${Math.round(currentMasteryRate * 100)}%`}>
            <span>{Math.round(currentMasteryRate * 100)}%</span>
          </div>
        </Card>
      </div>
    </div>
  )
}

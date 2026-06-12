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

const getStatusText = (status: UnitNodeStatus) => {
  if (status === 'passed') return '已通关'
  if (status === 'learning') return '学习中'
  if (status === 'available') return '可开始'
  return '建议稍后'
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
      <Card className="hero-card hero-card--map">
        <p className="eyebrow">七年级上册学习地图</p>
        <h1>沿着 Unit 路线一步步闯关</h1>
        <p className="muted">所有关卡都可以查看和切换，建议按顺序学习。当前关卡会用蓝色高亮。</p>
        <div className="unit-path" aria-label="七年级上册 Unit 闯关节点图">
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
                className={`unit-node unit-node--${status}`}
                disabled={isSelectingUnit}
                key={unit.id}
                onClick={() => void handleSelectUnit(unit)}
                type="button"
              >
                <span className="unit-node__badge">U{unit.order}</span>
                <span className="unit-node__title">{unit.title}</span>
                <span className="unit-node__meta">{getStatusText(status)} · {Math.round(masteryRate * 100)}%</span>
              </button>
            )
          })}
        </div>
        {selectionError && <p className="question-panel__feedback question-panel__feedback--error">{selectionError}</p>}
      </Card>

      <div className="page-grid page-grid--dashboard">
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

        <Card>
          <h2>今日任务</h2>
          <p className="stat-number">{taskCount}</p>
          <p className="muted">题目会根据掌握情况自动安排，拼写题会在熟悉后出现。</p>
          <Button onClick={() => onNavigate('study')} type="button">开始今日任务</Button>
        </Card>

        <Card>
          <h2>待复习</h2>
          <p className="stat-number">{dueReviewCount}</p>
          <p className="muted">到期旧词会优先出现在今日任务中。</p>
        </Card>
      </div>
    </div>
  )
}

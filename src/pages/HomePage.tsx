import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { AppView } from '../App'
import { Button } from '../components/ui/Button'
import type { AppSettings } from '../domain/settings/types'
import { getUnitStats } from '../domain/study/progressStats'
import type { StudyMode, WordProgress } from '../domain/study/types'
import type { Unit, Word } from '../domain/vocabulary/types'
import { getAllUnits, getAllWords, getProgressMap } from '../storage/progressRepository'
import { getSettings } from '../storage/settingsRepository'

type HomePageProps = {
  onNavigate: (view: AppView) => void
  onNavigateToStudy: (mode: StudyMode) => void
}

type UnitNodeStatus = 'passed' | 'learning' | 'available' | 'upcoming'

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

const MODES = [
  {
    id: 'study' as StudyMode,
    icon: '📚',
    title: '学习模式',
    desc: '按单元顺序，每天智能出题学习',
    primary: true,
  },
  {
    id: 'wrongWords' as StudyMode,
    icon: '💪',
    title: '错题复习',
    desc: '集中练习历史错题，重点突破',
  },
  {
    id: 'mixed' as StudyMode,
    icon: '🔀',
    title: '混合练习',
    desc: '随机抽取各单元题目，全面巩固',
  },
  {
    id: 'test' as StudyMode,
    icon: '🧪',
    title: '测试模式',
    desc: '纯测试，不记录进度，检验掌握程度',
  },
]

export const HomePage = ({ onNavigate, onNavigateToStudy }: HomePageProps) => {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [words, setWords] = useState<Word[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, WordProgress>>(new Map())
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

        setSettings(nextSettings)
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
  const currentUnitStats = getUnitStats(currentUnitWords, progressMap)
  const currentMasteryRate = Math.round(currentUnitStats.masteryRate * 100)

  // 统计数据
  const learnedTotal = Array.from(progressMap.values()).filter((p) => p.seenCount > 0).length
  const weakWords = Array.from(progressMap.values()).filter((p) => p.wrongCount > p.correctCount && p.seenCount > 2).length
  const studyDays = new Set(
    Array.from(progressMap.values())
      .filter((item) => item.firstSeenAt)
      .map((item) => new Date(item.firstSeenAt!).toDateString()),
  ).size

  if (loading) {
    return (
      <div className="home-centered">
        <div className="loading-placeholder">
          <p>正在加载学习数据……</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="home-centered">
        <div className="error-card">
          <h2>首页加载失败</h2>
          <p className="muted">{error}</p>
          <Button onClick={() => onNavigate('settings')} type="button">
            打开设置与备份
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="home-stack">
      {/* 标题区域 */}
      <header className="home-header">
        <h1 className="home-title">牛津单词闯关</h1>
        <p className="home-subtitle">积跬步，至千里</p>
      </header>

      {/* 进度总览卡片 */}
      <div className="progress-overview-card">
        <div className="big-progress-row">
          <div
            className="progress-ring"
            style={{ '--mastery-angle': `${currentMasteryRate * 3.6}deg` } as CSSProperties}
          >
            <div className="progress-ring-inner">
              <span className="progress-number">{currentMasteryRate}%</span>
              <span className="progress-label">掌握度</span>
            </div>
          </div>

          <div className="progress-stats-grid">
            <div className="stat-mini-item">
              <span className="stat-mini-num">{learnedTotal}</span>
              <span className="stat-mini-label">已学单词</span>
            </div>
            <div className="stat-mini-item">
              <span className="stat-mini-num">{weakWords}</span>
              <span className="stat-mini-label">待巩固</span>
            </div>
            <div className="stat-mini-item">
              <span className="stat-mini-num">{studyDays}</span>
              <span className="stat-mini-label">学习天数</span>
            </div>
          </div>
        </div>

        {/* 当前单元信息 */}
        <div className="current-unit-info">
          <span className="current-unit-badge">当前单元</span>
          <span className="current-unit-title">{currentUnit?.title ?? '未选择'}</span>
        </div>

        {/* 极简单元进度点 */}
        <div className="unit-dots-map">
          {currentBookUnits.map((unit) => {
            const unitWords = words.filter((word) => word.unitId === unit.id)
            const unitStats = getUnitStats(unitWords, progressMap)
            const masteryRate = unitStats.masteryRate
            const hasProgress = unitStats.learnedCount > 0
            const status = getUnitNodeStatus({
              unit,
              currentUnitId: settings?.currentUnitId ?? '',
              masteryRate,
              hasProgress,
            })

            return <div className={`unit-dot unit-dot--${status}`} key={unit.id} title={`${unit.title} - ${Math.round(masteryRate * 100)}%`} />
          })}
        </div>
      </div>

      {/* 学习模式选择 */}
      <section className="modes-section">
        <h2 className="section-label">选择学习模式</h2>
        <div className="modes-list">
          {MODES.map((mode) => (
            <button
              className={`mode-button ${mode.primary ? 'mode-button--primary' : ''}`}
              key={mode.id}
              onClick={() => onNavigateToStudy(mode.id)}
              type="button"
            >
              <span className="mode-icon">{mode.icon}</span>
              <div className="mode-content">
                <h3 className="mode-title">{mode.title}</h3>
                <p className="mode-desc">{mode.desc}</p>
              </div>
              <span className="mode-arrow">→</span>
            </button>
          ))}
        </div>
      </section>

      {/* 底部设置入口 */}
      <div className="home-footer">
        <Button className="button--ghost" onClick={() => onNavigate('settings')} type="button">
          ⚙️ 设置与数据管理
        </Button>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { AppView } from '../App'
import { Button } from '../components/ui/Button'
import type { AppSettings } from '../domain/settings/types'
import { getUnitStats } from '../domain/study/progressStats'
import { createDailyTaskPlan } from '../domain/study/scheduler'
import type { StudyMode, WordProgress } from '../domain/study/types'
import type { Unit, Word } from '../domain/vocabulary/types'
import { getAllUnits, getAllWords, getAnswerRecordsForStudent, getProgressMap } from '../storage/progressRepository'
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
  const [studyDateKeys, setStudyDateKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [nextSettings, nextWords, nextUnits, nextProgressMap, answerRecords] = await Promise.all([
          getSettings(),
          getAllWords(),
          getAllUnits(),
          getProgressMap(),
          getAnswerRecordsForStudent(),
        ])
        if (cancelled) return

        setSettings(nextSettings)
        setWords(nextWords)
        setUnits(nextUnits)
        setProgressMap(nextProgressMap)
        setStudyDateKeys(new Set(answerRecords.map((record) => new Date(record.answeredAt).toLocaleDateString('sv-SE'))))
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
  const dailyTaskPlan = useMemo(
    () => settings
      ? createDailyTaskPlan({ words, progressByWordId: progressMap, settings, now: Date.now() })
      : null,
    [progressMap, settings, words],
  )
  const dailyQuestionCount = dailyTaskPlan?.questionQueue.length ?? 0
  const dailySpellingCount = dailyTaskPlan?.questionQueue.filter((item) => item.questionType === 'spelling').length ?? 0
  const dailyReadAloudCount = dailyTaskPlan?.questionQueue.filter((item) => item.questionType === 'readAloud').length ?? 0

  // 统计数据
  const learnedTotal = Array.from(progressMap.values()).filter((p) => p.seenCount > 0).length
  const weakWords = Array.from(progressMap.values()).filter((p) => p.wrongCount > p.correctCount && p.seenCount > 2).length
  const studyDays = new Set(
    Array.from(progressMap.values())
      .filter((item) => item.firstSeenAt)
      .map((item) => new Date(item.firstSeenAt!).toDateString()),
  ).size
  const today = new Date()
  const todayKey = today.toLocaleDateString('sv-SE')
  const weekStart = new Date(today)
  const dayOffset = (today.getDay() + 6) % 7
  weekStart.setDate(today.getDate() - dayOffset)
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    const key = date.toLocaleDateString('sv-SE')
    return {
      key,
      weekday: ['一', '二', '三', '四', '五', '六', '日'][index],
      date: date.getDate(),
      isToday: key === todayKey,
      hasStudied: studyDateKeys.has(key),
    }
  })
  let streakDays = 0
  const streakCursor = new Date(today)
  if (!studyDateKeys.has(todayKey)) streakCursor.setDate(streakCursor.getDate() - 1)
  while (studyDateKeys.has(streakCursor.toLocaleDateString('sv-SE'))) {
    streakDays += 1
    streakCursor.setDate(streakCursor.getDate() - 1)
  }
  const dateGreeting = `${today.getMonth() + 1}月${today.getDate()}日星期${['日', '一', '二', '三', '四', '五', '六'][today.getDay()]}`

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
      <section className="weekly-greeting">
        <div className="weekly-greeting__top">
          <div>
            <p className="home-kicker">本周学习日历</p>
            <h1>郭城成，今天是{dateGreeting}</h1>
            <p>你已经开始坚持打卡 <strong>{streakDays}</strong> 天，今天让我们开始吧！</p>
          </div>
          <Button className="home-settings-button" onClick={() => onNavigate('settings')} type="button" variant="ghost">
            设置
          </Button>
        </div>
        <div className="week-calendar">
          {weekDays.map((day) => (
            <div className={`week-calendar__day ${day.isToday ? 'week-calendar__day--today' : ''} ${day.hasStudied ? 'week-calendar__day--done' : ''}`} key={day.key}>
              <span>周{day.weekday}</span>
              <strong>{day.date}</strong>
              <small>{day.hasStudied ? '✓' : '·'}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="today-card">
        <div className="today-card__content">
          <p className="eyebrow">今日任务</p>
          <h2>{currentUnit ? `Unit ${currentUnit.order} · ${currentUnit.title}` : '选择一个单元开始'}</h2>
          <p className="today-card__desc">
            {currentUnit ? `${currentUnit.grade}${currentUnit.semester}，今天按当前设置安排练习。` : '在设置页选择书册与 Unit 后开始学习。'}
          </p>
          <div className="today-metrics">
            <div>
              <strong>{dailyTaskPlan?.newWords.length ?? 0}</strong>
              <span>新词</span>
            </div>
            <div>
              <strong>{dailyTaskPlan?.reviewWords.length ?? 0}</strong>
              <span>复习</span>
            </div>
            <div>
              <strong>{dailyQuestionCount}</strong>
              <span>题目</span>
            </div>
          </div>
        </div>
        <div className="today-card__progress">
          <div
            className="progress-ring"
            style={{ '--mastery-angle': `${currentMasteryRate * 3.6}deg` } as CSSProperties}
          >
            <div className="progress-ring-inner">
              <span className="progress-number">{currentMasteryRate}%</span>
              <span className="progress-label">掌握度</span>
            </div>
          </div>
          <p>已掌握 {currentUnitStats.masteredCount} / {currentUnitWords.length}</p>
        </div>
      </section>

      <Button className="home-start-button" onClick={() => onNavigateToStudy('study')} size="large" type="button">
        开始今日学习
      </Button>

      <section className="home-overview">
        <div className="progress-overview-card">
          <div className="home-learning-summary">
            <div>
              <span className="stat-mini-num">{learnedTotal}</span>
              <span className="stat-mini-label">已学单词</span>
            </div>
            <div>
              <span className="stat-mini-num">{weakWords}</span>
              <span className="stat-mini-label">待巩固内容</span>
            </div>
          </div>
          <div className="progress-stats-grid">
            <div>
              <span className="stat-mini-num">{studyDays}</span>
              <span className="stat-mini-label">学习天数</span>
            </div>
            <div>
              <span className="stat-mini-num">{dailySpellingCount + dailyReadAloudCount}</span>
              <span className="stat-mini-label">强化题</span>
            </div>
          </div>

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

        <div className="modes-list">
          {MODES.filter((mode) => !mode.primary).map((mode) => (
            <button
              className="mode-button"
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
    </div>
  )
}

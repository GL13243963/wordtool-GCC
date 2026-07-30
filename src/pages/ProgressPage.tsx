import { useEffect, useState } from 'react'
import type { AppView } from '../App'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { AnswerRecord, StudySession, WordProgress } from '../domain/study/types'
import { calculateUnitMasteryRate, getAppearedWordCount } from '../domain/study/unitGate'
import type { Unit, Word } from '../domain/vocabulary/types'
import {
  getAllUnits,
  getAllWords,
  getAnswerRecordsForStudent,
  getProgressMap,
  getSessionsForStudent,
} from '../storage/progressRepository'

type ProgressPageProps = {
  onNavigate: (view: AppView) => void
}

export const ProgressPage = ({ onNavigate }: ProgressPageProps) => {
  const [units, setUnits] = useState<Unit[]>([])
  const [words, setWords] = useState<Word[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, WordProgress>>(new Map())
  const [answerRecords, setAnswerRecords] = useState<AnswerRecord[]>([])
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [nextUnits, nextWords, nextProgressMap, nextAnswerRecords, nextSessions] = await Promise.all([
          getAllUnits(),
          getAllWords(),
          getProgressMap(),
          getAnswerRecordsForStudent(),
          getSessionsForStudent(),
        ])
        if (cancelled) return
        setUnits(nextUnits)
        setWords(nextWords)
        setProgressMap(nextProgressMap)
        setAnswerRecords(nextAnswerRecords)
        setSessions(nextSessions)
      } catch {
        if (!cancelled) setError('进度数据加载失败，请稍后重试或从备份恢复。')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <Card><p>正在加载进度……</p></Card>

  if (error) {
    return (
      <Card className="center-card">
        <h1>进度加载失败</h1>
        <p className="muted">{error}</p>
        <Button onClick={() => onNavigate('home')} type="button">返回首页</Button>
      </Card>
    )
  }

  const recentDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (6 - index))
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)
    const records = answerRecords.filter((record) => record.answeredAt >= date.getTime() && record.answeredAt < nextDate.getTime())
    const correctCount = records.filter((record) => record.result === 'correct').length
    return {
      key: date.toISOString(),
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      count: records.length,
      accuracy: records.length > 0 ? Math.round((correctCount / records.length) * 100) : 0,
    }
  })
  const maxDailyAnswers = Math.max(1, ...recentDays.map((day) => day.count))
  const completedSessions = sessions.filter((session) => session.status === 'completed')
  const totalStudyMinutes = Math.round(
    answerRecords.reduce((total, record) => total + record.responseTimeMs, 0) / 60_000,
  )
  const recentCorrectCount = answerRecords.filter((record) => record.result === 'correct').length
  const overallAccuracy = answerRecords.length > 0 ? Math.round((recentCorrectCount / answerRecords.length) * 100) : 0

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">闯关地图</p>
          <h1>Unit 进度</h1>
        </div>
        <Button onClick={() => onNavigate('home')} type="button" variant="secondary">返回首页</Button>
      </div>

      <section className="history-overview" aria-label="学习历史">
        <Card>
          <p className="eyebrow">个人学习档案</p>
          <h2>最近 7 天</h2>
          <div className="history-summary">
            <div><strong>{completedSessions.length}</strong><span>完成任务</span></div>
            <div><strong>{answerRecords.length}</strong><span>累计答题</span></div>
            <div><strong>{overallAccuracy}%</strong><span>累计正确率</span></div>
            <div><strong>{totalStudyMinutes}</strong><span>学习分钟</span></div>
          </div>
          <div className="history-chart" role="img" aria-label="最近七天答题数量柱状图">
            {recentDays.map((day) => (
              <div className="history-chart__day" key={day.key}>
                <span className="history-chart__value">{day.count || '·'}</span>
                <div className="history-chart__track">
                  <div
                    className="history-chart__bar"
                    style={{ height: `${Math.max(day.count > 0 ? 12 : 0, (day.count / maxDailyAnswers) * 100)}%` }}
                    title={`${day.label}：${day.count} 题，正确率 ${day.accuracy}%`}
                  />
                </div>
                <span>{day.label}</span>
              </div>
            ))}
          </div>
          {answerRecords.length === 0 && <p className="muted">完成一次今日任务后，这里会形成你的学习曲线。</p>}
        </Card>
      </section>

      <div className="unit-grid">
        {units.map((unit) => {
          const unitWords = words.filter((word) => word.unitId === unit.id)
          const appeared = getAppearedWordCount({ unitWords, progressByWordId: progressMap })
          const masteryRate = calculateUnitMasteryRate({ unitWords, progressByWordId: progressMap })
          return (
            <Card key={unit.id}>
              <p className="eyebrow">{unit.grade} {unit.semester}</p>
              <h2>{unit.title}</h2>
              <p>出现进度：{appeared} / {unitWords.length}</p>
              <p>掌握率：{Math.round(masteryRate * 100)}%</p>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

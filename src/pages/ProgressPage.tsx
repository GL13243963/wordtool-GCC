import { useEffect, useState } from 'react'
import type { AppView } from '../App'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { WordProgress } from '../domain/study/types'
import { calculateUnitMasteryRate, getAppearedWordCount } from '../domain/study/unitGate'
import type { Unit, Word } from '../domain/vocabulary/types'
import { getAllUnits, getAllWords, getProgressMap } from '../storage/progressRepository'

type ProgressPageProps = {
  onNavigate: (view: AppView) => void
}

export const ProgressPage = ({ onNavigate }: ProgressPageProps) => {
  const [units, setUnits] = useState<Unit[]>([])
  const [words, setWords] = useState<Word[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, WordProgress>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [nextUnits, nextWords, nextProgressMap] = await Promise.all([
          getAllUnits(),
          getAllWords(),
          getProgressMap(),
        ])
        if (cancelled) return
        setUnits(nextUnits)
        setWords(nextWords)
        setProgressMap(nextProgressMap)
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

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">闯关地图</p>
          <h1>Unit 进度</h1>
        </div>
        <Button onClick={() => onNavigate('home')} type="button" variant="secondary">返回首页</Button>
      </div>

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

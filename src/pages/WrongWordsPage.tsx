import { useEffect, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { WordProgress } from '../domain/study/types'
import type { Word } from '../domain/vocabulary/types'
import { getAllWords, getWrongWords } from '../storage/progressRepository'
import type { AppView } from '../App'

type WrongWordWithData = {
  progress: WordProgress
  word: Word
}

type WrongWordsPageProps = {
  onNavigate: (view: AppView) => void
}

export const WrongWordsPage = ({ onNavigate }: WrongWordsPageProps) => {
  const [wrongWords, setWrongWords] = useState<WrongWordWithData[]>([])
  const [loading, setLoading] = useState(true)
  const [exportMessage, setExportMessage] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [allWords, wrongProgress] = await Promise.all([
          getAllWords(),
          getWrongWords(),
        ])
        if (cancelled) return

        const wordMap = new Map(allWords.map((word) => [word.id, word]))
        const wrongWordsWithData = wrongProgress
          .map((progress) => ({
            progress,
            word: wordMap.get(progress.wordId)!,
          }))
          .filter((item) => item.word)
          .sort((a, b) => b.progress.wrongCount - a.progress.wrongCount)

        setWrongWords(wrongWordsWithData)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <Card><p>正在加载错题本……</p></Card>
  }

  const handleExport = async () => {
    if (wrongWords.length === 0 || isExporting) return
    setIsExporting(true)
    setExportMessage('')
    try {
      const { downloadWrongWordsDocument } = await import('../domain/export/wrongWordsDocx')
      await downloadWrongWordsDocument(wrongWords)
      setExportMessage('Word 错题卡已导出，可以直接打印或保存。')
    } catch {
      setExportMessage('Word 导出失败，请稍后重试。')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="page-stack">
      <Card>
        <div className="page-title-row">
          <div>
            <p className="eyebrow">错题本</p>
            <h1>需要加强的单词</h1>
          </div>
          <div className="wrong-words-actions">
            <Button disabled={wrongWords.length === 0 || isExporting} onClick={() => void handleExport()} type="button" variant="secondary">
              {isExporting ? '正在生成……' : '导出 Word 记忆卡'}
            </Button>
            <Button onClick={() => onNavigate('study')} type="button">开始复习</Button>
          </div>
        </div>

        {wrongWords.length === 0 ? (
          <p className="muted">太棒了！目前没有需要加强的单词 🎉</p>
        ) : (
          <div className="wrong-words-list">
            {wrongWords.map(({ word, progress }) => (
              <div className="wrong-word-item" key={word.id}>
                <div>
                  <div className="wrong-word-item__text">{word.text}</div>
                  <div className="wrong-word-item__meaning">{word.meaningZh.join('；')}</div>
                </div>
                <div className="wrong-word-item__stats">
                  <span className="wrong-word-item__wrong">错 {progress.wrongCount}</span>
                  <span className="wrong-word-item__correct">对 {progress.correctCount}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {exportMessage && <p className="question-panel__feedback">{exportMessage}</p>}
      </Card>
    </div>
  )
}

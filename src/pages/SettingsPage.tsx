import { ChangeEvent, useEffect, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { AppView } from '../App'
import type { AppSettings } from '../domain/settings/types'
import { exportBackup, restoreBackup } from '../storage/backupService'
import { getSettings, saveSettings } from '../storage/settingsRepository'

const MAX_BACKUP_FILE_SIZE_BYTES = 5 * 1024 * 1024

type SettingsPageProps = {
  onNavigate: (view: AppView) => void
}

type BackupPanelProps = {
  message: string
  onExport: () => Promise<void>
  onRestore: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
}

const BackupPanel = ({ message, onExport, onRestore }: BackupPanelProps) => (
  <Card>
    <h2>完整备份 / 恢复</h2>
    <p className="muted">
      数据保存在当前浏览器中，建议每周或通关后导出一次备份。备份是明文 JSON，包含学习记录，请妥善保存。
    </p>
    <div className="hero-actions">
      <Button onClick={onExport} type="button">导出备份</Button>
      <label className="file-button">
        导入备份
        <input accept="application/json,.json" onChange={onRestore} type="file" />
      </label>
    </div>
    {message && <p className="question-panel__feedback">{message}</p>}
  </Card>
)

export const SettingsPage = ({ onNavigate }: SettingsPageProps) => {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const nextSettings = await getSettings()
        if (!cancelled) setSettings(nextSettings)
      } catch {
        if (!cancelled) setLoadError('设置加载失败。你仍然可以在下方导入备份恢复数据。')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const updateNumber = (key: 'dailyNewWordLimit' | 'dailyReviewLimit' | 'dailyTimeLimitMinutes') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!settings) return
      setSettings({ ...settings, [key]: Number(event.target.value) })
    }

  const handleSave = async () => {
    if (!settings) return

    try {
      const saved = await saveSettings(settings)
      setSettings(saved)
      setMessage('设置已保存。')
    } catch {
      setMessage('设置无效：新词数 1-100，复习数 0-300，学习时间 5-180 分钟。')
    }
  }

  const handleExport = async () => {
    try {
      const backup = await exportBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `oxford-vocab-backup-${backup.exportedAt.slice(0, 10)}.json`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setMessage('备份已导出。')
    } catch {
      setMessage('备份导出失败，请稍后重试。')
    }
  }

  const handleRestore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (file.size > MAX_BACKUP_FILE_SIZE_BYTES) {
      setMessage('备份文件太大，未导入。')
      return
    }

    const shouldRestore = window.confirm('导入备份会覆盖当前浏览器里的学习记录，确定继续吗？')
    if (!shouldRestore) return

    try {
      const backup = JSON.parse(await file.text())
      await restoreBackup(backup)
      setSettings(await getSettings())
      setLoadError('')
      setMessage('备份已恢复。')
    } catch {
      setMessage('备份文件无效，未覆盖当前数据。')
    }
  }

  if (isLoading) return <Card><p>正在加载设置……</p></Card>

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">家长设置</p>
          <h1>学习量与备份</h1>
        </div>
        <Button onClick={() => onNavigate('home')} type="button" variant="secondary">返回首页</Button>
      </div>

      {loadError && (
        <Card>
          <h2>设置加载失败</h2>
          <p className="muted">{loadError}</p>
        </Card>
      )}

      {settings && (
        <Card className="settings-form">
          <label>
            每日新词数
            <input min="1" max="100" onChange={updateNumber('dailyNewWordLimit')} type="number" value={settings.dailyNewWordLimit} />
          </label>
          <label>
            每日复习数
            <input min="0" max="300" onChange={updateNumber('dailyReviewLimit')} type="number" value={settings.dailyReviewLimit} />
          </label>
          <label>
            每日学习时间（分钟）
            <input min="5" max="180" onChange={updateNumber('dailyTimeLimitMinutes')} type="number" value={settings.dailyTimeLimitMinutes} />
          </label>
          <label className="checkbox-row">
            <input
              checked={settings.autoAdvanceUnit}
              onChange={(event) => setSettings({ ...settings, autoAdvanceUnit: event.target.checked })}
              type="checkbox"
            />
            通关后自动进入下一 Unit（后续完善通关测后生效）
          </label>
          <Button onClick={handleSave} type="button">保存设置</Button>
        </Card>
      )}

      <BackupPanel message={message} onExport={handleExport} onRestore={handleRestore} />
    </div>
  )
}

export const ProgressBar = ({ current, total }: { current: number; total: number }) => {
  const percent = total === 0 ? 0 : Math.round((current / total) * 100)

  return (
    <div className="progress-bar" aria-label={`学习进度 ${percent}%`}>
      <div className="progress-bar__track">
        <div className="progress-bar__fill" style={{ width: `${percent}%` }} />
      </div>
      <span>{current} / {total}</span>
    </div>
  )
}

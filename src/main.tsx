import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ensureSeedData } from './storage/seed'
import './styles/global.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root was not found')
}

const root = createRoot(rootElement)

const renderInitializationError = () => {
  root.render(
    <StrictMode>
      <div className="app-shell">
        <section className="card center-card">
          <h1>初始化失败</h1>
          <p className="muted">本地数据库无法初始化，请检查浏览器是否禁用了 IndexedDB，然后刷新重试。</p>
        </section>
      </div>
    </StrictMode>,
  )
}

ensureSeedData()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch(renderInitializationError)

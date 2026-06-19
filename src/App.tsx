import { useState } from 'react'
import { HomePage } from './pages/HomePage'
import { ProgressPage } from './pages/ProgressPage'
import { SettingsPage } from './pages/SettingsPage'
import { StudyPage } from './pages/StudyPage'
import { WrongWordsPage } from './pages/WrongWordsPage'
import type { StudyMode } from './domain/study/types'

export type AppView = 'home' | 'study' | 'progress' | 'settings' | 'wrongWords'

export type StudyParams = {
  mode: StudyMode
}

export type AppState =
  | { view: 'home' }
  | { view: 'study'; params: StudyParams }
  | { view: 'wrongWords' }
  | { view: 'progress' }
  | { view: 'settings' }

export const App = () => {
  const [state, setState] = useState<AppState>({ view: 'home' })

  const isStudyView = state.view === 'study'

  const navigateToStudy = (mode: StudyMode) => {
    setState({ view: 'study', params: { mode } })
  }

  const navigate = (view: AppView) => {
    setState({ view } as AppState)
  }

  return (
    <div className="app-shell">
      <header className={`app-header ${isStudyView ? 'app-header--hidden' : ''}`}>
        <div>
          <p className="eyebrow">Oxford English</p>
          <h1>单词闯关</h1>
        </div>
        <nav className="app-nav" aria-label="主导航">
          <button onClick={() => setState({ view: 'home' })} type="button">首页</button>
          <button onClick={() => navigateToStudy('study')} type="button">学习</button>
          <button onClick={() => setState({ view: 'wrongWords' })} type="button">错题本</button>
          <button onClick={() => setState({ view: 'progress' })} type="button">进度</button>
          <button onClick={() => setState({ view: 'settings' })} type="button">设置</button>
        </nav>
      </header>

      <main>
        {state.view === 'home' && <HomePage onNavigate={navigate} onNavigateToStudy={navigateToStudy} />}
        {state.view === 'study' && <StudyPage onNavigate={navigate} mode={state.params.mode} />}
        {state.view === 'wrongWords' && <WrongWordsPage onNavigate={navigate} />}
        {state.view === 'progress' && <ProgressPage onNavigate={navigate} />}
        {state.view === 'settings' && <SettingsPage onNavigate={navigate} />}
      </main>
    </div>
  )
}

import { useState } from 'react'
import { HomePage } from './pages/HomePage'
import { ProgressPage } from './pages/ProgressPage'
import { SettingsPage } from './pages/SettingsPage'
import { StudyPage } from './pages/StudyPage'
import { WrongWordsPage } from './pages/WrongWordsPage'

export type AppView = 'home' | 'study' | 'progress' | 'settings' | 'wrongWords'

export const App = () => {
  const [view, setView] = useState<AppView>('home')

  const isStudyView = view === 'study'

  return (
    <div className="app-shell">
      <header className={`app-header ${isStudyView ? 'app-header--hidden' : ''}`}>
        <div>
          <p className="eyebrow">Oxford English</p>
          <h1>单词闯关</h1>
        </div>
        <nav className="app-nav" aria-label="主导航">
          <button onClick={() => setView('home')} type="button">首页</button>
          <button onClick={() => setView('study')} type="button">学习</button>
          <button onClick={() => setView('wrongWords')} type="button">错题本</button>
          <button onClick={() => setView('progress')} type="button">进度</button>
          <button onClick={() => setView('settings')} type="button">设置</button>
        </nav>
      </header>

      <main>
        {view === 'home' && <HomePage onNavigate={setView} />}
        {view === 'study' && <StudyPage onNavigate={setView} />}
        {view === 'wrongWords' && <WrongWordsPage onNavigate={setView} />}
        {view === 'progress' && <ProgressPage onNavigate={setView} />}
        {view === 'settings' && <SettingsPage onNavigate={setView} />}
      </main>
    </div>
  )
}

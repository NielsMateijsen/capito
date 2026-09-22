import { useEffect, useRef, useState } from 'react'
import type { Content } from './exercises/types.ts'
import type { ProgressState } from './storage/types.ts'
import { IdbProgressStorage, defaultState } from './storage/progress-store.ts'
import { loadUnits, loadTenses } from './content/loader.ts'
import { exercises } from './exercises/index.ts'
import SessionScreen from './ui/SessionScreen.tsx'
import { S } from './ui/strings.nl.ts'
import './ui/session.css'
import appConfig from '../config/app.json'

type AppPhase = 'loading' | 'ready' | 'session'

interface AppData {
  content: Content
  allCardKeys: string[]
  cardToUnit: Map<string, string>
  progress: ProgressState
}

const storage = new IdbProgressStorage()

export default function App() {
  const [appPhase, setAppPhase] = useState<AppPhase>('loading')
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    async function load() {
      try {
        const units = loadUnits()
        const tenses = loadTenses()

        const words = new Map(units.flatMap(u => u.words.map(w => [w.id, w])))
        const verbs = new Map(units.flatMap(u => u.verbs.map(v => [v.id, v])))
        const sentences = new Map(units.flatMap(u => u.sentences.map(s => [s.id, s])))

        const content: Content = { words, verbs, sentences, tenses: new Map(tenses.map(t => [t.id, t])), units }

        const itemToUnit = new Map<string, string>()
        for (const unit of units) {
          for (const w of unit.words) itemToUnit.set(w.id, unit.id)
          for (const v of unit.verbs) itemToUnit.set(v.id, unit.id)
          for (const s of unit.sentences) itemToUnit.set(s.id, unit.id)
        }

        const allCardKeys = exercises.flatMap(e => e.cards(content))
        const cardToUnit = new Map(
          allCardKeys.map(k => [k, itemToUnit.get(k.split(':')[1] ?? '') ?? ''])
        )

        const progress = await storage.load()
        setData({ content, allCardKeys, cardToUnit, progress })
        setAppPhase('ready')
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    void load()
  }, [])

  function handleSessionDone() {
    // Reload progress after session (it was saved during session)
    storage.load().then(progress => {
      if (data) setData({ ...data, progress })
      setAppPhase('ready')
    }).catch(() => setAppPhase('ready'))
  }

  if (error) {
    return (
      <div className="app-loading">
        <p>Fout bij laden: {error}</p>
      </div>
    )
  }

  if (appPhase === 'loading' || !data) {
    return (
      <div className="app-loading">
        <p>{S.LOADING}</p>
      </div>
    )
  }

  if (appPhase === 'session') {
    return (
      <SessionScreen
        content={data.content}
        allCardKeys={data.allCardKeys}
        cardToUnit={data.cardToUnit}
        initialProgress={data.progress}
        storage={storage}
        config={appConfig}
        onDone={handleSessionDone}
      />
    )
  }

  return (
    <div className="app-ready">
      <h1>Capito</h1>
      <button className="btn-primary" onClick={() => setAppPhase('session')}>
        {S.START_SESSION}
      </button>
    </div>
  )
}

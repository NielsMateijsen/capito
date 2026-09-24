import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import type { Content } from './exercises/types.ts'
import type { ProgressState, Settings } from './storage/types.ts'
import type { SessionItem } from './engine/session-builder.ts'
import type { Unit } from './content/schemas.ts'
import type { GrammarDoc } from './content/loader.ts'
import { IdbProgressStorage, defaultState } from './storage/progress-store.ts'
import { loadUnits, loadTenses, loadGrammarDocs } from './content/loader.ts'
import { exercises } from './exercises/index.ts'
import { buildExamSession } from './engine/exam.ts'
import { isLeech } from './engine/session-builder.ts'
import { exportJson } from './storage/migrations.ts'
import { shouldRequestPersistentStorage } from './storage/persist.ts'
import { createNavigator } from './ui/navigation.ts'
import SessionScreen from './ui/SessionScreen.tsx'
import HomeScreen from './ui/HomeScreen.tsx'
import UnitScreen from './ui/UnitScreen.tsx'
import GrammarScreen from './ui/GrammarScreen.tsx'
import DialogueScreen from './ui/DialogueScreen.tsx'
import SettingsScreen from './ui/SettingsScreen.tsx'
import ReportsScreen from './ui/ReportsScreen.tsx'
import LeechScreen from './ui/LeechScreen.tsx'
import { S } from './ui/strings.nl.ts'
import './ui/session.css'
import appConfig from '../config/app.json'

type View =
  | { screen: 'loading' }
  | { screen: 'home' }
  | { screen: 'unit'; unitId: string }
  | { screen: 'session'; targetUnitId?: string; mode: 'daily' | 'unit' | 'exam'; overrideQueue?: SessionItem[] }
  | { screen: 'grammar'; grammarId: string; fromUnitId: string }
  | { screen: 'dialogue'; dialogueId: string; unitId: string }
  | { screen: 'settings' }
  | { screen: 'reports' }
  | { screen: 'leech' }

interface AppData {
  content: Content
  units: Unit[]
  allCardKeys: string[]
  cardToUnit: Map<string, string>
  cardKeysByUnit: Map<string, string[]>
  grammarMap: Map<string, GrammarDoc>
  progress: ProgressState
}

const storage = new IdbProgressStorage()

const unlockConfig = { ...appConfig.unlock, passThreshold: appConfig.exam.passThreshold }

const HOME: View = { screen: 'home' }

export default function App() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  const [view, setView] = useState<View>({ screen: 'loading' })
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loaded = useRef(false)
  const [nav] = useState(() => createNavigator<View>(window.history, setView))

  useEffect(() => {
    function onPopState(e: PopStateEvent) {
      if (nav.handlePop(e.state)) void reloadProgress()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [nav])

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    async function load() {
      try {
        const units = loadUnits()
        const tenses = loadTenses()
        const grammarDocs = loadGrammarDocs()

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

        const cardKeysByUnit = new Map<string, string[]>()
        for (const unit of units) cardKeysByUnit.set(unit.id, [])
        for (const [key, unitId] of cardToUnit) {
          cardKeysByUnit.get(unitId)?.push(key)
        }

        const grammarMap = new Map(grammarDocs.map(d => [d.frontmatter.id, d]))

        let progress = await storage.load()

        if (shouldRequestPersistentStorage(appConfig.backup.requestPersistentStorage, progress.meta.persistGranted)) {
          const granted = await navigator.storage.persist()
          progress = { ...progress, meta: { ...progress.meta, persistGranted: granted } }
          await storage.save(progress)
        }

        setData({ content, units, allCardKeys, cardToUnit, cardKeysByUnit, grammarMap, progress })
        nav.start(HOME)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    void load()
  }, [])

  async function reloadProgress(): Promise<ProgressState> {
    const progress = await storage.load()
    setData(d => d ? { ...d, progress } : d)
    return progress
  }

  function handleSessionDone() {
    reloadProgress().then(() => nav.home(HOME)).catch(() => nav.home(HOME))
  }

  function handleEindtoets(unitId: string) {
    if (!data) return
    const examKeys = buildExamSession(unitId, data.allCardKeys, data.cardToUnit, appConfig.exam)
    const overrideQueue: SessionItem[] = examKeys.map(k => ({ kind: 'exercise' as const, cardKey: k, isNew: false }))
    nav.navigate({ screen: 'session', mode: 'exam', targetUnitId: unitId, overrideQueue })
  }

  async function handleSaveSettings(settings: Settings) {
    if (!data) return
    const next = { ...data.progress, settings }
    await storage.save(next)
    await reloadProgress()
  }

  async function handleReset() {
    await storage.save(defaultState())
    await reloadProgress()
    nav.home(HOME)
  }

  async function handleExport() {
    if (!data) return
    const state = { ...data.progress, meta: { ...data.progress.meta, build: __BUILD__.commit } }
    const json = exportJson(state)
    const date = new Date().toISOString().slice(0, 10)
    const filename = `capito-backup-${date}.json`
    const blob = new Blob([json], { type: 'application/json' })

    if (navigator.canShare?.({ files: [new File([blob], filename, { type: 'application/json' })] })) {
      try {
        await navigator.share({ files: [new File([blob], filename, { type: 'application/json' })] })
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        throw e
      }
    } else {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }

    const next = { ...data.progress, meta: { ...data.progress.meta, lastExportAt: new Date().toISOString(), build: __BUILD__.commit } }
    await storage.save(next)
    await reloadProgress()
  }

  async function handleImport(backup: ProgressState) {
    await storage.save(backup)
    await reloadProgress()
  }

  if (error) {
    return (
      <div className="app-loading">
        <p>{S.LOAD_ERROR(error)}</p>
      </div>
    )
  }

  if (view.screen === 'loading' || !data) {
    return (
      <div className="app-loading">
        <p>{S.LOADING}</p>
      </div>
    )
  }

  const settings = (data.progress.settings ?? {}) as Settings
  const unlockAll = settings.unlockAll === true
  const autoplayAudio = settings.autoplayAudio === true
  const flagCount = data.progress.flags.length
  const leechCount = Object.values(data.progress.cards).filter(s => isLeech(s, appConfig.leech)).length

  const banner = needRefresh ? (
    <div className="banner update-banner">
      <span>{S.UPDATE_BANNER}</span>
      <button className="btn-primary" onClick={() => void updateServiceWorker(true)}>{S.UPDATE_BTN}</button>
    </div>
  ) : null

  const screen = (() => {
    if (view.screen === 'unit') {
      const unit = data.units.find(u => u.id === view.unitId)
      if (!unit) return null
      return (
        <UnitScreen
          unit={unit}
          cardKeysByUnit={data.cardKeysByUnit}
          progress={data.progress}
          config={appConfig}
          grammarMap={data.grammarMap}
          onBack={() => nav.back(HOME)}
          onOefen={unitId => nav.navigate({ screen: 'session', mode: 'unit', targetUnitId: unitId })}
          onEindtoets={handleEindtoets}
          onOpenGrammar={grammarId => nav.navigate({ screen: 'grammar', grammarId, fromUnitId: view.unitId })}
          onOpenDialogue={dialogueId => nav.navigate({ screen: 'dialogue', dialogueId, unitId: view.unitId })}
        />
      )
    }

    if (view.screen === 'grammar') {
      const doc = data.grammarMap.get(view.grammarId)
      return (
        <GrammarScreen
          grammarId={view.grammarId}
          doc={doc}
          allCardKeys={data.allCardKeys}
          onBack={() => nav.back({ screen: 'unit', unitId: view.fromUnitId })}
          onDrill={queue => nav.navigate({ screen: 'session', mode: 'unit', overrideQueue: queue })}
        />
      )
    }

    if (view.screen === 'dialogue') {
      const unit = data.units.find(u => u.id === view.unitId)
      const dialogue = unit?.dialogues.find(d => d.id === view.dialogueId)
      if (!unit || !dialogue) return null
      return (
        <DialogueScreen
          dialogue={dialogue}
          unitDialogues={unit.dialogues}
          sentences={data.content.sentences}
          onBack={() => nav.back({ screen: 'unit', unitId: view.unitId })}
        />
      )
    }

    if (view.screen === 'session') {
      return (
        <SessionScreen
          content={data.content}
          allCardKeys={data.allCardKeys}
          cardToUnit={data.cardToUnit}
          initialProgress={data.progress}
          storage={storage}
          config={appConfig}
          mode={view.mode}
          overrideQueue={view.overrideQueue}
          autoplayAudio={autoplayAudio}
          onDone={handleSessionDone}
        />
      )
    }

    if (view.screen === 'settings') {
      return (
        <SettingsScreen
          progress={data.progress}
          config={appConfig}
          onSave={handleSaveSettings}
          onReset={handleReset}
          onBack={() => nav.back(HOME)}
          onExport={handleExport}
          onImport={handleImport}
        />
      )
    }

    if (view.screen === 'reports') {
      return (
        <ReportsScreen
          flags={data.progress.flags}
          onBack={() => nav.back(HOME)}
        />
      )
    }

    if (view.screen === 'leech') {
      return (
        <LeechScreen
          content={data.content}
          progress={data.progress}
          config={appConfig}
          onBack={() => nav.back(HOME)}
        />
      )
    }

    return (
      <HomeScreen
        units={data.units}
        cardKeysByUnit={data.cardKeysByUnit}
        progress={data.progress}
        config={{ ...appConfig, unlock: unlockConfig }}
        unlockAll={unlockAll}
        flagCount={flagCount}
        leechCount={leechCount}
        onStartSession={() => nav.navigate({ screen: 'session', mode: 'daily' })}
        onOpenUnit={unitId => nav.navigate({ screen: 'unit', unitId })}
        onOpenSettings={() => nav.navigate({ screen: 'settings' })}
        onOpenReports={() => nav.navigate({ screen: 'reports' })}
        onOpenLeech={() => nav.navigate({ screen: 'leech' })}
        onExport={handleExport}
      />
    )
  })()

  return <>{banner}{screen}</>
}

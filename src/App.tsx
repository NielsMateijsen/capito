import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import type { Content } from './exercises/types.ts'
import type { ProgressState, Settings } from './storage/types.ts'
import type { Session, SessionItem } from './engine/session-builder.ts'
import type { Unit } from './content/schemas.ts'
import type { GrammarDoc } from './content/loader.ts'
import { IdbProgressStorage, defaultState } from './storage/progress-store.ts'
import { loadUnits, loadTenses, loadGrammarDocs } from './content/loader.ts'
import { exercises, exerciseMap } from './exercises/index.ts'
import { buildExamSession } from './engine/exam.ts'
import { buildTestQueue } from './engine/test-session.ts'
import { buildLesson, buildRefresh, cardType, isLeech } from './engine/session-builder.ts'
import { ladderItems as buildLadderItems } from './engine/ladder.ts'
import type { LadderItem } from './engine/ladder.ts'
import { overview as buildOverview } from './engine/overview.ts'
import type { Overview } from './engine/overview.ts'
import { ladderItemOrder } from './engine/sentences.ts'
import { exportJson } from './storage/migrations.ts'
import { shouldRequestPersistentStorage } from './storage/persist.ts'
import { createNavigator } from './ui/navigation.ts'
import SessionScreen from './ui/SessionScreen.tsx'
import type { SessionMode, SessionSummary } from './ui/SessionScreen.tsx'
import HomeScreen from './ui/HomeScreen.tsx'
import UnitScreen from './ui/UnitScreen.tsx'
import GrammarScreen from './ui/GrammarScreen.tsx'
import DialogueScreen from './ui/DialogueScreen.tsx'
import SettingsScreen from './ui/SettingsScreen.tsx'
import ReportsScreen from './ui/ReportsScreen.tsx'
import LeechScreen from './ui/LeechScreen.tsx'
import { S } from './ui/strings.nl.ts'
import './ui/session.css'
import './ui/app.css'
import './ui/exercise.css'
import appConfig from '../config/app.json'

/** What a session screen practises; kept in the history entry, so it holds data only. */
type SessionRequest =
  | { mode: 'lesson'; lessonId: string }
  | { mode: 'refresh'; onlyKeys?: string[] }
  | { mode: 'exam'; unitId: string }
  | { mode: 'test' | 'drill'; queue: SessionItem[] }

type View =
  | { screen: 'loading' }
  | { screen: 'home' }
  | { screen: 'unit'; unitId: string }
  | { screen: 'session'; request: SessionRequest; nonce: string }
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
  ladderItems: LadderItem[]
  /** Words and verbs on the ladder per unit, in learning order. */
  unitItems: Map<string, string[]>
  cardRequires: Map<string, string[]>
  grammarMap: Map<string, GrammarDoc>
  progress: ProgressState
}

const storage = new IdbProgressStorage()

const HOME: View = { screen: 'home' }

/** Whether an exercise can be built from the current content (content can change under old cards). */
function canBuild(content: Content, key: string): boolean {
  try {
    exerciseMap.get(cardType(key))?.build(key, content, { seq: 0, optionCount: appConfig.ladder.optionCount })
    return true
  } catch {
    return false
  }
}

function configFor(settings: Settings) {
  const { itemsPerLesson, minItemsPerLesson, maxItemsPerLesson } = appConfig.lesson
  // An imported backup can carry any value
  const perLesson = Math.min(maxItemsPerLesson, Math.max(minItemsPerLesson, settings.newItemsPerLesson ?? itemsPerLesson))
  return { ...appConfig, lesson: { ...appConfig.lesson, itemsPerLesson: perLesson } }
}

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

        const ladderItems = buildLadderItems(ladderItemOrder(content), appConfig.ladder.stages, allCardKeys)
        const unitItems = new Map(units.map(u => [u.id, ladderItems.filter(li => itemToUnit.get(li.itemId) === u.id).map(li => li.itemId)]))
        const cardRequires = new Map<string, string[]>()
        for (const e of exercises) {
          if (!e.requires) continue
          for (const key of e.cards(content)) cardRequires.set(key, e.requires(key, content))
        }

        const grammarMap = new Map(grammarDocs.map(d => [d.frontmatter.id, d]))

        let progress = await storage.load()

        if (shouldRequestPersistentStorage(appConfig.backup.requestPersistentStorage, progress.meta.persistGranted)) {
          const granted = await navigator.storage.persist()
          progress = { ...progress, meta: { ...progress.meta, persistGranted: granted } }
          await storage.save(progress)
        }

        setData({ content, units, allCardKeys, cardToUnit, ladderItems, unitItems, cardRequires, grammarMap, progress })
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

  function overviewFor(d: AppData, progress: ProgressState): Overview {
    const settings = progress.settings ?? {}
    return buildOverview({
      now: Date.now(),
      units: d.units,
      unitItems: d.unitItems,
      ladderItems: d.ladderItems,
      allCardKeys: d.allCardKeys,
      cardRequires: d.cardRequires,
      progress,
      config: configFor(settings),
      unlockAll: settings.unlockAll === true,
    })
  }

  function buildSessionFor(d: AppData, request: SessionRequest, progress: ProgressState): Session {
    const now = Date.now()
    const config = configFor(progress.settings ?? {})
    const base = { now, seed: now, allCardKeys: d.allCardKeys, progress, config, ladderItems: d.ladderItems, cardRequires: d.cardRequires }
    const fixed = (queue: SessionItem[], maxReviews: number): Session => ({ queue, maxReviews, newItemIds: [], ladderStages: {} })
    switch (request.mode) {
      case 'lesson': {
        const paths = overviewFor(d, progress).paths
        const lesson = [...paths.values()].flatMap(p => p.lessons).find(s => s.lesson.id === request.lessonId)?.lesson
        return lesson ? buildLesson({ ...base, lesson, unitItems: d.unitItems.get(lesson.unitId) }) : fixed([], 0)
      }
      case 'refresh':
        return buildRefresh({ ...base, onlyKeys: request.onlyKeys })
      case 'exam': {
        const unit = d.units.find(u => u.id === request.unitId)
        const keys = buildExamSession({
          unitId: request.unitId,
          unitItems: d.unitItems.get(request.unitId) ?? [],
          earlierUnitIds: new Set(d.units.filter(u => unit && u.order < unit.order).map(u => u.id)),
          // Every question must be answerable, or the exam could never be complete
          allCardKeys: d.allCardKeys.filter(k => canBuild(d.content, k)),
          cardToUnit: d.cardToUnit,
          cards: progress.cards,
          config: appConfig.exam,
          seed: now,
        })
        return fixed(keys.map(k => ({ kind: 'exercise' as const, cardKey: k, isNew: false })), keys.length)
      }
      case 'test':
        return fixed(request.queue, request.queue.length)
      case 'drill':
        return fixed(request.queue, Number.POSITIVE_INFINITY)
    }
  }

  function openSession(request: SessionRequest, replace = false) {
    const next: View = { screen: 'session', request, nonce: crypto.randomUUID() }
    if (replace) nav.replace(next)
    else nav.navigate(next)
  }

  /** From an end screen to another session: first pick up what the finished session saved. */
  async function reopenSession(request: SessionRequest) {
    await reloadProgress()
    openSession(request, true)
  }

  /** "Verder": the next lesson or exam on the path, or home when everything is done. */
  async function handleContinue(fromSession: boolean) {
    if (!data) return
    const progress = await reloadProgress()
    const next = overviewFor(data, progress).next
    if (next.kind === 'lesson') openSession({ mode: 'lesson', lessonId: next.lesson.id }, fromSession)
    else if (next.kind === 'exam') openSession({ mode: 'exam', unitId: next.unitId }, fromSession)
    else nav.home(HOME)
  }

  function handleSessionHome() {
    reloadProgress().then(() => nav.home(HOME)).catch(() => nav.home(HOME))
  }

  function handleTestSession() {
    if (!data) return
    const content = data.content
    const queue = buildTestQueue(exercises.map(e => e.id), data.allCardKeys, key => canBuild(content, key), data.ladderItems[0]?.itemId)
    openSession({ mode: 'test', queue })
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
  const autoplayAudio = settings.autoplayAudio === true
  const config = configFor(settings)
  const current = overviewFor(data, data.progress)
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
      const path = current.paths.get(view.unitId)
      if (!unit || !path) return null
      return (
        <UnitScreen
          unit={unit}
          content={data.content}
          path={path}
          passed={current.passed.has(unit.id)}
          bestScore={current.bestScore.get(unit.id)}
          passThreshold={appConfig.exam.passThreshold}
          grammarMap={data.grammarMap}
          onBack={() => nav.back(HOME)}
          onStartLesson={lessonId => openSession({ mode: 'lesson', lessonId })}
          onExam={unitId => openSession({ mode: 'exam', unitId })}
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
          onDrill={queue => openSession({ mode: 'drill', queue })}
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
      const { request } = view
      const mode: SessionMode = request.mode
      const lessonId = request.mode === 'lesson' ? request.lessonId : undefined
      const examUnit = request.mode === 'exam' ? data.units.find(u => u.id === request.unitId) : undefined
      const summarize = (progress: ProgressState): SessionSummary => {
        const o = overviewFor(data, progress)
        const lessonDone = lessonId === undefined
          ? undefined
          : [...o.paths.values()].flatMap(p => p.lessons).find(s => s.lesson.id === lessonId)?.done
        return { lessonDone, streak: o.streak }
      }
      return (
        <SessionScreen
          key={view.nonce}
          content={data.content}
          makeSession={() => buildSessionFor(data, request, data.progress)}
          initialProgress={data.progress}
          storage={storage}
          config={config}
          mode={mode}
          lessonId={lessonId}
          examUnit={examUnit}
          examUnlocksNext={examUnit !== undefined && data.units.some(u => u.requires.includes(examUnit.id))}
          autoplayAudio={autoplayAudio}
          summarize={summarize}
          onHome={handleSessionHome}
          onContinue={mode === 'test' || mode === 'drill' ? undefined : () => void handleContinue(true)}
          onRefreshMissed={keys => void reopenSession({ mode: 'refresh', onlyKeys: keys })}
          onRetryExam={unitId => void reopenSession({ mode: 'exam', unitId })}
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
          onTestSession={handleTestSession}
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
        overview={current}
        progress={data.progress}
        config={appConfig}
        flagCount={flagCount}
        leechCount={leechCount}
        onContinue={() => void handleContinue(false)}
        onRefresh={() => openSession({ mode: 'refresh' })}
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

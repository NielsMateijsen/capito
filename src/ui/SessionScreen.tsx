import { useCallback, useEffect, useRef, useState } from 'react'
import type { Content } from '../exercises/types.ts'
import type { ProgressState, ProgressStorage } from '../storage/types.ts'
import type { SessionItem } from '../engine/session-builder.ts'
import { buildSession, gradeFromResult, isLeech, lapseReinsertAt } from '../engine/session-builder.ts'
import { rebuildCards } from '../engine/review-log.ts'
import type { ReviewEntry } from '../engine/review-log.ts'
import type { Exercise, ReviewResult } from '../exercises/types.ts'
import { exerciseMap } from '../exercises/index.ts'
import { S } from './strings.nl.ts'
import ReportModal from './ReportModal.tsx'
import type { ReportEntry } from './ReportModal.tsx'

interface AppConfig {
  session: { maxReviewsPerSession: number; newCardsPerDay: number; minOldMaterialRatio: number; maxSameTypeInRow: number }
  backlog: { maxDueShownPerDay: number; pauseNewCardsAboveDue: number; returnAfterDays: number; returnMaxSessionReviews: number }
  lapse: { retypeCorrectAnswer: boolean; reinsertInSession: boolean; reinsertAfterCards: number }
  leech: { lapseThreshold: number; showExtraContext: boolean }
  grading: { correct: number; almost: number; hintUsed: number; wrong: number; flashcard: { again: number; good: number; easy: number } }
  srs: { startEase: number; minEase: number; maxIntervalDays: number }
  checker: { typoMinLength: number; typoMaxDistance: number }
}

interface Props {
  content: Content
  allCardKeys: string[]
  cardToUnit: Map<string, string>
  initialProgress: ProgressState
  storage: ProgressStorage
  config: AppConfig
  mode?: 'daily' | 'unit' | 'exam'
  overrideQueue?: SessionItem[]
  autoplayAudio?: boolean
  onDone: () => void
}

type Phase =
  | 'intro'
  | 'question'
  | 'flashcard-reveal'
  | 'feedback'
  | 'lapse-retype'
  | 'done'

function getAudioText(exercise: Exercise): string {
  if (exercise.typeId === 'flashcard' || exercise.typeId === 'translate-it-nl') {
    return exercise.prompt
  }
  return exercise.answers[0] ?? ''
}

function buildHint(answer: string): string {
  return answer.slice(0, 3) + '…'
}

function speak(text: string) {
  if (!window.speechSynthesis) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'it-IT'
  speechSynthesis.speak(u)
}

export default function SessionScreen({
  content, allCardKeys, cardToUnit, initialProgress, storage, config,
  mode = 'daily', overrideQueue, autoplayAudio = false,
  onDone,
}: Props) {
  const session = overrideQueue
    ? { queue: overrideQueue, isReturn: false, maxReviews: overrideQueue.length, newItemIds: [] }
    : buildSession({
        now: Date.now(),
        allCardKeys,
        cardToUnit,
        progress: initialProgress,
        config,
      })

  const [queue, setQueue] = useState<SessionItem[]>(() => [...session.queue])
  const [pos, setPos] = useState(0)
  const [phase, setPhase] = useState<Phase>(() =>
    session.queue.length === 0 ? 'done' :
    session.queue[0]?.kind === 'intro' ? 'intro' : 'question'
  )
  const [input, setInput] = useState('')
  const [hintUsed, setHintUsed] = useState(false)
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [progress, setProgress] = useState<ProgressState>(initialProgress)
  const [showReport, setShowReport] = useState(false)
  const [startTime, setStartTime] = useState(Date.now())
  const [exercise, setExercise] = useState<Exercise | null>(null)

  const sessionId = useRef(crypto.randomUUID())
  const inputRef = useRef<HTMLInputElement>(null)
  const primaryBtnRef = useRef<HTMLButtonElement>(null)

  const currentItem = queue[pos] as SessionItem | undefined

  // Build exercise when item changes
  useEffect(() => {
    if (!currentItem || currentItem.kind !== 'exercise') {
      setExercise(null)
      return
    }
    const typeId = currentItem.cardKey.split(':')[0]
    const mod = exerciseMap.get(typeId)
    if (!mod) { setExercise(null); return }
    try {
      setExercise(mod.build(currentItem.cardKey, content))
    } catch {
      setExercise(null)
    }
    setInput('')
    setHintUsed(false)
    setResult(null)
    setStartTime(Date.now())
  }, [pos, queue, content])

  // Focus management
  useEffect(() => {
    if (phase === 'question' && inputRef.current && exercise?.typeId !== 'flashcard') {
      inputRef.current.focus()
    } else if (phase === 'intro' || phase === 'flashcard-reveal' || phase === 'feedback' || phase === 'lapse-retype') {
      primaryBtnRef.current?.focus()
    }
  }, [phase, exercise?.typeId])

  // Autoplay audio on feedback
  useEffect(() => {
    if (phase === 'feedback' && autoplayAudio && exercise) {
      speak(getAudioText(exercise))
    }
  }, [phase, autoplayAudio, exercise])

  const advanceToNext = useCallback((nextQueue: SessionItem[], nextPos: number, nextAnsweredCount: number) => {
    if (nextPos >= nextQueue.length || nextAnsweredCount >= session.maxReviews) {
      setPos(nextPos)
      setPhase('done')
      return
    }
    const next = nextQueue[nextPos]
    setPos(nextPos)
    setPhase(next.kind === 'intro' ? 'intro' : 'question')
    setInput('')
    setHintUsed(false)
    setResult(null)
    setStartTime(Date.now())
  }, [session.maxReviews])

  async function saveEntry(entry: ReviewEntry, updatedProgress: ProgressState) {
    const newLog = [...updatedProgress.reviewLog, entry]
    const newCards = Object.fromEntries(rebuildCards(newLog, config.srs))
    const newProgress = { ...updatedProgress, reviewLog: newLog, cards: newCards }
    await storage.save(newProgress)
    setProgress(newProgress)
    return newProgress
  }

  async function handleIntroNext() {
    if (!currentItem || currentItem.kind !== 'intro') return
    const itemId = currentItem.itemId
    const newIntroduced = progress.introduced.includes(itemId)
      ? progress.introduced
      : [...progress.introduced, itemId]
    const updated = { ...progress, introduced: newIntroduced }
    await storage.save(updated)
    setProgress(updated)
    advanceToNext(queue, pos + 1, answeredCount)
  }

  async function handleSubmitAnswer() {
    if (!currentItem || currentItem.kind !== 'exercise' || !exercise) return
    const typeId = currentItem.cardKey.split(':')[0]
    const mod = exerciseMap.get(typeId)
    if (!mod) return

    const res = mod.check(input.trim(), exercise, config.checker)
    const grade = gradeFromResult(res, hintUsed, config.grading)
    const ms = Date.now() - startTime

    const entry: ReviewEntry = {
      t: new Date().toISOString(),
      key: currentItem.cardKey,
      result: res,
      grade,
      ms,
      hint: hintUsed,
      answer: res !== 'correct' ? input.slice(0, 100) : undefined,
      session: sessionId.current,
      mode,
      cv: 'dev',
    }

    const saved = await saveEntry(entry, progress)
    const newCount = answeredCount + 1
    setAnsweredCount(newCount)
    setResult(res)

    // Lapse reinsert
    let nextQueue = queue
    if (res === 'wrong' && config.lapse.reinsertInSession) {
      const at = Math.min(lapseReinsertAt(pos, config.lapse), queue.length)
      const extra: SessionItem = { kind: 'exercise', cardKey: currentItem.cardKey, isNew: false }
      nextQueue = [...queue.slice(0, at), extra, ...queue.slice(at)]
      setQueue(nextQueue)
    }

    void saved
    setPhase('feedback')
  }

  async function handleFlashcardGrade(grade: 'again' | 'good' | 'easy') {
    if (!currentItem || currentItem.kind !== 'exercise' || !exercise) return
    const mod = exerciseMap.get('flashcard')
    if (!mod) return

    const res = mod.check(grade, exercise, config.checker)
    const numGrade = gradeFromResult(res, false, config.grading)
    const ms = Date.now() - startTime

    const entry: ReviewEntry = {
      t: new Date().toISOString(),
      key: currentItem.cardKey,
      result: res,
      grade: numGrade,
      ms,
      hint: false,
      session: sessionId.current,
      mode,
      cv: 'dev',
    }

    const saved = await saveEntry(entry, progress)
    const newCount = answeredCount + 1
    setAnsweredCount(newCount)
    void saved
    advanceToNext(queue, pos + 1, newCount)
  }

  function handleFeedbackNext() {
    if (result === 'wrong' && config.lapse.retypeCorrectAnswer) {
      setPhase('lapse-retype')
      setInput('')
    } else {
      advanceToNext(queue, pos + 1, answeredCount)
    }
  }

  function handleLapseRetypeNext() {
    advanceToNext(queue, pos + 1, answeredCount)
  }

  function handleHint() {
    if (!exercise || hintUsed) return
    setHintUsed(true)
    setInput(buildHint(exercise.answers[0] ?? ''))
    inputRef.current?.focus()
  }

  function handleAudio() {
    if (!exercise) return
    speak(getAudioText(exercise))
  }

  function handleAudioIntro(itemId: string) {
    const word = content.words.get(itemId)
    const verb = content.verbs.get(itemId)
    const sentence = content.sentences.get(itemId)
    const text = word?.it ?? verb?.inf ?? sentence?.it ?? ''
    if (text) speak(text)
  }

  async function handleReport(entry: ReportEntry) {
    const newProgress = { ...progress, flags: [...progress.flags, entry as unknown as Record<string, unknown>] }
    await storage.save(newProgress)
    setProgress(newProgress)
  }

  function handleScreenKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    if (e.target instanceof HTMLTextAreaElement) return
    if (e.target instanceof HTMLSelectElement) return
    if (showReport) return

    if (phase === 'intro') {
      e.preventDefault()
      void handleIntroNext()
    } else if (phase === 'question' && exercise?.typeId !== 'flashcard') {
      e.preventDefault()
      void handleSubmitAnswer()
    } else if (phase === 'flashcard-reveal') {
      e.preventDefault()
      void handleFlashcardGrade('good')
    } else if (phase === 'feedback') {
      e.preventDefault()
      handleFeedbackNext()
    } else if (phase === 'lapse-retype') {
      e.preventDefault()
      handleLapseRetypeNext()
    }
  }

  function handleFlashcardKey(e: React.KeyboardEvent) {
    if (phase !== 'flashcard-reveal') return
    if (e.key === '1') { e.preventDefault(); void handleFlashcardGrade('again') }
    if (e.key === '2') { e.preventDefault(); void handleFlashcardGrade('good') }
    if (e.key === '3') { e.preventDefault(); void handleFlashcardGrade('easy') }
  }

  if (phase === 'done') {
    return (
      <div className="end-screen">
        <h2>{S.SESSION_DONE}</h2>
        <p>{S.REVIEWED(answeredCount)}</p>
        <button className="btn-primary" onClick={onDone}>{S.ANOTHER_ROUND}</button>
      </div>
    )
  }

  const cardState = currentItem?.kind === 'exercise' ? progress.cards[currentItem.cardKey] : undefined
  const isLeechy = cardState !== undefined && isLeech(cardState, config.leech) && config.leech.showExtraContext

  return (
    <div className="session" onKeyDown={handleScreenKeyDown} onKeyUp={handleFlashcardKey} tabIndex={-1}>
      {session.isReturn && <div className="welcome-back">{S.WELCOME_BACK}</div>}

      <div className="session-progress">
        {answeredCount} / {Math.min(queue.length, session.maxReviews)}
      </div>

      <div className="card">
        {/* ── INTRO ── */}
        {phase === 'intro' && currentItem?.kind === 'intro' && (() => {
          const { itemId } = currentItem
          const word = content.words.get(itemId)
          const verb = content.verbs.get(itemId)
          const sentence = content.sentences.get(itemId)
          const it = word?.it ?? verb?.inf ?? sentence?.it ?? itemId
          const nl = word?.nl[0] ?? verb?.nl[0] ?? sentence?.nl[0] ?? ''
          return (
            <>
              <div className="card-header">{S.INTRO_HEADER}</div>
              <div className="intro-italian">{it}</div>
              {nl && <div className="intro-nl">{nl}</div>}
              <div className="action-row">
                <button className="btn-primary" ref={primaryBtnRef} onClick={() => void handleIntroNext()}>
                  {S.INTRO_DONE}
                </button>
                <button className="btn-secondary" onClick={() => handleAudioIntro(itemId)}>
                  {S.AUDIO}
                </button>
              </div>
            </>
          )
        })()}

        {/* ── QUESTION (typed) ── */}
        {phase === 'question' && exercise && exercise.typeId !== 'flashcard' && (
          <>
            <div className="card-header">
              {isLeechy && <span className="leech-badge">{S.LEECH_BADGE}</span>}
            </div>
            <div className="card-prompt">{exercise.prompt}</div>
            {exercise.hint && <div className="card-hint-text">{exercise.hint}</div>}
            <input
              ref={inputRef}
              className="answer-input"
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <div className="action-row">
              <button className="btn-primary" ref={primaryBtnRef} onClick={() => void handleSubmitAnswer()}>
                {S.CHECK}
              </button>
              {mode !== 'exam' && (
                <button className="btn-secondary" onClick={handleHint} disabled={hintUsed}>
                  {S.HINT}
                </button>
              )}
              <button className="btn-secondary" onClick={handleAudio}>{S.AUDIO}</button>
              <button className="btn-secondary" onClick={() => setShowReport(true)}>{S.REPORT}</button>
            </div>
          </>
        )}

        {/* ── FLASHCARD question ── */}
        {phase === 'question' && exercise?.typeId === 'flashcard' && (
          <>
            <div className="card-header">
              {isLeechy && <span className="leech-badge">{S.LEECH_BADGE}</span>}
            </div>
            <div className="card-prompt">{exercise.prompt}</div>
            <div className="action-row">
              <button className="btn-primary" ref={primaryBtnRef} onClick={() => setPhase('flashcard-reveal')}>
                {S.FLASHCARD_REVEAL}
              </button>
              <button className="btn-secondary" onClick={handleAudio}>{S.AUDIO}</button>
              <button className="btn-secondary" onClick={() => setShowReport(true)}>{S.REPORT}</button>
            </div>
          </>
        )}

        {/* ── FLASHCARD reveal ── */}
        {phase === 'flashcard-reveal' && exercise?.typeId === 'flashcard' && (
          <>
            <div className="card-prompt">{exercise.prompt}</div>
            <div className="intro-nl">{exercise.answers.join(' / ')}</div>
            <div className="flashcard-grades">
              <button className="btn-again" onClick={() => void handleFlashcardGrade('again')}>
                1 {S.FLASHCARD_AGAIN}
              </button>
              <button className="btn-good" ref={primaryBtnRef} onClick={() => void handleFlashcardGrade('good')}>
                2 {S.FLASHCARD_GOOD}
              </button>
              <button className="btn-easy" onClick={() => void handleFlashcardGrade('easy')}>
                3 {S.FLASHCARD_EASY}
              </button>
            </div>
            <div className="action-row">
              <button className="btn-secondary" onClick={handleAudio}>{S.AUDIO}</button>
            </div>
          </>
        )}

        {/* ── FEEDBACK ── */}
        {phase === 'feedback' && exercise && result && (
          <>
            <input
              className={`answer-input ${result}`}
              type="text"
              value={input}
              readOnly
            />
            <div className="feedback">
              <div className={`feedback-label ${result}`}>
                {result === 'correct' ? S.CORRECT : result === 'almost' ? S.ALMOST : S.WRONG}
              </div>
              {(result === 'almost' || result === 'wrong') && (
                <div className="feedback-answer">
                  {S.CORRECT_ANSWER} <strong>{exercise.answers[0]}</strong>
                </div>
              )}
            </div>
            <div className="action-row">
              <button className="btn-primary" ref={primaryBtnRef} onClick={handleFeedbackNext}>
                {S.NEXT}
              </button>
              <button className="btn-secondary" onClick={handleAudio}>{S.AUDIO}</button>
              <button className="btn-secondary" onClick={() => setShowReport(true)}>{S.REPORT}</button>
            </div>
          </>
        )}

        {/* ── LAPSE RETYPE ── */}
        {phase === 'lapse-retype' && exercise && (
          <div className="lapse-retype">
            <label>{S.LAPSE_RETYPE}</label>
            <div className="feedback-answer"><strong>{exercise.answers[0]}</strong></div>
            <input
              ref={inputRef}
              className="answer-input"
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <div className="action-row">
              <button className="btn-primary" ref={primaryBtnRef} onClick={handleLapseRetypeNext}>
                {S.LAPSE_CONFIRM}
              </button>
            </div>
          </div>
        )}
      </div>

      {showReport && exercise && (
        <ReportModal
          itemId={exercise.cardKey.split(':')[1] ?? exercise.cardKey}
          userAnswer={input}
          onSubmit={(entry) => void handleReport(entry)}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  )
}

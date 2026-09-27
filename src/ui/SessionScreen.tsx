import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Content } from '../exercises/types.ts'
import type { ProgressState, ProgressStorage } from '../storage/types.ts'
import type { Session, SessionBuilderConfig, SessionItem } from '../engine/session-builder.ts'
import { gradeFromResult, isLeech, itemIdFromKey, replanAfterWrong } from '../engine/session-builder.ts'
import { rebuildCards } from '../engine/review-log.ts'
import type { ReviewEntry } from '../engine/review-log.ts'
import type { ExamConfig } from '../engine/exam.ts'
import type { Streak } from '../engine/streak.ts'
import type { Unit } from '../content/schemas.ts'
import type { SrsConfig } from '../engine/srs.ts'
import type { CheckerConfig } from '../engine/checker.ts'
import { introSentence } from '../engine/sentences.ts'
import { withArticle } from '../engine/plurals.ts'
import type { Exercise, ReviewResult } from '../exercises/types.ts'
import { exerciseMap } from '../exercises/index.ts'
import { isRetypeCorrect } from '../exercises/choice.ts'
import { S } from './strings.nl.ts'
import { playAudio } from './speak.ts'
import ReportModal from './ReportModal.tsx'
import type { ReportEntry } from './ReportModal.tsx'
import SentenceText from './SentenceText.tsx'
import SessionEndScreen from './SessionEndScreen.tsx'

type AppConfig = SessionBuilderConfig & { srs: SrsConfig; checker: CheckerConfig; exam: ExamConfig }

/** 'test' tries out exercise types without saving answers or introductions. */
export type SessionMode = 'lesson' | 'refresh' | 'exam' | 'drill' | 'test'

/** What the end screen shows about the learner's progress after the session. */
export interface SessionSummary {
  /** Only for a lesson: is the lesson done now? */
  lessonDone?: boolean
  streak: Streak
}

interface Props {
  content: Content
  /** Called once, when the screen opens. */
  makeSession: () => Session
  initialProgress: ProgressState
  storage: ProgressStorage
  config: AppConfig
  mode: SessionMode
  lessonId?: string
  examUnit?: Unit
  /** Passing the exam opens another unit. */
  examUnlocksNext?: boolean
  autoplayAudio?: boolean
  summarize?: (progress: ProgressState) => SessionSummary
  onHome: () => void
  /** "Verder" on the end screen: the next step on the path. */
  onContinue?: () => void
  onRefreshMissed?: (cardKeys: string[]) => void
  onRetryExam?: (unitId: string) => void
}

type Phase =
  | 'intro'
  | 'question'
  | 'flashcard-reveal'
  | 'feedback'
  | 'lapse-retype'
  | 'done'

function getAudioText(exercise: Exercise): string {
  if (exercise.audio) return exercise.audio
  if (exercise.typeId === 'flashcard' || exercise.typeId === 'translate-it-nl') {
    return exercise.prompt
  }
  return exercise.answers[0] ?? ''
}

function buildHint(answer: string): string {
  return answer.slice(0, 3) + '…'
}

function questionLabel(typeId: string): string | undefined {
  if (typeId === 'mc-sentence') return S.MC_SENTENCE_QUESTION
  if (typeId === 'mc-word') return S.MC_WORD_QUESTION
  if (typeId === 'cloze-word') return S.CLOZE_WORD_QUESTION
  if (typeId === 'dictation') return S.DICTATION_QUESTION
  return undefined
}

export default function SessionScreen({
  content, makeSession, initialProgress, storage, config,
  mode, lessonId, examUnit, examUnlocksNext, autoplayAudio = false, summarize,
  onHome, onContinue, onRefreshMissed, onRetryExam,
}: Props) {
  const sessionRef = useRef<Session | null>(null)
  if (sessionRef.current === null) sessionRef.current = makeSession()
  const session = sessionRef.current
  const examSize = session.queue.filter(i => i.kind === 'exercise').length

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
  const [retypeWrong, setRetypeWrong] = useState(false)
  const submittingRef = useRef(false)

  const sessionId = useRef(crypto.randomUUID())
  const inputRef = useRef<HTMLInputElement>(null)
  const primaryBtnRef = useRef<HTMLButtonElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)

  const currentItem = queue[pos] as SessionItem | undefined
  const currentKey = currentItem?.kind === 'exercise' ? currentItem.cardKey : null

  // Built during render so a key press never hits the previous card. Deliberately not rebuilt
  // when progress changes: the sentence must stay the same while the answer is shown.
  const exercise = useMemo<Exercise | null>(() => {
    if (!currentKey) return null
    const mod = exerciseMap.get(currentKey.split(':')[0])
    if (!mod) return null
    const itemId = itemIdFromKey(currentKey)
    const seq = progress.reviewLog.filter(e => itemIdFromKey(e.key) === itemId).length
    try {
      return mod.build(currentKey, content, { seq, optionCount: config.ladder.optionCount })
    } catch {
      return null
    }
  }, [pos, currentKey, content])
  const isChoice = !!exercise?.options

  // A card that cannot be built (e.g. content changed) is skipped instead of blocking the session
  useEffect(() => {
    if (phase === 'question' && currentKey && !exercise) advanceToNext(queue, pos + 1, answeredCount)
  }, [phase, currentKey, exercise])

  // Focus management
  useEffect(() => {
    if (phase === 'question' && inputRef.current && exercise?.typeId !== 'flashcard' && !isChoice) {
      inputRef.current.focus()
    } else if (phase === 'question' && isChoice) {
      screenRef.current?.focus()
    } else if (phase === 'lapse-retype') {
      inputRef.current?.focus()
    } else if (
      phase === 'intro' ||
      phase === 'question' ||
      phase === 'flashcard-reveal' ||
      phase === 'feedback'
    ) {
      primaryBtnRef.current?.focus()
    }
  }, [phase, exercise?.typeId, isChoice])

  // Autoplay audio on feedback
  useEffect(() => {
    if (phase === 'feedback' && autoplayAudio && exercise) {
      void playAudio(getAudioText(exercise))
    }
  }, [phase, autoplayAudio, exercise])

  const introItemId = phase === 'intro' && currentItem?.kind === 'intro' ? currentItem.itemId : null

  // Autoplay audio on intro
  useEffect(() => {
    if (introItemId && config.ladder.introAutoplay) handleAudioIntro(introItemId)
  }, [introItemId])

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

  /**
   * Every save starts from what is stored now, not from this screen's copy: a copy from before
   * the previous session would otherwise overwrite its answers (the log is append-only).
   */
  async function persist(change: (latest: ProgressState) => ProgressState): Promise<ProgressState> {
    const next = change(await storage.load())
    await storage.save(next)
    setProgress(next)
    return next
  }

  async function saveEntry(entry: ReviewEntry) {
    return persist(latest => {
      const reviewLog = [...latest.reviewLog, entry]
      return { ...latest, reviewLog, cards: Object.fromEntries(rebuildCards(reviewLog, config.srs)) }
    })
  }

  async function handleIntroNext() {
    if (!currentItem || currentItem.kind !== 'intro') return
    if (mode === 'test') {
      advanceToNext(queue, pos + 1, answeredCount)
      return
    }
    const itemId = currentItem.itemId
    await persist(latest => latest.introduced.includes(itemId) ? latest : { ...latest, introduced: [...latest.introduced, itemId] })
    advanceToNext(queue, pos + 1, answeredCount)
  }

  async function handleSubmitAnswer(answer: string = input) {
    if (!currentItem || currentItem.kind !== 'exercise' || !exercise || submittingRef.current) return
    const typeId = currentItem.cardKey.split(':')[0]
    const mod = exerciseMap.get(typeId)
    if (!mod) return
    submittingRef.current = true
    try {
      await submitAnswer(answer, currentItem.cardKey, mod.check(answer.trim(), exercise, config.checker))
    } finally {
      submittingRef.current = false
    }
  }

  /** Where the answer was given, as stored in the log. Never called in a test session. */
  function entryContext(): Pick<ReviewEntry, 'mode' | 'lesson' | 'unit' | 'examSize'> {
    if (mode === 'lesson') return { mode, lesson: lessonId }
    if (mode === 'exam') return { mode, unit: examUnit?.id, examSize }
    return { mode: mode === 'test' ? 'drill' : mode }
  }

  async function submitAnswer(answer: string, cardKey: string, res: ReviewResult) {
    if (mode !== 'test') {
      const entry: ReviewEntry = {
        t: new Date().toISOString(),
        key: cardKey,
        result: res,
        grade: gradeFromResult(res, hintUsed, config.grading),
        ms: Date.now() - startTime,
        hint: hintUsed,
        answer: res !== 'correct' ? answer.slice(0, 100) : undefined,
        session: sessionId.current,
        ...entryContext(),
        cv: 'dev',
      }
      await saveEntry(entry)
    }
    setAnsweredCount(answeredCount + 1)
    setResult(res)

    // A test session shows every card once: reinserted cards would push the last types past maxReviews.
    // An exam asks every question once, so its score is the first answer.
    if (res === 'wrong' && mode !== 'test' && mode !== 'exam') {
      setQueue(replanAfterWrong(queue, pos, cardKey, session.ladderStages, config))
    }
    setPhase('feedback')
  }

  function handleChoose(option: string) {
    if (phase !== 'question' || !isChoice) return
    setInput(option)
    void handleSubmitAnswer(option)
  }

  async function handleFlashcardGrade(grade: 'again' | 'good' | 'easy') {
    if (!currentItem || currentItem.kind !== 'exercise' || !exercise || submittingRef.current) return
    const mod = exerciseMap.get('flashcard')
    if (!mod) return
    submittingRef.current = true
    try {
      await gradeFlashcard(currentItem.cardKey, mod.check(grade, exercise, config.checker))
    } finally {
      submittingRef.current = false
    }
  }

  async function gradeFlashcard(cardKey: string, res: ReviewResult) {
    if (mode !== 'test') {
      const entry: ReviewEntry = {
        t: new Date().toISOString(),
        key: cardKey,
        result: res,
        grade: gradeFromResult(res, false, config.grading),
        ms: Date.now() - startTime,
        hint: false,
        session: sessionId.current,
        ...entryContext(),
        cv: 'dev',
      }
      await saveEntry(entry)
    }
    const newCount = answeredCount + 1
    setAnsweredCount(newCount)
    advanceToNext(queue, pos + 1, newCount)
  }

  function handleFeedbackNext() {
    if (result === 'wrong' && config.lapse.retypeCorrectAnswer && !isChoice) {
      setPhase('lapse-retype')
      setInput('')
    } else {
      advanceToNext(queue, pos + 1, answeredCount)
    }
  }

  function handleLapseRetypeNext() {
    const mod = exercise && exerciseMap.get(exercise.typeId)
    if (mod && exercise && !isRetypeCorrect(mod, input, exercise, config.checker)) {
      setRetypeWrong(true)
      inputRef.current?.focus()
      return
    }
    setRetypeWrong(false)
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
    void playAudio(getAudioText(exercise))
  }

  function handleAudioIntro(itemId: string) {
    const match = introSentence(itemId, content)
    const word = content.words.get(itemId)
    const verb = content.verbs.get(itemId)
    const text = match ? (match.sentence.audioText ?? match.sentence.it) : (word?.it ?? verb?.inf ?? '')
    if (text) void playAudio(text)
  }

  async function handleReport(entry: ReportEntry) {
    await persist(latest => ({ ...latest, flags: [...latest.flags, entry as unknown as Record<string, unknown>] }))
  }

  function handleScreenKeyDown(e: React.KeyboardEvent) {
    if (e.target instanceof HTMLTextAreaElement) return
    if (e.target instanceof HTMLSelectElement) return
    if (showReport) return

    if (phase === 'question' && isChoice && /^[1-9]$/.test(e.key)) {
      const option = exercise?.options?.[Number(e.key) - 1]
      if (option !== undefined) {
        e.preventDefault()
        handleChoose(option)
      }
      return
    }

    if (e.key !== 'Enter') return
    if (phase === 'intro') {
      e.preventDefault()
      void handleIntroNext()
    } else if (phase === 'question' && isChoice) {
      return
    } else if (phase === 'question' && exercise?.typeId !== 'flashcard') {
      e.preventDefault()
      void handleSubmitAnswer()
    } else if (phase === 'question' && exercise?.typeId === 'flashcard') {
      e.preventDefault()
      setPhase('flashcard-reveal')
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

  async function handleSaveCanDo(unitId: string, answers: boolean[]) {
    await persist(latest => ({
      ...latest,
      unitMeta: { ...latest.unitMeta, [unitId]: { ...latest.unitMeta[unitId], canDo: answers } },
    }))
  }

  if (phase === 'done') {
    return (
      <SessionEndScreen
        mode={mode}
        answeredCount={answeredCount}
        entries={progress.reviewLog.filter(e => e.session === sessionId.current)}
        content={content}
        progress={progress}
        config={config}
        examUnit={examUnit}
        unlocksNext={examUnlocksNext}
        summary={summarize && mode !== 'test' ? summarize(progress) : undefined}
        onHome={onHome}
        onContinue={onContinue}
        onRefreshMissed={onRefreshMissed}
        onRetryExam={onRetryExam}
        onSaveCanDo={handleSaveCanDo}
      />
    )
  }

  const cardState = currentItem?.kind === 'exercise' ? progress.cards[currentItem.cardKey] : undefined
  const isLeechy = cardState !== undefined && isLeech(cardState, config.leech) && config.leech.showExtraContext
  const sentence = exercise?.sentence
  const label = exercise ? questionLabel(exercise.typeId) : undefined

  function renderPrompt(ex: Exercise) {
    if (ex.sentence?.mode === 'gap') {
      return (
        <>
          <div className="sentence-nl">{ex.sentence.nl}</div>
          <SentenceText className="card-prompt" text={ex.sentence.it} span={ex.sentence.span} mode="gap" />
        </>
      )
    }
    if (ex.sentence?.mode === 'highlight') {
      return <SentenceText className="card-prompt" text={ex.sentence.it} span={ex.sentence.span} mode="highlight" />
    }
    return <div className="card-prompt">{ex.prompt}</div>
  }

  function renderOptions(ex: Exercise, answered: boolean) {
    const itOptions = ex.typeId !== 'mc-sentence'
    return (
      <div className="choice-list">
        {ex.options!.map((option, i) => {
          const isAnswer = ex.answers.includes(option)
          const isPicked = option === input
          const state = !answered ? '' : isAnswer ? 'correct' : isPicked ? 'wrong' : 'dim'
          return (
            <button
              key={option}
              className={`choice ${state}`}
              disabled={answered}
              lang={itOptions ? 'it' : undefined}
              onClick={() => handleChoose(option)}
            >
              <span className="choice-key">{i + 1}</span>
              <span>{option}</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    // data-* attributes let the e2e session driver follow the flow (see e2e/README.md)
    <div
      className="session"
      ref={screenRef}
      onKeyDown={handleScreenKeyDown}
      onKeyUp={handleFlashcardKey}
      tabIndex={-1}
      data-testid="session"
      data-phase={phase}
      data-pos={pos}
      data-mode={mode}
      data-card-key={currentKey ?? undefined}
      data-exercise-type={exercise?.typeId}
    >
      <div className="session-progress">
        {answeredCount} / {Math.min(queue.length - queue.filter(i => i.kind === 'intro').length, session.maxReviews)}
      </div>

      <div className="card">
        {/* ── INTRO ── */}
        {phase === 'intro' && currentItem?.kind === 'intro' && (() => {
          const { itemId } = currentItem
          const word = content.words.get(itemId)
          const verb = content.verbs.get(itemId)
          const match = introSentence(itemId, content)
          const itemIt = word ? withArticle(word) : (verb?.inf ?? itemId)
          const itemNl = (word?.nl ?? verb?.nl ?? []).join(', ')
          const register = word?.register === 'formal' ? S.REGISTER_FORMAL : word?.register === 'informal' ? S.REGISTER_INFORMAL : null
          return (
            <>
              <div className="card-header">{S.INTRO_HEADER}</div>
              {match && (
                <div className="intro-sentence">
                  <SentenceText className="intro-sentence-it" text={match.sentence.it} span={match.span} mode="highlight" />
                  <div className="intro-sentence-nl">{match.sentence.nl[0]}</div>
                </div>
              )}
              <div className="intro-item">
                <div className="intro-italian" lang="it">{itemIt}</div>
                {itemNl && <div className="intro-nl">{itemNl}</div>}
                {register && <span className={`register-badge ${word?.register}`}>{register}</span>}
                {word?.note && <div className="card-hint-text">{word.note}</div>}
              </div>
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

        {/* ── QUESTION (multiple choice) ── */}
        {phase === 'question' && exercise && isChoice && (
          <>
            <div className="card-header">
              {label}
              {isLeechy && <span className="leech-badge">{S.LEECH_BADGE}</span>}
            </div>
            {renderPrompt(exercise)}
            {renderOptions(exercise, false)}
            <div className="action-row">
              {sentence?.mode !== 'gap' && <button className="btn-secondary" onClick={handleAudio}>{S.AUDIO}</button>}
              <button className="btn-secondary" onClick={() => setShowReport(true)}>{S.REPORT}</button>
            </div>
          </>
        )}

        {/* ── QUESTION (typed) ── */}
        {phase === 'question' && exercise && !isChoice && exercise.typeId !== 'flashcard' && (
          <>
            <div className="card-header">
              {label}
              {isLeechy && <span className="leech-badge">{S.LEECH_BADGE}</span>}
            </div>
            {renderPrompt(exercise)}
            {exercise.withArticle && <div className="card-hint-text">{S.WITH_ARTICLE}</div>}
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
              {sentence?.mode !== 'gap' && <button className="btn-secondary" onClick={handleAudio}>{S.AUDIO}</button>}
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
            {sentence && (
              <>
                {sentence.mode === 'gap' && <div className="sentence-nl">{sentence.nl}</div>}
                <SentenceText className="card-prompt" text={sentence.it} span={sentence.span} mode="highlight" />
              </>
            )}
            {isChoice ? renderOptions(exercise, true) : (
              <input
                className={`answer-input ${result}`}
                type="text"
                value={input}
                readOnly
              />
            )}
            <div className="feedback">
              <div className={`feedback-label ${result}`}>
                {result === 'correct' ? S.CORRECT : result === 'almost' ? S.ALMOST : S.WRONG}
              </div>
              {!isChoice && (result === 'almost' || result === 'wrong') && (
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
              className={`answer-input ${retypeWrong ? 'wrong' : ''}`}
              type="text"
              value={input}
              onChange={e => { setInput(e.target.value); setRetypeWrong(false) }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            {retypeWrong && <div className="feedback-label wrong">{S.LAPSE_MISMATCH}</div>}
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

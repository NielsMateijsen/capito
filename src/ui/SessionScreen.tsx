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
import { useKeyboardInset } from './keyboard-inset.ts'
import { exerciseUi } from './exercise-ui.ts'
import {
  ICON, ICON_LINE, IconAlmost, IconAudio, IconCheck, IconClose, IconCorrect, IconHint, IconNext, IconReport, IconWrong,
} from './icons.ts'

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

const RESULT_CLASS: Record<ReviewResult, 'ok' | 'almost' | 'wrong'> = {
  correct: 'ok', good: 'ok', easy: 'ok', almost: 'almost', wrong: 'wrong', again: 'wrong',
}

const RESULT_TEXT = { ok: S.CORRECT, almost: S.ALMOST, wrong: S.WRONG }

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
  const [lastAnswer, setLastAnswer] = useState('')
  const submittingRef = useRef(false)
  const keyboardInsetPx = useKeyboardInset()

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

  // Focus management: keys (Enter, 1-4) are handled on the session, so the focus must stay inside it
  function focusForPhase() {
    if (phase === 'question' && inputRef.current && exercise?.typeId !== 'flashcard' && !isChoice) {
      inputRef.current.focus()
    } else if (phase === 'question' && isChoice) {
      screenRef.current?.focus()
    } else if (phase === 'lapse-retype') {
      inputRef.current?.focus()
    } else if (primaryBtnRef.current) {
      primaryBtnRef.current.focus()
    } else {
      screenRef.current?.focus()
    }
  }

  useEffect(focusForPhase, [phase, exercise?.typeId, isChoice])

  // Back from the report sheet: the keys work again right away
  useEffect(() => {
    if (!showReport) focusForPhase()
  }, [showReport])

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
    setLastAnswer(answer)
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
      if (input.trim() !== '') void handleSubmitAnswer()
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
    if (phase !== 'flashcard-reveal' || showReport) return
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
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
  const ui = exercise ? exerciseUi(exercise.typeId) : undefined
  const label = ui?.label
  const totalQuestions = Math.min(queue.length - queue.filter(i => i.kind === 'intro').length, session.maxReviews)
  const progressPct = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0
  const answered = phase === 'feedback' || phase === 'lapse-retype'
  const typed = !!exercise && !isChoice && exercise.typeId !== 'flashcard'
  const promptLang = ui?.italianPrompt ? 'it' : undefined
  const answerLang = ui?.dutchAnswer ? undefined : 'it'
  const canHint = mode !== 'exam' && typed && !ui?.noHint
  // Audio next to the prompt only where it cannot give the answer away (before answering)
  const promptAudio = !!exercise && exercise.typeId !== 'dictation' && (
    !!ui?.promptAudio || exercise.sentence?.mode === 'highlight' || (answered && !!exercise.sentence)
  )

  function renderPrompt(ex: Exercise, showAnswer: boolean) {
    if (ex.sentence) {
      const textMode = ex.sentence.mode === 'gap' && !showAnswer ? 'gap' : 'highlight'
      return (
        <>
          {ex.sentence.mode === 'gap' && <p className="q-nl">{ex.sentence.nl}</p>}
          <div className="q-row">
            <SentenceText className="q-sentence" text={ex.sentence.it} span={ex.sentence.span} mode={textMode} spaceAfterGap={ex.sentence.spaceAfterGap} />
            {promptAudio && audioButton()}
          </div>
        </>
      )
    }
    if (ex.typeId === 'dictation') {
      return (
        <button className="play-btn" onClick={handleAudio} aria-label={S.PLAY}>
          <IconAudio {...ICON} />
        </button>
      )
    }
    return (
      <div className="q-row">
        <div className="q-prompt" lang={promptLang}>{ex.prompt}</div>
        {promptAudio && audioButton()}
      </div>
    )
  }

  function audioButton() {
    return (
      <button className="icon-btn" onClick={handleAudio} aria-label={S.SPEAK}>
        <IconAudio {...ICON} />
      </button>
    )
  }

  function reportButton() {
    return (
      <button className="icon-btn" onClick={() => setShowReport(true)} aria-label={S.REPORT}>
        <IconReport {...ICON} />
      </button>
    )
  }

  function optionState(ex: Exercise, option: string): 'ok' | 'answer' | 'wrong' | 'dim' | undefined {
    if (!answered) return undefined
    const isAnswer = ex.answers.includes(option)
    const isPicked = option === input
    if (isAnswer) return isPicked ? 'ok' : 'answer'
    return isPicked ? 'wrong' : 'dim'
  }

  function renderOptions(ex: Exercise) {
    const itOptions = ex.typeId !== 'mc-sentence'
    return (
      <div className="options" role="group" aria-label={label}>
        {ex.options!.map((option, i) => {
          const state = optionState(ex, option)
          return (
            <button
              key={option}
              className="option"
              data-option={i + 1}
              data-state={state}
              disabled={answered}
              onClick={() => handleChoose(option)}
            >
              <span className="option-key" aria-hidden="true">{i + 1}</span>
              <span className="option-label" data-option-label lang={itOptions ? 'it' : undefined}>{option}</span>
              {(state === 'ok' || state === 'answer') && <IconCorrect {...ICON} />}
              {state === 'wrong' && <IconWrong {...ICON} />}
            </button>
          )
        })}
      </div>
    )
  }

  function renderAnswerField() {
    const state = answered && result ? RESULT_CLASS[result] : undefined
    const StateIcon = state === 'ok' ? IconCorrect : state === 'almost' ? IconAlmost : state === 'wrong' ? IconWrong : null
    return (
      <div className="answer-field">
        <input
          ref={answered ? undefined : inputRef}
          className={`answer-input${state ? ` answer-input--${state}` : ''}`}
          type="text"
          aria-label={S.ANSWER_LABEL}
          value={phase === 'lapse-retype' ? lastAnswer : input}
          readOnly={answered}
          onChange={e => setInput(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          lang={answerLang}
        />
        {StateIcon && <StateIcon {...ICON} className={`answer-state answer-state--${state}`} />}
      </div>
    )
  }

  function renderFeedback(ex: Exercise, res: ReviewResult) {
    const kind = RESULT_CLASS[res]
    const HeadIcon = kind === 'ok' ? IconCorrect : kind === 'almost' ? IconAlmost : IconWrong
    const showAnswer = !isChoice && (kind === 'almost' || kind === 'wrong')
    return (
      <div className={`feedback feedback--${kind}`}>
        <div className="feedback-head">
          <HeadIcon {...ICON} />
          {kind === 'ok' ? S.CORRECT : kind === 'almost' ? S.ALMOST : S.WRONG}
        </div>
        {showAnswer && (
          <p className="feedback-text">
            {S.CORRECT_ANSWER} <b data-correct-answer lang={answerLang}>{ex.answers[0]}</b>
          </p>
        )}
        {phase === 'lapse-retype' ? (
          <div className="feedback-retype">
            <label className="feedback-label" htmlFor="retype-input">{S.LAPSE_RETYPE}</label>
            <input
              id="retype-input"
              ref={inputRef}
              className={`answer-input${retypeWrong ? ' answer-input--wrong' : ''}`}
              type="text"
              value={input}
              onChange={e => { setInput(e.target.value); setRetypeWrong(false) }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              lang={answerLang}
            />
            {retypeWrong && <p className="feedback-text">{S.LAPSE_MISMATCH}</p>}
            <button className={`btn btn--block btn--${kind}`} ref={primaryBtnRef} onClick={handleLapseRetypeNext}>
              {S.LAPSE_CONFIRM}
            </button>
          </div>
        ) : (
          <button className={`btn btn--block btn--${kind}`} ref={primaryBtnRef} onClick={handleFeedbackNext}>
            {S.NEXT}<IconNext {...ICON_LINE} />
          </button>
        )}
      </div>
    )
  }

  function renderIntro(itemId: string) {
    const word = content.words.get(itemId)
    const verb = content.verbs.get(itemId)
    const match = introSentence(itemId, content)
    const itemIt = word ? withArticle(word) : (verb?.inf ?? itemId)
    const itemNl = (word?.nl ?? verb?.nl ?? []).join(', ')
    const register = word?.register === 'formal' ? S.REGISTER_FORMAL : word?.register === 'informal' ? S.REGISTER_INFORMAL : null
    return (
      <>
        <p className="q-label">{S.INTRO_HEADER}</p>
        {match && (
          <>
            <SentenceText className="q-sentence" text={match.sentence.it} span={match.span} mode="highlight" />
            <p className="q-nl">{match.sentence.nl[0]}</p>
          </>
        )}
        <div className="intro-card">
          <div className="q-row intro-card-top">
            <div className="intro-word" lang="it">{itemIt}</div>
            <button className="icon-btn" onClick={() => handleAudioIntro(itemId)} aria-label={S.SPEAK}>
              <IconAudio {...ICON} />
            </button>
          </div>
          {itemNl && <div className="intro-nl">{itemNl}</div>}
          {register && <span className="pill pill--soft">{register}</span>}
          {word?.note && <p className="q-note">{word.note}</p>}
        </div>
      </>
    )
  }

  let body: React.ReactNode = null
  let foot: React.ReactNode = null

  if (phase === 'intro' && currentItem?.kind === 'intro') {
    body = renderIntro(currentItem.itemId)
    foot = (
      <button className="btn btn--primary btn--block" ref={primaryBtnRef} onClick={() => void handleIntroNext()}>
        {S.INTRO_DONE}<IconNext {...ICON_LINE} />
      </button>
    )
  } else if (exercise) {
    body = (
      <>
        <div className="q-head">
          <p className="q-label">{exercise.typeId === 'flashcard' ? S.FLASHCARD_QUESTION : label}</p>
          {isLeechy && <span className="pill pill--wrong">{S.LEECH_BADGE}</span>}
        </div>
        {renderPrompt(exercise, answered)}
        {exercise.withArticle && <span className="pill pill--primary">{S.WITH_ARTICLE}</span>}
        {exercise.hint && <span className="pill pill--primary" lang="it">{exercise.hint}</span>}
        {phase === 'flashcard-reveal' && <p className="reveal">{exercise.answers.join(' / ')}</p>}
        {isChoice && renderOptions(exercise)}
        {typed && renderAnswerField()}
        <div className="q-tools">
          {canHint && !answered && (
            <button className="icon-btn" onClick={handleHint} disabled={hintUsed} aria-label={S.HINT}>
              <IconHint {...ICON} />
            </button>
          )}
          {answered && !promptAudio && exercise.typeId !== 'dictation' && audioButton()}
          {reportButton()}
          {hintUsed && !answered && <span className="q-note">{S.HINT_USED}</span>}
          {isChoice && !answered && <span className="q-note">{S.CHOICE_KEYS(exercise.options!.length)}</span>}
        </div>
      </>
    )
    if (answered && result) {
      foot = renderFeedback(exercise, result)
    } else if (phase === 'flashcard-reveal') {
      foot = (
        <div className="grades">
          <button className="grade grade--again" onClick={() => void handleFlashcardGrade('again')}>
            <span className="grade-key" aria-hidden="true">1</span>{S.FLASHCARD_AGAIN}
          </button>
          <button className="grade grade--good" ref={primaryBtnRef} onClick={() => void handleFlashcardGrade('good')}>
            <span className="grade-key" aria-hidden="true">2</span>{S.FLASHCARD_GOOD}
          </button>
          <button className="grade grade--easy" onClick={() => void handleFlashcardGrade('easy')}>
            <span className="grade-key" aria-hidden="true">3</span>{S.FLASHCARD_EASY}
          </button>
        </div>
      )
    } else if (exercise.typeId === 'flashcard') {
      foot = (
        <button className="btn btn--primary btn--block" ref={primaryBtnRef} onClick={() => setPhase('flashcard-reveal')}>
          {S.FLASHCARD_REVEAL}
        </button>
      )
    } else if (typed) {
      // An empty answer is not sent by accident (Enter does nothing); "Weet ik niet" sends it on purpose
      foot = (
        <div className="foot-actions">
          <button
            className="btn btn--primary btn--block"
            ref={primaryBtnRef}
            disabled={input.trim() === ''}
            onClick={() => void handleSubmitAnswer()}
          >
            <IconCheck {...ICON_LINE} />{S.CHECK}
          </button>
          <button className="btn btn--text" onClick={() => void handleSubmitAnswer('')}>{S.DONT_KNOW}</button>
        </div>
      )
    }
  }

  return (
    // data-* attributes let the e2e session driver follow the flow (see e2e/README.md)
    <div
      className="session"
      ref={screenRef}
      onKeyDown={handleScreenKeyDown}
      onKeyUp={handleFlashcardKey}
      tabIndex={-1}
      style={{ '--keyboard-inset': `${keyboardInsetPx}px` } as React.CSSProperties}
      data-testid="session"
      data-phase={phase}
      data-pos={pos}
      data-mode={mode}
      data-card-key={currentKey ?? undefined}
      data-exercise-type={exercise?.typeId}
      data-result={answered && result ? result : undefined}
    >
      <div className="session-top">
        <button className="icon-btn icon-btn--plain" onClick={onHome} aria-label={S.STOP}>
          <IconClose {...ICON_LINE} />
        </button>
        <div
          className="progress"
          role="progressbar"
          aria-label={S.PROGRESS_LABEL(answeredCount, totalQuestions)}
          aria-valuemin={0}
          aria-valuemax={totalQuestions}
          aria-valuenow={answeredCount}
        >
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="session-body">{body}</div>

      {foot && <div className={`session-foot${answered ? ' session-foot--feedback' : ''}`}>{foot}</div>}

      {/* Read out every result, also when the feedback bar replaces the buttons */}
      <p className="visually-hidden" role="status" aria-live="polite">
        {answered && result ? RESULT_TEXT[RESULT_CLASS[result]] : ''}
      </p>

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

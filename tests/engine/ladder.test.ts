import { describe, it, expect } from 'vitest'
import { computeLadder, isFail, isGraduated, ladderItems } from '../../src/engine/ladder.ts'
import type { ReviewEntry } from '../../src/engine/review-log.ts'

const NOW = 1_700_000_000_000
const DAY = 86_400_000
const STAGES = ['mc-sentence', 'mc-word', 'cloze-word', 'translate-nl-it']
const CONFIG = { dropOnWrong: 1, passResults: ['correct', 'good', 'easy'] }
const EXAM = { passThreshold: 0.8, passResults: ['correct', 'almost'] }

function entry(
  key: string,
  t: number,
  result: ReviewEntry['result'] = 'correct',
  mode: ReviewEntry['mode'] = 'lesson',
  extra: Partial<ReviewEntry> = {},
): ReviewEntry {
  return { t: new Date(t).toISOString(), key, result, grade: 4, ms: 1, hint: false, session: 's', mode, cv: 'x', ...extra }
}

function examEntry(key: string, t: number, result: ReviewEntry['result'], session: string, examSize: number): ReviewEntry {
  return entry(key, t, result, 'exam', { session, unit: 'u01', examSize })
}

const item = { itemId: 'w_a', stageKeys: STAGES.map(s => `${s}:w_a`) }

describe('ladderItems()', () => {
  it('keeps only stages that exist as cards, in stage order', () => {
    const items = ladderItems(['v_a', 'w_a'], STAGES, ['cloze-word:v_a', 'mc-sentence:v_a', ...item.stageKeys])
    expect(items).toEqual([
      { itemId: 'v_a', stageKeys: ['mc-sentence:v_a', 'cloze-word:v_a'] },
      item,
    ])
  })

  it('drops items without any stage card', () => {
    expect(ladderItems(['w_x'], STAGES, [])).toEqual([])
  })
})

describe('computeLadder()', () => {
  it('starts every item at level 0, not started', () => {
    const state = computeLadder([], [item], CONFIG).get('w_a')!
    expect(state).toMatchObject({ level: 0, maxLevel: 0, started: false, graduated: false, testedOut: false })
  })

  it('climbs one level per correct answer on the current stage', () => {
    const log = [entry('mc-sentence:w_a', NOW - DAY), entry('mc-word:w_a', NOW - DAY + 1)]
    expect(computeLadder(log, [item], CONFIG).get('w_a')).toMatchObject({ level: 2, maxLevel: 2, started: true })
  })

  it('ignores a correct answer on a stage other than the current one', () => {
    const log = [entry('mc-sentence:w_a', NOW - DAY), entry('cloze-word:w_a', NOW - DAY + 1)]
    expect(computeLadder(log, [item], CONFIG).get('w_a')!.level).toBe(1)
  })

  it('drops dropOnWrong levels on a wrong answer, never below 0, but keeps the highest level reached', () => {
    const log = [
      entry('mc-sentence:w_a', NOW - DAY),
      entry('mc-word:w_a', NOW - DAY + 1),
      entry('cloze-word:w_a', NOW - DAY + 2, 'wrong'),
    ]
    expect(computeLadder(log, [item], CONFIG).get('w_a')).toMatchObject({ level: 1, maxLevel: 2 })
    const log2 = [entry('mc-sentence:w_a', NOW - DAY, 'wrong')]
    expect(computeLadder(log2, [item], CONFIG).get('w_a')!.level).toBe(0)
  })

  it('neither climbs nor drops on an answer outside passResults that is not wrong', () => {
    const log = [entry('mc-sentence:w_a', NOW - DAY), entry('mc-word:w_a', NOW - DAY + 1, 'almost')]
    expect(computeLadder(log, [item], CONFIG).get('w_a')!.level).toBe(1)
  })

  it('records when each level was first reached', () => {
    const log = [
      entry('mc-sentence:w_a', NOW - 3 * DAY),
      entry('mc-word:w_a', NOW - 2 * DAY, 'wrong'),
      entry('mc-sentence:w_a', NOW - DAY),
    ]
    const state = computeLadder(log, [item], CONFIG).get('w_a')!
    expect(state.reachedAt[1]).toBe(NOW - 3 * DAY)
  })

  it('remembers the lesson of the first answer', () => {
    const log = [
      entry('mc-sentence:w_a', NOW - DAY, 'correct', 'lesson', { lesson: 'u01#1' }),
      entry('mc-word:w_a', NOW - DAY + 1, 'correct', 'lesson', { lesson: 'u01#2' }),
    ]
    expect(computeLadder(log, [item], CONFIG).get('w_a')!.firstLesson).toBe('u01#1')
  })

  it('does not start an item from a refresh or drill answer', () => {
    const log = [entry('translate-nl-it:w_a', NOW - DAY, 'wrong', 'refresh'), entry('mc-sentence:w_a', NOW - 10, 'correct', 'drill')]
    expect(computeLadder(log, [item], CONFIG).get('w_a')).toMatchObject({ started: false, graduated: false, level: 0 })
  })

  it('does not move a started item on refresh or drill answers', () => {
    const base = [entry('mc-sentence:w_a', NOW - DAY), entry('mc-word:w_a', NOW - DAY + 1)]
    const climb = [...base, entry('cloze-word:w_a', NOW - 10, 'correct', 'refresh')]
    const drop = [...base, entry('cloze-word:w_a', NOW - 10, 'wrong', 'refresh'), entry('mc-word:w_a', NOW - 5, 'wrong', 'drill')]
    expect(computeLadder(climb, [item], CONFIG).get('w_a')!.level).toBe(2)
    expect(computeLadder(drop, [item], CONFIG).get('w_a')!.level).toBe(2)
  })

  it('ignores exam answers without the exam config', () => {
    const log = [
      entry('mc-sentence:w_a', NOW - DAY),
      entry('translate-nl-it:w_a', NOW - DAY + 1, 'wrong', 'exam'),
      entry('mc-word:w_a', NOW - DAY + 2, 'correct', 'exam'),
    ]
    expect(computeLadder(log, [item], CONFIG).get('w_a')!.level).toBe(1)
  })

  it('graduates an item answered well in a passed exam (test-out)', () => {
    const log = [examEntry('translate-nl-it:w_a', NOW - 10, 'almost', 'e1', 1)]
    expect(computeLadder(log, [item], CONFIG, EXAM).get('w_a')).toMatchObject({
      graduated: true, testedOut: true, started: false, level: 4, graduatedAt: NOW - 10,
    })
  })

  it('does not graduate items from a failed or unfinished exam', () => {
    const failed = [
      examEntry('translate-nl-it:w_a', NOW - 10, 'correct', 'e1', 2),
      examEntry('translate-nl-it:w_b', NOW - 9, 'wrong', 'e1', 2),
    ]
    const unfinished = [examEntry('translate-nl-it:w_a', NOW - 10, 'correct', 'e2', 2)]
    const items = [item, { itemId: 'w_b', stageKeys: STAGES.map(s => `${s}:w_b`) }]
    expect(computeLadder(failed, items, CONFIG, EXAM).get('w_a')!.graduated).toBe(false)
    expect(computeLadder(unfinished, items, CONFIG, EXAM).get('w_a')!.graduated).toBe(false)
  })

  it('does not graduate an item missed in a passed exam', () => {
    const items = ['w_a', 'w_b', 'w_c', 'w_d', 'w_e'].map(id => ({ itemId: id, stageKeys: STAGES.map(s => `${s}:${id}`) }))
    const log = items.map((it, i) => examEntry(`translate-nl-it:${it.itemId}`, NOW - 10 + i, it.itemId === 'w_e' ? 'wrong' : 'correct', 'e1', 5))
    const ladder = computeLadder(log, items, CONFIG, EXAM)
    expect(ladder.get('w_a')!.graduated).toBe(true)
    expect(ladder.get('w_e')!.graduated).toBe(false)
  })

  it('treats an item practised in an old-style session before the ladder existed as graduated', () => {
    const log = [entry('translate-it-nl:w_a', NOW - 9 * DAY, 'correct', 'daily'), entry('translate-nl-it:w_a', NOW - 8 * DAY, 'wrong', 'daily')]
    expect(computeLadder(log, [item], CONFIG).get('w_a')).toMatchObject({ graduated: true, started: true })
  })

  it('starts an item from an old-style answer on the first stage', () => {
    const log = [entry('mc-sentence:w_a', NOW - DAY, 'correct', 'daily')]
    expect(computeLadder(log, [item], CONFIG).get('w_a')).toMatchObject({ started: true, level: 1, firstLesson: undefined })
  })

  it('graduates after the last stage and stays graduated', () => {
    const log = [
      ...item.stageKeys.map((k, i) => entry(k, NOW - 2 * DAY + i)),
      entry('cloze-word:w_a', NOW - DAY, 'wrong'),
    ]
    const ladder = computeLadder(log, [item], CONFIG)
    expect(ladder.get('w_a')).toMatchObject({ level: 4, graduated: true, graduatedAt: NOW - 2 * DAY + 3 })
    expect(isGraduated(ladder, 'w_a')).toBe(true)
  })

  it('records first and last time seen', () => {
    const log = [entry('mc-sentence:w_a', NOW - DAY), entry('mc-word:w_a', NOW - 1000, 'wrong')]
    const state = computeLadder(log, [item], CONFIG).get('w_a')!
    expect(state.firstSeen).toBe(NOW - DAY)
    expect(state.lastSeen).toBe(NOW - 1000)
  })

  it('is the same when replayed from the log', () => {
    const log = [entry('mc-sentence:w_a', NOW - DAY), entry('mc-word:w_a', NOW - DAY + 1, 'wrong'), entry('mc-sentence:w_a', NOW - 10)]
    expect(computeLadder(log, [item], CONFIG)).toEqual(computeLadder([...log], [item], CONFIG))
  })
})

describe('isGraduated()', () => {
  it('treats items without a ladder as graduated', () => {
    expect(isGraduated(new Map(), 'w_none')).toBe(true)
  })
})

describe('isFail()', () => {
  it('fails only wrong and again', () => {
    expect(isFail('wrong')).toBe(true)
    expect(isFail('again')).toBe(true)
    expect(['correct', 'almost', 'good', 'easy'].some(r => isFail(r as ReviewEntry['result']))).toBe(false)
  })
})

import type { Word, Verb, Sentence, Tense, Unit } from '../../src/content/schemas.ts'
import type { Content } from '../../src/exercises/types.ts'

export function makeContent(opts: {
  words?: Word[]
  verbs?: Verb[]
  sentences?: Sentence[]
  tenses?: Tense[]
  units?: Unit[]
}): Content {
  return {
    words: new Map((opts.words ?? []).map(w => [w.id, w])),
    verbs: new Map((opts.verbs ?? []).map(v => [v.id, v])),
    sentences: new Map((opts.sentences ?? []).map(s => [s.id, s])),
    tenses: new Map((opts.tenses ?? []).map(t => [t.id, t])),
    units: opts.units ?? [],
  }
}

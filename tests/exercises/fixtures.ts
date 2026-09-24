// Italian fixture data is OK in test-fixture files per .claude/rules/engine.md
import type { Word, Verb, Sentence, Tense, Unit } from '../../src/content/schemas.ts'

export const word_caffe: Word = {
  id: 'w_caffe',
  it: 'caffe',
  pos: 'noun',
  article: 'il',
  gender: 'm',
  plural: null,
  nl: ['koffie'],
  register: 'neutral',
  tags: [],
  core: false,
  note: null,
}

export const word_caffe_accent: Word = {
  id: 'w_caffe_accent',
  it: 'caffè',
  pos: 'noun',
  article: 'il',
  gender: 'm',
  plural: null,
  nl: ['koffie'],
  register: 'neutral',
  tags: [],
  core: false,
  note: null,
}

export const word_ciao: Word = {
  id: 'w_ciao',
  it: 'ciao',
  pos: 'interjection',
  article: null,
  gender: null,
  plural: null,
  nl: ['hoi', 'doei'],
  register: 'informal',
  tags: [],
  core: false,
  note: null,
}

export const verb_essere: Verb = {
  id: 'v_essere',
  inf: 'essere',
  nl: ['zijn'],
  conj: 'irregular',
  irregular: {
    presente: {
      io: 'sono',
      tu: 'sei',
      lui: 'è',
      noi: 'siamo',
      voi: 'siete',
      loro: 'sono',
    },
  },
}

export const sentence_s001: Sentence = {
  id: 's_u01_001',
  it: 'Ciao, sono Sam.',
  nl: ['Hoi, ik ben Sam.'],
  register: 'informal',
  uses: ['w_ciao', 'v_essere'],
  audioText: null,
}

// Word with article (for article exercise)
export const word_signora: Word = {
  id: 'w_signora',
  it: 'signora',
  pos: 'noun',
  article: 'la',
  gender: 'f',
  plural: null,
  nl: ['mevrouw'],
  register: 'formal',
  tags: [],
  core: false,
  note: null,
}

// Regular -are verb (for conjugate exercise)
export const verb_parlare: Verb = {
  id: 'v_parlare',
  inf: 'parlare',
  nl: ['praten', 'spreken'],
  conj: 'are',
}

// Presente tense (for conjugate exercise)
export const tense_presente: Tense = {
  id: 'presente',
  kind: 'simple',
  nl: 'tegenwoordige tijd',
  endings: {
    are: { io: 'o', tu: 'i', lui: 'a', noi: 'iamo', voi: 'ate', loro: 'ano' },
    ere: { io: 'o', tu: 'i', lui: 'e', noi: 'iamo', voi: 'ete', loro: 'ono' },
    ire: { io: 'o', tu: 'i', lui: 'e', noi: 'iamo', voi: 'ite', loro: 'ono' },
    ire_isc: { io: 'isco', tu: 'isci', lui: 'isce', noi: 'iamo', voi: 'ite', loro: 'iscono' },
  },
}

// Sentence with cloze (for cloze exercise)
export const sentence_with_cloze: Sentence = {
  id: 's_cloze_001',
  it: 'Ciao, sono Sam.',
  nl: ['Hoi, ik ben Sam.'],
  register: 'informal',
  uses: ['w_ciao', 'v_essere'],
  audioText: null,
  cloze: [{ target: 'sono', hint: 'essere' }],
}

// Longer sentence for dictation typo test
export const sentence_long: Sentence = {
  id: 's_long_001',
  it: 'Buongiorno, come stai oggi?',
  nl: ['Goedemorgen, hoe gaat het vandaag?'],
  register: 'informal',
  uses: [],
  audioText: null,
}

// Small unit for the learning ladder: sentences in learning order
export const ladderSentences: Sentence[] = [
  { id: 's_l_001', it: 'Ciao, Giulia!', nl: ['Hoi, Giulia!'], register: 'informal', uses: ['w_ciao'], audioText: null },
  { id: 's_l_002', it: 'Ciao, sono Sam.', nl: ['Hoi, ik ben Sam.'], register: 'informal', uses: ['w_ciao', 'v_essere'], audioText: null },
  { id: 's_l_003', it: 'Buongiorno, signora.', nl: ['Goedemorgen, mevrouw.'], register: 'formal', uses: ['w_signora'], audioText: null },
  { id: 's_l_004', it: 'Lei è la signora Rossi?', nl: ['Bent u mevrouw Rossi?'], register: 'formal', uses: ['v_essere', 'w_signora'], audioText: null },
  { id: 's_l_005', it: 'Le signore sono qui.', nl: ['De dames zijn hier.'], register: 'neutral', uses: ['w_signora', 'v_essere'], audioText: null },
  { id: 's_l_006', it: 'Tu sei Marco?', nl: ['Ben jij Marco?'], register: 'informal', uses: ['v_essere'], audioText: null },
]

export const ladderUnit: Unit = {
  schema: 1,
  id: 'u01_test',
  order: 1,
  title: 'Test',
  canDo: ['a', 'b'],
  requires: [],
  words: [word_ciao, word_signora],
  verbs: [verb_essere],
  sentences: ladderSentences,
  dialogues: [],
  grammar: [],
  tenses: ['presente'],
  review: { status: 'draft' },
}

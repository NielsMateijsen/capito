// Italian fixture data is OK in test-fixture files per .claude/rules/engine.md
import type { Word, Verb, Sentence } from '../../src/content/schemas.ts'

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

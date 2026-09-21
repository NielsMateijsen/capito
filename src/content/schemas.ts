import { z } from 'zod'

// ── Shared ──────────────────────────────────────────────────────────────────

const RegisterSchema = z.enum(['informal', 'formal', 'neutral'])
const PosSchema = z.enum(['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'article', 'numeral', 'particle'])
const ConjSchema = z.enum(['are', 'ere', 'ire', 'ire_isc', 'irregular'])

// ── Content types ────────────────────────────────────────────────────────────

export const WordSchema = z.object({
  id: z.string(),
  it: z.string(),
  pos: PosSchema,
  article: z.string().nullable().optional(),
  gender: z.enum(['m', 'f']).nullable().optional(),
  plural: z.string().nullable().optional(),
  nl: z.array(z.string()).min(1),
  register: RegisterSchema,
  tags: z.array(z.string()).optional(),
  core: z.boolean(),
  note: z.string().nullable().optional(),
})

export const ClozeItemSchema = z.object({
  target: z.string(),
  hint: z.string(),
})

export const SentenceSchema = z.object({
  id: z.string(),
  it: z.string(),
  nl: z.array(z.string()).min(1),
  register: RegisterSchema,
  uses: z.array(z.string()),
  audioText: z.string().nullable().optional(),
  cloze: z.array(ClozeItemSchema).optional(),
})

export const DialogueLineSchema = z.object({
  speaker: z.enum(['A', 'B']),
  sentence: z.string(),
})

export const DialogueSchema = z.object({
  id: z.string(),
  register: RegisterSchema,
  title: z.string(),
  lines: z.array(DialogueLineSchema).min(1),
})

export const IrregularFormsSchema = z.record(
  z.string(),
  z.object({
    io: z.string(),
    tu: z.string(),
    lui: z.string(),
    noi: z.string(),
    voi: z.string(),
    loro: z.string(),
  }),
)

export const VerbSchema = z.object({
  id: z.string(),
  inf: z.string(),
  nl: z.array(z.string()).min(1),
  conj: ConjSchema,
  irregular: IrregularFormsSchema.optional(),
  reflexive: z.boolean().optional(),
})

const TenseEndingSetSchema = z.object({
  io: z.string(),
  tu: z.string(),
  lui: z.string(),
  noi: z.string(),
  voi: z.string(),
  loro: z.string(),
})

export const TenseSchema = z.object({
  id: z.string(),
  kind: z.enum(['simple', 'compound']),
  nl: z.string(),
  endings: z.record(z.string(), TenseEndingSetSchema),
})

export const DrillSchema = z.object({
  type: z.string(),
  verbs: z.array(z.string()).optional(),
  tense: z.string().optional(),
})

export const GrammarFrontmatterSchema = z.object({
  schema: z.literal(1),
  id: z.string(),
  title: z.string(),
  unit: z.string(),
  drills: z.array(DrillSchema).optional(),
})

export const ReviewStatusSchema = z.object({
  status: z.enum(['draft', 'reviewed']),
})

export const UnitSchema = z.object({
  schema: z.literal(1),
  id: z.string(),
  order: z.number().int().positive(),
  title: z.string(),
  canDo: z.array(z.string()).min(2).max(4),
  requires: z.array(z.string()).optional().default([]),
  words: z.array(WordSchema),
  verbs: z.array(VerbSchema),
  sentences: z.array(SentenceSchema),
  dialogues: z.array(DialogueSchema),
  grammar: z.array(z.string()),
  tenses: z.array(z.string()),
  review: ReviewStatusSchema,
})

// ── Exported types ───────────────────────────────────────────────────────────

export type Word = z.infer<typeof WordSchema>
export type Sentence = z.infer<typeof SentenceSchema>
export type Dialogue = z.infer<typeof DialogueSchema>
export type Verb = z.infer<typeof VerbSchema>
export type Tense = z.infer<typeof TenseSchema>
export type GrammarFrontmatter = z.infer<typeof GrammarFrontmatterSchema>
export type Unit = z.infer<typeof UnitSchema>
export type Register = z.infer<typeof RegisterSchema>
export type DrillItem = z.infer<typeof DrillSchema>

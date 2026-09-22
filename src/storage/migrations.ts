import { z } from 'zod'
import type { ProgressState } from './types.ts'

export type Migration = (old: Record<string, unknown>) => Record<string, unknown>
export type MigrationMap = Record<number, Migration>

export const CURRENT_SCHEMA = 1

export const MIGRATIONS: MigrationMap = {}

export function migrate(
  raw: unknown,
  migrations: MigrationMap = MIGRATIONS,
  targetSchema: number = CURRENT_SCHEMA,
): ProgressState {
  let data = raw as Record<string, unknown>
  while (((data['schema'] as number) ?? 0) < targetSchema) {
    const from = (data['schema'] as number) ?? 0
    const fn = migrations[from]
    if (!fn) throw new Error(`No migration from schema ${from} to ${from + 1}`)
    data = fn(data)
    if (((data['schema'] as number) ?? 0) <= from) {
      throw new Error(`Migration from schema ${from} did not increment schema`)
    }
  }
  return data as unknown as ProgressState
}

export function exportJson(state: ProgressState): string {
  return JSON.stringify(state)
}

const backupSchema = z.object({
  schema: z.number().int().nonnegative(),
  cards: z.record(z.unknown()),
  reviewLog: z.array(z.unknown()),
  introduced: z.array(z.string()),
  unitMeta: z.record(z.unknown()),
  flags: z.array(z.unknown()),
  settings: z.object({}).passthrough(),
  meta: z.object({}).passthrough(),
})

export function importJson(
  json: string,
  migrations?: MigrationMap,
  targetSchema?: number,
): ProgressState {
  const parsed: unknown = JSON.parse(json)
  const result = backupSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`Ongeldig back-upbestand: ${result.error.issues[0]?.message ?? 'onbekende fout'}`)
  }
  return migrate(parsed, migrations, targetSchema)
}

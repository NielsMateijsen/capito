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
  }
  return data as unknown as ProgressState
}

export function exportJson(state: ProgressState): string {
  return JSON.stringify(state)
}

export function importJson(
  json: string,
  migrations?: MigrationMap,
  targetSchema?: number,
): ProgressState {
  return migrate(JSON.parse(json) as unknown, migrations, targetSchema)
}

import { get, set } from 'idb-keyval'
import type { ProgressState, ProgressStorage } from './types.ts'
import { migrate, CURRENT_SCHEMA } from './migrations.ts'

const KEY = 'progress'

export function defaultState(): ProgressState {
  return {
    schema: CURRENT_SCHEMA,
    cards: {},
    reviewLog: [],
    introduced: [],
    unitMeta: {},
    flags: [],
    settings: {},
    meta: {},
  }
}

export class IdbProgressStorage implements ProgressStorage {
  async load(): Promise<ProgressState> {
    const raw = await get(KEY)
    return raw == null ? defaultState() : migrate(raw)
  }

  async save(state: ProgressState): Promise<void> {
    await set(KEY, state)
  }
}

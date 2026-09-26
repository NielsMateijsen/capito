import type { Page } from '@playwright/test'
import type { ProgressState } from '../../src/storage/types.ts'

/**
 * Reads the saved progress straight from IndexedDB. This is the only place in e2e/ that knows
 * how progress is stored (idb-keyval defaults + the key in src/storage/progress-store.ts).
 */
const DB = 'keyval-store'
const STORE = 'keyval'
const KEY = 'progress'

/** The saved progress, or null when the app has not saved anything yet. */
export async function readProgress(page: Page): Promise<ProgressState | null> {
  return page.evaluate(({ db, store, key }) => new Promise<ProgressState | null>((resolve, reject) => {
    const open = indexedDB.open(db)
    // Never create the database here: the app would then find it without its store
    open.onupgradeneeded = () => open.transaction?.abort()
    open.onerror = () => (open.error?.name === 'AbortError' ? resolve(null) : reject(open.error))
    open.onsuccess = () => {
      const conn = open.result
      if (!conn.objectStoreNames.contains(store)) {
        conn.close()
        resolve(null)
        return
      }
      const get = conn.transaction(store, 'readonly').objectStore(store).get(key)
      get.onerror = () => reject(get.error)
      get.onsuccess = () => {
        conn.close()
        resolve((get.result as ProgressState | undefined) ?? null)
      }
    }
  }), { db: DB, store: STORE, key: KEY })
}

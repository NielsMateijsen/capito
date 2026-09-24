// Binds in-app screen state to the browser history, so the browser/OS back
// gesture returns to the previous screen instead of leaving the app.

export interface HistoryLike {
  readonly state: unknown
  pushState(data: unknown, unused: string): void
  replaceState(data: unknown, unused: string): void
  go(delta: number): void
}

interface Entry<V> {
  view: V
  depth: number
}

function isEntry<V>(state: unknown): state is Entry<V> {
  return typeof state === 'object' && state !== null && 'view' in state && typeof (state as Entry<V>).depth === 'number'
}

export interface Navigator<V> {
  /** Replaces the current history entry with the root view (depth 0). */
  start(view: V): void
  /** Opens a view as a new history entry. */
  navigate(view: V): void
  /** Goes one entry back; at the root it shows `fallback` without leaving the app. */
  back(fallback: V): void
  /** Returns to the root entry, dropping the screens in between. */
  home(view: V): void
  /** Call from the `popstate` listener. Returns true when the state belonged to this navigator. */
  handlePop(state: unknown): boolean
}

export function createNavigator<V>(history: HistoryLike, onChange: (view: V) => void): Navigator<V> {
  let depth = 0

  function resetRoot(view: V) {
    depth = 0
    history.replaceState({ view, depth } satisfies Entry<V>, '')
    onChange(view)
  }

  return {
    start: resetRoot,
    navigate(view) {
      depth += 1
      history.pushState({ view, depth } satisfies Entry<V>, '')
      onChange(view)
    },
    back(fallback) {
      if (depth > 0) history.go(-1)
      else resetRoot(fallback)
    },
    home(view) {
      if (depth > 0) history.go(-depth)
      else resetRoot(view)
    },
    handlePop(state) {
      if (!isEntry<V>(state)) return false
      depth = state.depth
      onChange(state.view)
      return true
    },
  }
}

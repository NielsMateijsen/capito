import { useEffect, useState } from 'react'

/**
 * How much of the layout viewport the on-screen keyboard covers at the bottom: the layout height
 * minus the visible part (visualViewport) and its scroll offset. Never negative.
 */
export function keyboardInset(layoutHeight: number, visibleHeight: number, visibleOffsetTop: number): number {
  return Math.max(0, Math.round(layoutHeight - visibleHeight - visibleOffsetTop))
}

/** Keeps a bottom bar above the on-screen keyboard (iOS does not resize the layout viewport). */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setInset(keyboardInset(window.innerHeight, vv.height, vv.offsetTop))
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return inset
}

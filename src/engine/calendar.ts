const MS_PER_DAY = 86_400_000

function zonedParts(ms: number, timeZone: string): { y: number; m: number; d: number; wallMs: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms))
  const get = (type: string) => Number(parts.find(p => p.type === type)!.value)
  const y = get('year'), m = get('month'), d = get('day')
  return { y, m, d, wallMs: Date.UTC(y, m - 1, d, get('hour'), get('minute'), get('second')) }
}

function offsetAt(ms: number, timeZone: string): number {
  const whole = Math.floor(ms / 1000) * 1000
  return zonedParts(whole, timeZone).wallMs - whole
}

/** Start of the calendar day containing `now` in `timeZone`, in UTC milliseconds. */
export function dayStartMs(now: number, timeZone: string): number {
  const { y, m, d } = zonedParts(now, timeZone)
  const midnightWall = Date.UTC(y, m - 1, d)
  // The offset can differ between now and midnight on a DST switch day
  const guess = midnightWall - offsetAt(now, timeZone)
  return midnightWall - offsetAt(guess, timeZone)
}

/** Calendar day of `ms` in `timeZone` as a whole number: consecutive days differ by exactly 1. */
export function dayNumber(ms: number, timeZone: string): number {
  const { y, m, d } = zonedParts(ms, timeZone)
  return Date.UTC(y, m - 1, d) / MS_PER_DAY
}

export interface CardState {
  ease: number
  interval: number
  due: number
  reps: number
  lapses: number
}

export interface SrsConfig {
  startEase: number
  minEase: number
  maxIntervalDays: number
}

const MS_PER_DAY = 86_400_000

function adjustEase(ease: number, grade: number, minEase: number): number {
  const delta = 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)
  return Math.max(minEase, ease + delta)
}

export function schedule(
  state: CardState | null,
  grade: number,
  now: number,
  config: SrsConfig,
): CardState {
  const { startEase, minEase, maxIntervalDays } = config

  const base = state ?? { ease: startEase, interval: 1, due: now, reps: 0, lapses: 0 }

  // Lapse — grade 1 (wrong) and grade 2 (unused, treated as lapse per SM-2)
  if (grade < 3) {
    return {
      ease: adjustEase(base.ease, grade, minEase),
      interval: 1,
      due: now + MS_PER_DAY,
      reps: 0,
      lapses: base.lapses + 1,
    }
  }

  // Pass — compute next interval
  let interval: number
  if (base.reps === 0) {
    interval = 1
  } else if (base.reps === 1) {
    interval = 6
  } else {
    interval = Math.min(
      Math.round(base.interval * base.ease),
      maxIntervalDays,
    )
  }

  return {
    ease: adjustEase(base.ease, grade, minEase),
    interval,
    due: now + interval * MS_PER_DAY,
    reps: base.reps + 1,
    lapses: base.lapses,
  }
}

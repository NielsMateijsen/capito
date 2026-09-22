import type { CardState } from './srs.ts'
import type { ProgressState } from '../storage/types.ts'
import type { Unit } from '../content/schemas.ts'

export interface UnlockConfig {
  masteryThreshold: number
  minRepsPerCard: number
  requireExam: boolean
  passThreshold: number
}

export function unitMastery(
  cardKeys: string[],
  cards: Record<string, CardState>,
  config: { minRepsPerCard: number },
): number {
  if (cardKeys.length === 0) return 1
  const mastered = cardKeys.filter(k => (cards[k]?.reps ?? 0) >= config.minRepsPerCard).length
  return mastered / cardKeys.length
}

export function isUnitUnlocked(
  unit: Unit,
  cardKeysByUnit: Map<string, string[]>,
  progress: ProgressState,
  config: UnlockConfig,
): boolean {
  for (const reqId of unit.requires) {
    const reqKeys = cardKeysByUnit.get(reqId) ?? []
    const mastery = unitMastery(reqKeys, progress.cards, config)
    if (mastery < config.masteryThreshold) return false
    if (config.requireExam) {
      const best = progress.unitMeta[reqId]?.examBest ?? 0
      if (best < config.passThreshold) return false
    }
  }
  return true
}

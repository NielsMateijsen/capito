import type { Unit } from '../content/schemas.ts'

/** A unit opens when the exam of every required unit has been passed. */
export function isUnitUnlocked(unit: Pick<Unit, 'requires'>, passedUnits: Set<string>): boolean {
  return unit.requires.every(id => passedUnits.has(id))
}

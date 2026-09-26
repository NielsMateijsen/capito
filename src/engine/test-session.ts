import type { SessionItem } from './session-builder.ts'
import { cardType } from './session-builder.ts'

/**
 * A queue for trying out every exercise type: one intro (when given) and then, per type,
 * the first card that can be built. Types without a buildable card are left out.
 */
export function buildTestQueue(
  typeIds: string[],
  allCardKeys: string[],
  canBuild: (cardKey: string) => boolean,
  introItemId?: string,
): SessionItem[] {
  const queue: SessionItem[] = introItemId ? [{ kind: 'intro', itemId: introItemId }] : []
  for (const typeId of typeIds) {
    const key = allCardKeys.find(k => cardType(k) === typeId && canBuild(k))
    if (key) queue.push({ kind: 'exercise', cardKey: key, isNew: false })
  }
  return queue
}

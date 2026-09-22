export const EXAM_ALLOWED_TYPES = new Set([
  'translate-nl-it',
  'sentence-translate',
  'conjugate',
  'cloze',
  'dictation',
])

export interface ExamConfig {
  itemCount: number
  unitShare: number
  passThreshold: number
  availableFromMastery: number
  allowHints: boolean
}

export interface ExamResult {
  score: number
  passed: boolean
  byType: Record<string, { correct: number; total: number }>
  missedCardKeys: string[]
}

function cardType(cardKey: string): string {
  return cardKey.split(':')[0]
}

export function isExamAvailable(mastery: number, config: { availableFromMastery: number }): boolean {
  return mastery >= config.availableFromMastery
}

export function buildExamSession(
  unitId: string,
  allCardKeys: string[],
  cardToUnit: Map<string, string>,
  config: ExamConfig,
): string[] {
  const unitCards = allCardKeys.filter(
    k => cardToUnit.get(k) === unitId && EXAM_ALLOWED_TYPES.has(cardType(k)),
  )
  const otherCards = allCardKeys.filter(
    k => cardToUnit.get(k) !== unitId && EXAM_ALLOWED_TYPES.has(cardType(k)),
  )

  const unitCount = Math.round(config.itemCount * config.unitShare)
  const otherCount = config.itemCount - unitCount

  return [...unitCards.slice(0, unitCount), ...otherCards.slice(0, otherCount)]
}

export function scoreExam(
  results: Map<string, 'correct' | 'almost' | 'wrong'>,
  config: { passThreshold: number },
): ExamResult {
  const total = results.size
  const byType: Record<string, { correct: number; total: number }> = {}
  const missedCardKeys: string[] = []
  let correctCount = 0

  for (const [key, result] of results) {
    const type = cardType(key)
    if (!byType[type]) byType[type] = { correct: 0, total: 0 }
    byType[type].total++

    const isCorrect = result === 'correct' || result === 'almost'
    if (isCorrect) {
      correctCount++
      byType[type].correct++
    } else {
      missedCardKeys.push(key)
    }
  }

  const score = total > 0 ? correctCount / total : 0
  return {
    score,
    passed: score >= config.passThreshold,
    byType,
    missedCardKeys,
  }
}

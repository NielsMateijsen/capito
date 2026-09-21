export type CheckResult = 'correct' | 'almost' | 'wrong'
export type ExerciseType = 'translation' | 'conjugation' | 'article' | 'cloze' | 'flashcard'

export interface CheckerConfig {
  typoMinLength: number
  typoMaxDistance: number
}

const TYPO_DISABLED: ReadonlySet<ExerciseType> = new Set(['conjugation', 'article', 'cloze'])

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[.?!,]+$/, '')
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const temp = dp[j]
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = temp
    }
  }
  return dp[n]
}

export function check(
  input: string,
  validAnswers: string[],
  exerciseType: ExerciseType,
  config: CheckerConfig,
  accentExceptions: ReadonlySet<string> = new Set(),
): CheckResult {
  const norm = normalize(input)
  const normed = validAnswers.map(normalize)

  // 1. Exact match
  if (normed.includes(norm)) return 'correct'

  // 2. Accent check
  let hadAmbiguousAccentHit = false
  for (const answer of normed) {
    const stripped = stripAccents(answer)
    if (stripped === norm) {
      if (accentExceptions.has(stripped)) {
        hadAmbiguousAccentHit = true
      } else {
        return 'almost'
      }
    }
  }
  if (hadAmbiguousAccentHit) return 'wrong'

  // 3. Typo check (disabled for conjugation, article, cloze)
  if (!TYPO_DISABLED.has(exerciseType)) {
    for (const answer of normed) {
      if (
        answer.length >= config.typoMinLength &&
        levenshtein(norm, answer) <= config.typoMaxDistance
      ) {
        return 'almost'
      }
    }
  }

  return 'wrong'
}

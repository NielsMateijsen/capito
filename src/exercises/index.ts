import type { ExerciseModule } from './types.ts'

const raw = import.meta.glob<ExerciseModule>('./*.ts', { eager: true, import: 'default' })

export const exercises: ExerciseModule[] = Object.values(raw).filter(
  (m): m is ExerciseModule => m != null && typeof (m as ExerciseModule).id === 'string',
)

export const exerciseMap = new Map(exercises.map(e => [e.id, e]))

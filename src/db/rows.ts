import type {
  BodyWeightLog,
  Exercise,
  Routine,
  RoutineExercise,
  Session,
  SessionSet,
  Weekday,
  WeekTarget,
} from '@/domain/types';

/**
 * Tradutores entre as linhas snake_case do SQLite e os objetos camelCase do
 * dominio. Ficam isolados aqui para que nenhuma tela precise conhecer o
 * formato do banco — e para que o mesmo mapeamento sirva ao Supabase, que usa
 * exatamente as mesmas colunas.
 */

export type ExerciseRow = {
  id: string;
  name: string;
  muscle_group: string | null;
  kind: string;
  updated_at: string;
  deleted_at: string | null;
};

export type RoutineRow = {
  id: string;
  name: string;
  weekday: number;
  position: number;
  updated_at: string;
  deleted_at: string | null;
};

export type RoutineExerciseRow = {
  id: string;
  routine_id: string;
  exercise_id: string;
  position: number;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number;
  target_distance_km: number;
  target_duration_min: number;
  updated_at: string;
  deleted_at: string | null;
};

export type WeekTargetRow = {
  id: string;
  week_start: string;
  routine_exercise_id: string;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number;
  target_distance_km: number;
  target_duration_min: number;
  updated_at: string;
  deleted_at: string | null;
};

export type SessionRow = {
  id: string;
  routine_id: string | null;
  date: string;
  started_at: string;
  finished_at: string | null;
  updated_at: string;
  deleted_at: string | null;
};

export type SessionSetRow = {
  id: string;
  session_id: string;
  exercise_id: string;
  set_index: number;
  reps: number;
  weight_kg: number;
  distance_km: number;
  duration_min: number;
  /** SQLite nao tem boolean: 0 ou 1. */
  done: number;
  updated_at: string;
  deleted_at: string | null;
};

export type BodyWeightLogRow = {
  id: string;
  logged_at: string;
  weight_kg: number;
  updated_at: string;
  deleted_at: string | null;
};

export const toExercise = (row: ExerciseRow): Exercise => ({
  id: row.id,
  name: row.name,
  muscleGroup: row.muscle_group,
  // Banco antigo pode nao ter a coluna preenchida; carga e o padrao.
  kind: row.kind === 'run' ? 'run' : 'strength',
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

export const toRoutine = (row: RoutineRow): Routine => ({
  id: row.id,
  name: row.name,
  weekday: row.weekday as Weekday,
  position: row.position,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

export const toRoutineExercise = (row: RoutineExerciseRow): RoutineExercise => ({
  id: row.id,
  routineId: row.routine_id,
  exerciseId: row.exercise_id,
  position: row.position,
  targetSets: row.target_sets,
  targetReps: row.target_reps,
  targetWeightKg: row.target_weight_kg,
  targetDistanceKm: row.target_distance_km,
  targetDurationMin: row.target_duration_min,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

export const toWeekTarget = (row: WeekTargetRow): WeekTarget => ({
  id: row.id,
  weekStart: row.week_start,
  routineExerciseId: row.routine_exercise_id,
  targetSets: row.target_sets,
  targetReps: row.target_reps,
  targetWeightKg: row.target_weight_kg,
  targetDistanceKm: row.target_distance_km,
  targetDurationMin: row.target_duration_min,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

export const toSession = (row: SessionRow): Session => ({
  id: row.id,
  routineId: row.routine_id,
  date: row.date,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

export const toSessionSet = (row: SessionSetRow): SessionSet => ({
  id: row.id,
  sessionId: row.session_id,
  exerciseId: row.exercise_id,
  setIndex: row.set_index,
  reps: row.reps,
  weightKg: row.weight_kg,
  distanceKm: row.distance_km,
  durationMin: row.duration_min,
  done: row.done === 1,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

export const toBodyWeightLog = (row: BodyWeightLogRow): BodyWeightLog => ({
  id: row.id,
  loggedAt: row.logged_at,
  weightKg: row.weight_kg,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

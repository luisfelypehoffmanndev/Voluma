/**
 * Modelo de dominio do CleanGym.
 *
 * O mesmo formato vale para o SQLite local e para o Postgres do Supabase.
 * Toda entidade sincronizavel carrega `id` (uuid gerado no cliente),
 * `updatedAt` e `deletedAt` (soft delete) para permitir last-write-wins.
 */

export type Syncable = {
  id: string;
  updatedAt: string;
  /** ISO string quando removido, null quando ativo. */
  deletedAt: string | null;
};

/** 0 = domingo ... 6 = sabado, igual a Date#getDay. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Exercise = Syncable & {
  name: string;
  muscleGroup: string | null;
};

/** Um treino planejado, fixo em um dia da semana ("Costas + biceps · Segundas"). */
export type Routine = Syncable & {
  name: string;
  weekday: Weekday;
  position: number;
};

export type RoutineExercise = Syncable & {
  routineId: string;
  exerciseId: string;
  position: number;
  targetSets: number;
  targetReps: number;
  targetWeightKg: number;
};

/** Uma execucao real de treino, em uma data. */
export type Session = Syncable & {
  routineId: string | null;
  /** data local no formato YYYY-MM-DD — a chave usada pelo calendario. */
  date: string;
  startedAt: string;
  finishedAt: string | null;
};

export type SessionSet = Syncable & {
  sessionId: string;
  exerciseId: string;
  /** 1-based, a ordem da serie dentro do exercicio naquela sessao. */
  setIndex: number;
  reps: number;
  weightKg: number;
  done: boolean;
};

export type BodyWeightLog = Syncable & {
  loggedAt: string;
  weightKg: number;
};

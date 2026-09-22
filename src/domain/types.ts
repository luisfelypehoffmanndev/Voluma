/**
 * Modelo de dominio do Voluma.
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

/**
 * O que o exercicio mede.
 *
 * `strength` e o caso geral: series, reps e carga. `run` existe para a corrida,
 * que mede distancia e tempo — os campos de carga ficam zerados e nao entram no
 * volume levantado.
 */
export type ExerciseKind = 'strength' | 'run';

export type Exercise = Syncable & {
  name: string;
  muscleGroup: string | null;
  kind: ExerciseKind;
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
  targetDistanceKm: number;
  targetDurationMin: number;
};

/**
 * Os alvos de um exercicio.
 *
 * Os cinco campos vivem juntos num tipo so, em vez de um tipo por modalidade,
 * porque e o que deixa `routine_exercises`, `week_targets` e o editor de alvos
 * atenderem corrida sem duplicar nada. Quem le decide o que importa pelo
 * `kind` do exercicio: musculacao olha sets/reps/weightKg, corrida olha
 * distanceKm/durationMin. O outro par fica em zero.
 */
export type Targets = {
  sets: number;
  reps: number;
  weightKg: number;
  distanceKm: number;
  durationMin: number;
};

/**
 * O ajuste do usuario para UMA semana.
 *
 * A ausencia de linha e significativa: semana sem `WeekTarget` usa o padrao
 * derivado do historico. So nasce linha quando o usuario mexe num stepper,
 * entao o banco nunca guarda semana que ninguem pediu.
 */
export type WeekTarget = Syncable & {
  /** Domingo da semana, no formato YYYY-MM-DD. */
  weekStart: string;
  routineExerciseId: string;
  targetSets: number;
  targetReps: number;
  targetWeightKg: number;
  targetDistanceKm: number;
  targetDurationMin: number;
};

/** Uma execucao real de treino, em uma data. */
export type Session = Syncable & {
  routineId: string | null;
  /** data local no formato YYYY-MM-DD — a chave usada pelo calendario. */
  date: string;
  startedAt: string;
  finishedAt: string | null;
  /** Exercicios tirados so deste treino ("Pular hoje"); o plano nao muda. */
  skippedExerciseIds: string[];
  /** Quando o usuario tocou em "Finalizar treino". Nulo = nunca finalizado. */
  completedAt: string | null;
};

export type SessionSet = Syncable & {
  sessionId: string;
  exerciseId: string;
  /** 1-based, a ordem da serie dentro do exercicio naquela sessao. */
  setIndex: number;
  reps: number;
  weightKg: number;
  /** Corrida: quanto foi percorrido. Zero em exercicio de carga. */
  distanceKm: number;
  /** Corrida: quanto tempo levou, em minutos. Zero em exercicio de carga. */
  durationMin: number;
  done: boolean;
};

export type BodyWeightLog = Syncable & {
  loggedAt: string;
  weightKg: number;
};

/**
 * O perfil publico: como amigos acham e reconhecem uma pessoa.
 *
 * Nao e `Syncable` de proposito — vive so no Supabase, fora do outbox e do
 * last-write-wins. E dado social: nao tem par no SQLite porque nao tem o que
 * fazer offline, e quem usa o app sem conta simplesmente nao tem perfil.
 *
 * `id` e o mesmo uuid de `auth.users`, nao um id gerado no cliente.
 */
export type Profile = {
  id: string;
  handle: string;
  /** Opcionais: a tela de cadastro permite pular os dois. */
  age: number | null;
  /** Ha quantos anos a pessoa treina. Respondido uma vez, nao derivado do uso. */
  trainingYears: number | null;
};

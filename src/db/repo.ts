import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  BodyWeightLog,
  Exercise,
  Routine,
  RoutineExercise,
  Session,
  SessionSet,
  Weekday,
} from '@/domain/types';
import { toDateKey } from '@/domain/week';

import { getDb } from './client';
import type { SyncedTable } from './schema';
import {
  toBodyWeightLog,
  toExercise,
  toRoutine,
  toRoutineExercise,
  toSession,
  toSessionSet,
  type BodyWeightLogRow,
  type ExerciseRow,
  type RoutineExerciseRow,
  type RoutineRow,
  type SessionRow,
  type SessionSetRow,
} from './rows';

/**
 * Repositorio local. Toda escrita passa por aqui e faz duas coisas na mesma
 * transacao: grava a linha e enfileira o id em `outbox`. Se o app fechar entre
 * as duas, a mudanca sumiria do sync — por isso a transacao.
 */

export const newId = (): string => Crypto.randomUUID();
const now = (): string => new Date().toISOString();

/** Marca uma linha como pendente de envio ao Supabase. */
async function enqueue(db: SQLiteDatabase, table: SyncedTable, rowId: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO outbox (table_name, row_id, queued_at) VALUES (?, ?, ?)',
    table,
    rowId,
    now(),
  );
}

// ---------------------------------------------------------------- exercicios

export async function listExercises(): Promise<Exercise[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ExerciseRow>(
    'SELECT * FROM exercises WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE',
  );
  return rows.map(toExercise);
}

export async function createExercise(name: string, muscleGroup?: string): Promise<Exercise> {
  const db = await getDb();
  const exercise: Exercise = {
    id: newId(),
    name: name.trim(),
    muscleGroup: muscleGroup?.trim() || null,
    updatedAt: now(),
    deletedAt: null,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO exercises (id, name, muscle_group, updated_at, deleted_at) VALUES (?, ?, ?, ?, NULL)',
      exercise.id,
      exercise.name,
      exercise.muscleGroup,
      exercise.updatedAt,
    );
    await enqueue(db, 'exercises', exercise.id);
  });

  return exercise;
}

export async function renameExercise(id: string, name: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE exercises SET name = ?, updated_at = ? WHERE id = ?',
      name.trim(),
      now(),
      id,
    );
    await enqueue(db, 'exercises', id);
  });
}

export async function deleteExercise(id: string): Promise<void> {
  await softDelete('exercises', id);
}

// ------------------------------------------------------------------ rotinas

export async function listRoutines(): Promise<Routine[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RoutineRow>(
    'SELECT * FROM routines WHERE deleted_at IS NULL ORDER BY weekday, position',
  );
  return rows.map(toRoutine);
}

export async function getRoutine(id: string): Promise<Routine | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<RoutineRow>('SELECT * FROM routines WHERE id = ?', id);
  return row ? toRoutine(row) : null;
}

export async function createRoutine(name: string, weekday: Weekday): Promise<Routine> {
  const db = await getDb();
  const routine: Routine = {
    id: newId(),
    name: name.trim(),
    weekday,
    position: 0,
    updatedAt: now(),
    deletedAt: null,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO routines (id, name, weekday, position, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL)',
      routine.id,
      routine.name,
      routine.weekday,
      routine.position,
      routine.updatedAt,
    );
    await enqueue(db, 'routines', routine.id);
  });

  return routine;
}

export async function updateRoutine(
  id: string,
  patch: { name?: string; weekday?: Weekday },
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    if (patch.name !== undefined) {
      await db.runAsync('UPDATE routines SET name = ? WHERE id = ?', patch.name.trim(), id);
    }
    if (patch.weekday !== undefined) {
      await db.runAsync('UPDATE routines SET weekday = ? WHERE id = ?', patch.weekday, id);
    }
    await db.runAsync('UPDATE routines SET updated_at = ? WHERE id = ?', now(), id);
    await enqueue(db, 'routines', id);
  });
}

export async function deleteRoutine(id: string): Promise<void> {
  await softDelete('routines', id);
}

// ------------------------------------------------- exercicios de uma rotina

export type RoutineExerciseWithName = RoutineExercise & { exerciseName: string };

export async function listRoutineExercises(
  routineId: string,
): Promise<RoutineExerciseWithName[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RoutineExerciseRow & { exercise_name: string }>(
    `SELECT re.*, e.name AS exercise_name
       FROM routine_exercises re
       JOIN exercises e ON e.id = re.exercise_id
      WHERE re.routine_id = ? AND re.deleted_at IS NULL AND e.deleted_at IS NULL
      ORDER BY re.position`,
    routineId,
  );
  return rows.map((row) => ({ ...toRoutineExercise(row), exerciseName: row.exercise_name }));
}

export async function addExerciseToRoutine(
  routineId: string,
  exerciseId: string,
  targets: { sets: number; reps: number; weightKg: number },
): Promise<void> {
  const db = await getDb();
  const id = newId();

  await db.withTransactionAsync(async () => {
    const last = await db.getFirstAsync<{ next: number }>(
      'SELECT COALESCE(MAX(position) + 1, 0) AS next FROM routine_exercises WHERE routine_id = ? AND deleted_at IS NULL',
      routineId,
    );
    await db.runAsync(
      `INSERT INTO routine_exercises
         (id, routine_id, exercise_id, position, target_sets, target_reps, target_weight_kg, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      id,
      routineId,
      exerciseId,
      last?.next ?? 0,
      targets.sets,
      targets.reps,
      targets.weightKg,
      now(),
    );
    await enqueue(db, 'routine_exercises', id);
  });
}

export async function updateRoutineExercise(
  id: string,
  targets: { sets: number; reps: number; weightKg: number },
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE routine_exercises
          SET target_sets = ?, target_reps = ?, target_weight_kg = ?, updated_at = ?
        WHERE id = ?`,
      targets.sets,
      targets.reps,
      targets.weightKg,
      now(),
      id,
    );
    await enqueue(db, 'routine_exercises', id);
  });
}

export async function removeRoutineExercise(id: string): Promise<void> {
  await softDelete('routine_exercises', id);
}

/** Reordena aplicando a nova posicao de cada item — usado pelo drag da lista. */
export async function reorderRoutineExercises(orderedIds: readonly string[]): Promise<void> {
  const db = await getDb();
  const timestamp = now();

  await db.withTransactionAsync(async () => {
    for (let position = 0; position < orderedIds.length; position += 1) {
      const id = orderedIds[position];
      await db.runAsync(
        'UPDATE routine_exercises SET position = ?, updated_at = ? WHERE id = ?',
        position,
        timestamp,
        id,
      );
      await enqueue(db, 'routine_exercises', id);
    }
  });
}

// ------------------------------------------------------------------ treinos

export async function getSession(id: string): Promise<Session | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SessionRow>('SELECT * FROM sessions WHERE id = ?', id);
  return row ? toSession(row) : null;
}

export async function getSessionByDate(dateKey: string): Promise<Session | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SessionRow>(
    'SELECT * FROM sessions WHERE date = ? AND deleted_at IS NULL ORDER BY started_at DESC LIMIT 1',
    dateKey,
  );
  return row ? toSession(row) : null;
}

/** Treino ainda aberto (sem `finished_at`) — o app volta direto para ele. */
export async function getOpenSession(): Promise<Session | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SessionRow>(
    'SELECT * FROM sessions WHERE finished_at IS NULL AND deleted_at IS NULL ORDER BY started_at DESC LIMIT 1',
  );
  return row ? toSession(row) : null;
}

/**
 * Comeca um treino a partir de uma rotina, ja materializando as series-alvo
 * como linhas nao concluidas. Assim a tela de treino so precisa marcar
 * `done` e ajustar numeros, sem criar nada no meio do exercicio.
 */
export async function startSession(routineId: string | null, when = new Date()): Promise<Session> {
  const db = await getDb();
  const session: Session = {
    id: newId(),
    routineId,
    date: toDateKey(when),
    startedAt: when.toISOString(),
    finishedAt: null,
    updatedAt: now(),
    deletedAt: null,
  };

  const planned = routineId ? await listRoutineExercises(routineId) : [];

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO sessions (id, routine_id, date, started_at, finished_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, NULL, ?, NULL)`,
      session.id,
      session.routineId,
      session.date,
      session.startedAt,
      session.updatedAt,
    );
    await enqueue(db, 'sessions', session.id);

    for (const item of planned) {
      for (let index = 1; index <= item.targetSets; index += 1) {
        const setId = newId();
        await db.runAsync(
          `INSERT INTO session_sets
             (id, session_id, exercise_id, set_index, reps, weight_kg, done, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, NULL)`,
          setId,
          session.id,
          item.exerciseId,
          index,
          item.targetReps,
          item.targetWeightKg,
          session.updatedAt,
        );
        await enqueue(db, 'session_sets', setId);
      }
    }
  });

  return session;
}

export async function finishSession(id: string): Promise<void> {
  const db = await getDb();
  const timestamp = now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE sessions SET finished_at = ?, updated_at = ? WHERE id = ?',
      timestamp,
      timestamp,
      id,
    );
    await enqueue(db, 'sessions', id);
    // Series nunca marcadas nao viraram carga levantada: descarta para nao
    // poluir o historico com alvos que nao aconteceram.
    const orphans = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM session_sets WHERE session_id = ? AND done = 0 AND deleted_at IS NULL',
      id,
    );
    for (const orphan of orphans) {
      await db.runAsync(
        'UPDATE session_sets SET deleted_at = ?, updated_at = ? WHERE id = ?',
        timestamp,
        timestamp,
        orphan.id,
      );
      await enqueue(db, 'session_sets', orphan.id);
    }
  });
}

export async function deleteSession(id: string): Promise<void> {
  await softDelete('sessions', id);
}

// ------------------------------------------------------------------- series

export async function listSessionSets(sessionId: string): Promise<SessionSet[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SessionSetRow>(
    'SELECT * FROM session_sets WHERE session_id = ? AND deleted_at IS NULL ORDER BY set_index',
    sessionId,
  );
  return rows.map(toSessionSet);
}

export async function updateSet(
  id: string,
  patch: { reps?: number; weightKg?: number; done?: boolean },
): Promise<void> {
  const db = await getDb();
  const timestamp = now();

  await db.withTransactionAsync(async () => {
    if (patch.reps !== undefined) {
      await db.runAsync('UPDATE session_sets SET reps = ? WHERE id = ?', patch.reps, id);
    }
    if (patch.weightKg !== undefined) {
      await db.runAsync('UPDATE session_sets SET weight_kg = ? WHERE id = ?', patch.weightKg, id);
    }
    if (patch.done !== undefined) {
      await db.runAsync('UPDATE session_sets SET done = ? WHERE id = ?', patch.done ? 1 : 0, id);
    }
    await db.runAsync('UPDATE session_sets SET updated_at = ? WHERE id = ?', timestamp, id);
    await enqueue(db, 'session_sets', id);
  });
}

/**
 * Materializa um exercicio inteiro dentro de um treino ja em andamento, criando
 * as series-alvo de uma vez.
 *
 * Mesmo formato que `startSession` usa ao abrir o treino — series nao
 * concluidas, prontas para o usuario so marcar e ajustar. Tudo numa transacao:
 * meio exercicio criado seria pior que nenhum.
 */
export async function addExerciseToSession(
  sessionId: string,
  exerciseId: string,
  targets: { sets: number; reps: number; weightKg: number },
): Promise<void> {
  const db = await getDb();
  const timestamp = now();

  await db.withTransactionAsync(async () => {
    // Continua a numeracao se o exercicio ja tiver series nesta sessao, para
    // nao repetir set_index ao adicionar o mesmo movimento duas vezes.
    const last = await db.getFirstAsync<{ last_index: number }>(
      `SELECT COALESCE(MAX(set_index), 0) AS last_index FROM session_sets
        WHERE session_id = ? AND exercise_id = ? AND deleted_at IS NULL`,
      sessionId,
      exerciseId,
    );
    const offset = last?.last_index ?? 0;

    for (let index = 1; index <= targets.sets; index += 1) {
      const setId = newId();
      await db.runAsync(
        `INSERT INTO session_sets
           (id, session_id, exercise_id, set_index, reps, weight_kg, done, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, NULL)`,
        setId,
        sessionId,
        exerciseId,
        offset + index,
        targets.reps,
        targets.weightKg,
        timestamp,
      );
      await enqueue(db, 'session_sets', setId);
    }
  });
}

/** Serie extra, alem do que a rotina planejava. Copia os valores da ultima. */
export async function addSet(sessionId: string, exerciseId: string): Promise<void> {
  const db = await getDb();
  const id = newId();

  await db.withTransactionAsync(async () => {
    const last = await db.getFirstAsync<{ set_index: number; reps: number; weight_kg: number }>(
      `SELECT set_index, reps, weight_kg FROM session_sets
        WHERE session_id = ? AND exercise_id = ? AND deleted_at IS NULL
        ORDER BY set_index DESC LIMIT 1`,
      sessionId,
      exerciseId,
    );
    await db.runAsync(
      `INSERT INTO session_sets
         (id, session_id, exercise_id, set_index, reps, weight_kg, done, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, NULL)`,
      id,
      sessionId,
      exerciseId,
      (last?.set_index ?? 0) + 1,
      last?.reps ?? 10,
      last?.weight_kg ?? 0,
      now(),
    );
    await enqueue(db, 'session_sets', id);
  });
}

export async function removeSet(id: string): Promise<void> {
  await softDelete('session_sets', id);
}

// ----------------------------------------------------------- peso corporal

export async function listBodyWeightLogs(limit = 30): Promise<BodyWeightLog[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<BodyWeightLogRow>(
    'SELECT * FROM body_weight_logs WHERE deleted_at IS NULL ORDER BY logged_at DESC LIMIT ?',
    limit,
  );
  return rows.map(toBodyWeightLog);
}

export async function logBodyWeight(weightKg: number, when = new Date()): Promise<void> {
  const db = await getDb();
  const id = newId();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO body_weight_logs (id, logged_at, weight_kg, updated_at, deleted_at) VALUES (?, ?, ?, ?, NULL)',
      id,
      when.toISOString(),
      weightKg,
      now(),
    );
    await enqueue(db, 'body_weight_logs', id);
  });
}

export async function deleteBodyWeightLog(id: string): Promise<void> {
  await softDelete('body_weight_logs', id);
}

// ---------------------------------------------------------------- agregados

/**
 * Volume por data, ja somado no SQL. Alimenta o dot-matrix, o calendario e o
 * card de 7 dias sem carregar todas as series na memoria.
 */
export async function volumeByDate(fromKey: string, toKey: string): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string; volume: number }>(
    `SELECT s.date AS date, COALESCE(SUM(ss.reps * ss.weight_kg), 0) AS volume
       FROM sessions s
       LEFT JOIN session_sets ss
         ON ss.session_id = s.id AND ss.done = 1 AND ss.deleted_at IS NULL
      WHERE s.deleted_at IS NULL AND s.date BETWEEN ? AND ?
      GROUP BY s.date`,
    fromKey,
    toKey,
  );
  return new Map(rows.map((row) => [row.date, row.volume]));
}

/** Datas com treino registrado, para os pontos do calendario. */
export async function trainedDates(fromKey: string, toKey: string): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT DISTINCT date FROM sessions WHERE deleted_at IS NULL AND date BETWEEN ? AND ?',
    fromKey,
    toKey,
  );
  return new Set(rows.map((row) => row.date));
}

export type ExerciseRecord = {
  exerciseId: string;
  exerciseName: string;
  heaviestKg: number;
  bestVolume: number;
};

export async function listExerciseRecords(): Promise<ExerciseRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    exercise_id: string;
    exercise_name: string;
    heaviest: number;
    best_volume: number;
  }>(
    `SELECT ss.exercise_id            AS exercise_id,
            e.name                    AS exercise_name,
            MAX(ss.weight_kg)         AS heaviest,
            MAX(ss.reps * ss.weight_kg) AS best_volume
       FROM session_sets ss
       JOIN exercises e ON e.id = ss.exercise_id
      WHERE ss.done = 1 AND ss.deleted_at IS NULL AND e.deleted_at IS NULL
      GROUP BY ss.exercise_id, e.name
      ORDER BY heaviest DESC`,
  );
  return rows.map((row) => ({
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    heaviestKg: row.heaviest,
    bestVolume: row.best_volume,
  }));
}

// ------------------------------------------------------------------ interno

async function softDelete(table: SyncedTable, id: string): Promise<void> {
  const db = await getDb();
  const timestamp = now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      timestamp,
      timestamp,
      id,
    );
    await enqueue(db, table, id);
  });
}

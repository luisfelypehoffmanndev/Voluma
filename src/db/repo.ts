import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  BodyWeightLog,
  Exercise,
  Routine,
  RoutineExercise,
  ExerciseKind,
  Session,
  SessionSet,
  Targets,
  Weekday,
  WeekTarget,
} from '@/domain/types';
import { runTargetsFromSets } from '@/domain/run';
import { resolveTargets, targetsFromSets } from '@/domain/targets';
import { toDateKey, weekStartKey } from '@/domain/week';

import { getDb } from './client';
import type { SyncedTable } from './schema';
import {
  toBodyWeightLog,
  toExercise,
  toRoutine,
  toRoutineExercise,
  toSession,
  toSessionSet,
  toWeekTarget,
  type BodyWeightLogRow,
  type ExerciseRow,
  type RoutineExerciseRow,
  type RoutineRow,
  type SessionRow,
  type SessionSetRow,
  type WeekTargetRow,
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

export async function createExercise(
  name: string,
  muscleGroup?: string,
  kind: ExerciseKind = 'strength',
): Promise<Exercise> {
  const db = await getDb();
  const exercise: Exercise = {
    id: newId(),
    name: name.trim(),
    muscleGroup: muscleGroup?.trim() || null,
    kind,
    updatedAt: now(),
    deletedAt: null,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO exercises (id, name, muscle_group, kind, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL)',
      exercise.id,
      exercise.name,
      exercise.muscleGroup,
      exercise.kind,
      exercise.updatedAt,
    );
    await enqueue(db, 'exercises', exercise.id);
  });

  return exercise;
}

/**
 * O exercicio de corrida, criando-o se ainda nao existir.
 *
 * A corrida e um item fixo do catalogo, nao um tipo que qualquer exercicio
 * possa ter: existe uma linha so, com `kind = 'run'`, e e ela que aparece no
 * seletor com os campos de distancia e tempo.
 *
 * Nasce sob demanda em vez de vir na migracao porque a migracao teria que
 * inventar um uuid em SQL puro, e porque assim ela some de vez se o usuario
 * apagar — sem reaparecer no proximo boot.
 */
export async function ensureRunExercise(): Promise<Exercise> {
  const db = await getDb();
  const existing = await db.getFirstAsync<ExerciseRow>(
    "SELECT * FROM exercises WHERE kind = 'run' AND deleted_at IS NULL ORDER BY updated_at, id LIMIT 1",
  );
  if (existing) return toExercise(existing);
  return createExercise('Corrida', 'Cardio', 'run');
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

/**
 * A rotina de um dia da semana, criando-a se ainda nao existir.
 *
 * Os sete dias sao sintetizados na leitura (`weekPlan`), nao gravados de
 * antemao: sete linhas vazias subiriam para o Supabase e voltariam em todo
 * aparelho, inclusive dias que o usuario nunca vai usar, e ainda calariam o
 * `seedIfEmpty`, cuja guarda e "ja existe alguma rotina?".
 *
 * O preco e este: toda escrita num dia passa por aqui primeiro, para ter um
 * `routine_id`. A busca e a criacao ficam na mesma transacao porque dois toques
 * rapidos em "adicionar exercicio" num dia vazio criariam duas rotinas para o
 * mesmo dia — exatamente a duplicata que a migracao v2 existe para limpar.
 */
export async function ensureDayRoutine(weekday: Weekday): Promise<Routine> {
  const db = await getDb();
  let routine: Routine | null = null;

  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<RoutineRow>(
      `SELECT * FROM routines
        WHERE weekday = ? AND deleted_at IS NULL
        ORDER BY position, updated_at, id
        LIMIT 1`,
      weekday,
    );
    if (existing) {
      routine = toRoutine(existing);
      return;
    }

    // Nome vazio e legitimo: o dia so ganha rotulo se o usuario quiser um. A
    // tela mostra o nome do proprio dia enquanto isso.
    const created: Routine = {
      id: newId(),
      name: '',
      weekday,
      position: 0,
      updatedAt: now(),
      deletedAt: null,
    };
    await db.runAsync(
      'INSERT INTO routines (id, name, weekday, position, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL)',
      created.id,
      created.name,
      created.weekday,
      created.position,
      created.updatedAt,
    );
    await enqueue(db, 'routines', created.id);
    routine = created;
  });

  // A transacao sempre atribui, mas o TS nao sabe disso.
  if (!routine) throw new Error(`Nao foi possivel abrir o dia ${weekday}`);
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

export type RoutineExerciseWithName = RoutineExercise & {
  exerciseName: string;
  exerciseKind: ExerciseKind;
};

export async function listRoutineExercises(
  routineId: string,
): Promise<RoutineExerciseWithName[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<
    RoutineExerciseRow & { exercise_name: string; exercise_kind: string }
  >(
    `SELECT re.*, e.name AS exercise_name, e.kind AS exercise_kind
       FROM routine_exercises re
       JOIN exercises e ON e.id = re.exercise_id
      WHERE re.routine_id = ? AND re.deleted_at IS NULL AND e.deleted_at IS NULL
      ORDER BY re.position`,
    routineId,
  );
  return rows.map((row) => ({
    ...toRoutineExercise(row),
    exerciseName: row.exercise_name,
    exerciseKind: row.exercise_kind === 'run' ? 'run' : 'strength',
  }));
}

export async function addExerciseToRoutine(
  routineId: string,
  exerciseId: string,
  targets: Targets,
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
         (id, routine_id, exercise_id, position, target_sets, target_reps, target_weight_kg,
          target_distance_km, target_duration_min, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      id,
      routineId,
      exerciseId,
      last?.next ?? 0,
      targets.sets,
      targets.reps,
      targets.weightKg,
      targets.distanceKm,
      targets.durationMin,
      now(),
    );
    await enqueue(db, 'routine_exercises', id);
  });
}

export async function updateRoutineExercise(
  id: string,
  targets: Targets,
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE routine_exercises
          SET target_sets = ?, target_reps = ?, target_weight_kg = ?,
              target_distance_km = ?, target_duration_min = ?, updated_at = ?
        WHERE id = ?`,
      targets.sets,
      targets.reps,
      targets.weightKg,
      targets.distanceKm,
      targets.durationMin,
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

// ------------------------------------------------------- alvos de uma semana

/** De qual degrau da cascata sairam os numeros — a tela mostra isso ao usuario. */
export type TargetSource = 'override' | 'lastActual' | 'plan';

/** Um exercicio do dia com os numeros ja resolvidos para uma semana. */
export type WeekExercise = RoutineExerciseWithName & {
  targets: Targets;
  source: TargetSource;
};

/**
 * Os alvos de UM exercicio na ultima vez que ele foi treinado antes de `before`.
 *
 * Duas leituras em vez de uma: a primeira acha a sessao, a segunda le as series
 * dela. Um `GROUP BY` sozinho nao resolve porque `reps` e `weight_kg` tem que
 * sair da mesma serie (a ultima), e nao de agregados independentes.
 *
 * Tres filtros que parecem redundantes e nao sao. `finished_at IS NOT NULL`
 * exclui o treino em andamento; `deleted_at IS NULL` aproveita que
 * `finishSession` soft-deleta toda serie que ficou desmarcada; e `done = 1`
 * pega o caso que escapa dos dois — desmarcar uma serie DEPOIS de finalizar o
 * treino deixa uma linha viva com `done = 0`, que e alvo, nao carga levantada.
 *
 * A ordenacao prefere o mesmo dia da semana (`s.routine_id`) quando ele e
 * recente. Sem isso, quem faz agachamento pesado na segunda e leve na quinta
 * veria a segunda herdar a carga da quinta so por ela ter sido mais recente.
 * Passados 35 dias sem treinar aquele dia, a preferencia cai e vale a execucao
 * mais recente, seja de que dia for — melhor um numero de outro dia do que
 * voltar para a semente de meses atras.
 *
 * O piso de 365 dias e o unico limite: "semana passada" quer dizer a ultima vez
 * que treinei isso, nao literalmente sete dias atras — quem pulou a segunda
 * passada herda da segunda anterior aquela. Mais de um ano ja e arqueologia, e
 * ai vale a semente do dia.
 */
async function lastPerformedTargets(
  db: SQLiteDatabase,
  exerciseId: string,
  kind: ExerciseKind,
  routineId: string,
  before: string,
): Promise<Targets | null> {
  const session = await db.getFirstAsync<{ session_id: string }>(
    `SELECT ss.session_id AS session_id
       FROM session_sets ss
       JOIN sessions s ON s.id = ss.session_id
      WHERE ss.exercise_id = ?
        AND ss.done = 1
        AND ss.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND s.finished_at IS NOT NULL
        AND s.date < ?
        AND s.date >= date(?, '-365 days')
      GROUP BY s.id
      ORDER BY CASE WHEN s.routine_id = ? AND s.date >= date(?, '-35 days')
                    THEN 0 ELSE 1 END,
               s.date DESC,
               s.started_at DESC
      LIMIT 1`,
    exerciseId,
    before,
    before,
    routineId,
    before,
  );
  if (!session) return null;

  const sets = await db.getAllAsync<{
    set_index: number;
    reps: number;
    weight_kg: number;
    distance_km: number;
    duration_min: number;
  }>(
    `SELECT set_index, reps, weight_kg, distance_km, duration_min
       FROM session_sets
      WHERE session_id = ? AND exercise_id = ? AND done = 1 AND deleted_at IS NULL`,
    session.session_id,
    exerciseId,
  );

  // Corrida soma as series (3 km + 2 km = 5 km); carga pega a ultima serie. As
  // duas regras vivem em `@/domain/run` e `@/domain/targets`, testadas la.
  if (kind === 'run') {
    return runTargetsFromSets(
      sets.map((set) => ({
        distanceKm: set.distance_km,
        durationMin: set.duration_min,
        done: true,
      })),
    );
  }

  return targetsFromSets(
    sets.map((set) => ({ setIndex: set.set_index, reps: set.reps, weightKg: set.weight_kg })),
  );
}

/**
 * Os exercicios de um dia com os numeros daquela semana ja resolvidos.
 *
 * A semana nao e materializada: sem ajuste do usuario nao existe linha nenhuma
 * e o valor sai do historico na hora. E o que faz "vem como semana passada" ser
 * literalmente verdade em vez de um estado velho esperando correcao.
 */
export async function targetsForWeek(
  weekStart: string,
  routineId: string,
): Promise<WeekExercise[]> {
  const db = await getDb();
  const planned = await listRoutineExercises(routineId);

  // ORDER BY + Map: sem indice unico, o sync pode deixar duas linhas para o
  // mesmo slot. A ultima gravacao vence, e o `set` sobrescreve o que veio antes
  // porque a ordem crescente coloca a mais nova no fim.
  const overrides = await db.getAllAsync<WeekTargetRow>(
    `SELECT * FROM week_targets
      WHERE week_start = ? AND deleted_at IS NULL
      ORDER BY updated_at ASC, id ASC`,
    weekStart,
  );
  const bySlot = new Map<string, WeekTarget>();
  for (const row of overrides) bySlot.set(row.routine_exercise_id, toWeekTarget(row));

  const resolved: WeekExercise[] = [];
  for (const item of planned) {
    const override = bySlot.get(item.id) ?? null;
    const performed = override
      ? null // ja tem decisao explicita; nao gasta consulta com o historico
      : await lastPerformedTargets(db, item.exerciseId, item.exerciseKind, routineId, weekStart);

    const overrideTargets = override
      ? {
          sets: override.targetSets,
          reps: override.targetReps,
          weightKg: override.targetWeightKg,
          distanceKm: override.targetDistanceKm,
          durationMin: override.targetDurationMin,
        }
      : null;

    resolved.push({
      ...item,
      source: overrideTargets ? 'override' : performed ? 'lastActual' : 'plan',
      targets: resolveTargets(overrideTargets, performed, {
        sets: item.targetSets,
        reps: item.targetReps,
        weightKg: item.targetWeightKg,
        distanceKm: item.targetDistanceKm,
        durationMin: item.targetDurationMin,
      }),
    });
  }

  return resolved;
}

/**
 * Grava o ajuste do usuario para uma semana.
 *
 * Procura a linha e decide entre UPDATE e INSERT, em vez do `ON CONFLICT` que
 * seria natural: sem indice unico (ver o comentario da migracao v2) nao ha
 * conflito para o SQLite detectar. Reaproveitar o id existente e justamente o
 * que mantem os aparelhos convergindo — gravar um id novo a cada toque criaria
 * uma linha nova por edicao.
 *
 * Se o sync ja deixou duplicatas, a mais recente e a que sobrevive ao UPDATE;
 * as outras continuam la, inertes, porque a leitura so olha a ultima.
 */
export async function setWeekTarget(
  weekStart: string,
  routineExerciseId: string,
  targets: Targets,
): Promise<void> {
  const db = await getDb();
  const timestamp = now();

  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM week_targets
        WHERE week_start = ? AND routine_exercise_id = ?
        ORDER BY updated_at DESC, id ASC
        LIMIT 1`,
      weekStart,
      routineExerciseId,
    );

    const id = existing?.id ?? newId();
    if (existing) {
      await db.runAsync(
        `UPDATE week_targets
            SET target_sets = ?, target_reps = ?, target_weight_kg = ?,
                target_distance_km = ?, target_duration_min = ?,
                updated_at = ?, deleted_at = NULL
          WHERE id = ?`,
        targets.sets,
        targets.reps,
        targets.weightKg,
        targets.distanceKm,
        targets.durationMin,
        timestamp,
        id,
      );
    } else {
      await db.runAsync(
        `INSERT INTO week_targets
           (id, week_start, routine_exercise_id, target_sets, target_reps, target_weight_kg,
            target_distance_km, target_duration_min, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        id,
        weekStart,
        routineExerciseId,
        targets.sets,
        targets.reps,
        targets.weightKg,
        targets.distanceKm,
        targets.durationMin,
        timestamp,
      );
    }
    await enqueue(db, 'week_targets', id);
  });
}

/** Desfaz o ajuste de uma semana: o exercicio volta a herdar do historico. */
export async function clearWeekTarget(
  weekStart: string,
  routineExerciseId: string,
): Promise<void> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM week_targets WHERE week_start = ? AND routine_exercise_id = ? AND deleted_at IS NULL',
    weekStart,
    routineExerciseId,
  );
  for (const row of rows) await softDelete('week_targets', row.id);
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

  // Os alvos saem da semana do treino, nao do plano estatico: e o que faz a
  // sessao ja nascer com o peso que o usuario levantou da ultima vez.
  const planned = routineId ? await targetsForWeek(weekStartKey(when), routineId) : [];

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
      // Corrida entra como UMA linha, com a distancia e o tempo alvo. Repetir a
      // corrida em N linhas como se fossem series multiplicaria a quilometragem
      // do dia pelo numero de series.
      const rows = item.exerciseKind === 'run' ? 1 : item.targets.sets;

      for (let index = 1; index <= rows; index += 1) {
        const setId = newId();
        await db.runAsync(
          `INSERT INTO session_sets
             (id, session_id, exercise_id, set_index, reps, weight_kg,
              distance_km, duration_min, done, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL)`,
          setId,
          session.id,
          item.exerciseId,
          index,
          item.targets.reps,
          item.targets.weightKg,
          item.targets.distanceKm,
          item.targets.durationMin,
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
  patch: {
    reps?: number;
    weightKg?: number;
    distanceKm?: number;
    durationMin?: number;
    done?: boolean;
  },
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
    if (patch.distanceKm !== undefined) {
      await db.runAsync(
        'UPDATE session_sets SET distance_km = ? WHERE id = ?',
        patch.distanceKm,
        id,
      );
    }
    if (patch.durationMin !== undefined) {
      await db.runAsync(
        'UPDATE session_sets SET duration_min = ? WHERE id = ?',
        patch.durationMin,
        id,
      );
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
  targets: Targets,
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

    // Corrida ocupa uma linha so, pelo mesmo motivo de `startSession`: repetir
    // a distancia em N series multiplicaria a quilometragem do dia.
    const rows = targets.distanceKm > 0 ? 1 : targets.sets;

    for (let index = 1; index <= rows; index += 1) {
      const setId = newId();
      await db.runAsync(
        `INSERT INTO session_sets
           (id, session_id, exercise_id, set_index, reps, weight_kg,
            distance_km, duration_min, done, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL)`,
        setId,
        sessionId,
        exerciseId,
        offset + index,
        targets.reps,
        targets.weightKg,
        targets.distanceKm,
        targets.durationMin,
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
    const last = await db.getFirstAsync<{
      set_index: number;
      reps: number;
      weight_kg: number;
      distance_km: number;
      duration_min: number;
    }>(
      `SELECT set_index, reps, weight_kg, distance_km, duration_min FROM session_sets
        WHERE session_id = ? AND exercise_id = ? AND deleted_at IS NULL
        ORDER BY set_index DESC LIMIT 1`,
      sessionId,
      exerciseId,
    );
    await db.runAsync(
      `INSERT INTO session_sets
         (id, session_id, exercise_id, set_index, reps, weight_kg,
          distance_km, duration_min, done, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL)`,
      id,
      sessionId,
      exerciseId,
      (last?.set_index ?? 0) + 1,
      last?.reps ?? 10,
      last?.weight_kg ?? 0,
      last?.distance_km ?? 0,
      last?.duration_min ?? 0,
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

/**
 * Quilometros percorridos por data — o par do `volumeByDate` para a corrida.
 *
 * Consulta separada em vez de mais uma coluna no volume: o volume e em kg e a
 * distancia em km, e somar os dois num numero so nao quer dizer nada. Cada um
 * tem seu card.
 */
export async function distanceByDate(
  fromKey: string,
  toKey: string,
): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string; distance: number }>(
    `SELECT s.date AS date, COALESCE(SUM(ss.distance_km), 0) AS distance
       FROM sessions s
       LEFT JOIN session_sets ss
         ON ss.session_id = s.id AND ss.done = 1 AND ss.deleted_at IS NULL
      WHERE s.deleted_at IS NULL AND s.date BETWEEN ? AND ?
      GROUP BY s.date`,
    fromKey,
    toKey,
  );
  return new Map(rows.map((row) => [row.date, row.distance]));
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

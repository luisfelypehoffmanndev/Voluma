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
import { fromDateKey, toDateKey, weekStartKey, weekdayOf } from '@/domain/week';

import { pickCanonicalRun, RUN_EXERCISE_NAME } from './canonical';
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

/**
 * Irma de `enqueue`, para quando VARIAS linhas de `table` mudaram na mesma
 * escrita e ja tem uma clausula SQL que as identifica (em vez de uma lista de
 * ids em mao).
 *
 * Um round-trip so, via `INSERT ... SELECT`, em vez de coletar ids em JS e
 * enfileirar um a um — e exatamente o padrao que tornava
 * `setSessionExerciseTargets`/`setSessionExerciseSets` sequenciais (ver o
 * comentario delas). `table` vem de `SyncedTable` (uniao fechada de literais,
 * nunca de entrada do usuario), entao interpolar o nome dela e seguro — mesmo
 * padrao que `softDelete`, logo abaixo, ja usa. `where`/`params` seguem o
 * contrato normal de bind params: nunca concatenar VALOR nenhum na string.
 */
async function enqueueWhere(
  db: SQLiteDatabase,
  table: SyncedTable,
  where: string,
  params: readonly (string | number)[],
  queuedAt: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO outbox (table_name, row_id, queued_at)
     SELECT ?, id, ? FROM ${table} WHERE ${where}`,
    table,
    queuedAt,
    ...params,
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
 * A corrida e um item fixo do catalogo: e ela que o botao "Adicionar corrida"
 * da tela do dia poe na rotina, com os campos de distancia e tempo.
 *
 * Nasce sob demanda em vez de vir na migracao porque a migracao teria que
 * inventar um uuid em SQL puro, e porque assim ela some de vez se o usuario
 * apagar — sem reaparecer no proximo boot.
 *
 * A escolha entre os candidatos fica em `pickCanonicalRun`, que e pura e
 * testavel: o SQL traz os medidos em distancia e tempo (um punhado de linhas,
 * sem custo em trazer todas) e a regra de qual deles e a corrida mora la.
 */
export async function ensureRunExercise(): Promise<Exercise> {
  const db = await getDb();
  const candidates = await db.getAllAsync<ExerciseRow>(
    `SELECT * FROM exercises WHERE kind = 'run' AND deleted_at IS NULL`,
  );
  const existing = pickCanonicalRun(candidates);
  if (existing) return toExercise(existing);
  return createExercise(RUN_EXERCISE_NAME, 'Cardio', 'run');
}

/**
 * Em quantos dias da semana cada exercicio aparece.
 *
 * O catalogo usa isso para avisar antes de apagar: um movimento que esta em
 * tres dias some dos tres de uma vez, e o soft delete nao pergunta.
 *
 * Conta dias distintos e nao linhas de `routine_exercises` porque e o dia que o
 * usuario reconhece — "esta na segunda e na sexta", nao "tem 2 vinculos".
 */
export async function exerciseDayCounts(): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ exercise_id: string; days: number }>(
    `SELECT re.exercise_id AS exercise_id, COUNT(DISTINCT r.weekday) AS days
       FROM routine_exercises re
       JOIN routines r ON r.id = re.routine_id
      WHERE re.deleted_at IS NULL AND r.deleted_at IS NULL
      GROUP BY re.exercise_id`,
  );
  return new Map(rows.map((row) => [row.exercise_id, row.days]));
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
 * aparelho, inclusive dias que o usuario nunca vai usar, e ainda confundiriam
 * o `isFirstRun` do onboarding, cuja guarda e "ja existe alguma rotina?".
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

  // Uma consulta por exercicio, mas em PARALELO — nao uma esperando a
  // anterior. Esta funcao roda de novo a cada `bumpData` (todo `write` de
  // checkbox chama um), entao um treino de sete exercicios em serie somava
  // sete idas e voltas ao SQLite a cada toque; em paralelo o tempo total vira
  // o da mais lenta, nao a soma de todas.
  const resolved: WeekExercise[] = await Promise.all(
    planned.map(async (item) => {
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

      return {
        ...item,
        source: overrideTargets ? 'override' : performed ? 'lastActual' : 'plan',
        targets: resolveTargets(overrideTargets, performed, {
          sets: item.targetSets,
          reps: item.targetReps,
          weightKg: item.targetWeightKg,
          distanceKm: item.targetDistanceKm,
          durationMin: item.targetDurationMin,
        }),
      };
    }),
  );

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
 * O treino de uma data, criando-o se ainda nao existir.
 *
 * Nao materializa serie nenhuma, ao contrario de `startSession`: a tela de
 * registro le os alvos da semana via `targetsForWeek` e so grava linha quando o
 * usuario mexe num stepper. Materializar aqui gravaria como "levantado" um
 * treino que o usuario apenas abriu.
 *
 * Nasce com `finished_at` igual ao `started_at` porque nao ha mais treino em
 * andamento — a tela e edicao direta, nao cronometro. Sem isso o registro
 * sumiria de `lastPerformedTargets`, que exige `finished_at IS NOT NULL`, e a
 * cascata nunca herdaria o que acabou de ser registrado.
 *
 * `ensureDayRoutine` garante a rotina do dia mesmo para quem nunca abriu
 * Ajustes: sem `routine_id` a sessao nao teria de onde tirar os exercicios.
 */
export async function getOrCreateSessionForDate(when = new Date()): Promise<Session> {
  const dateKey = toDateKey(when);
  const existing = await getSessionByDate(dateKey);
  if (existing) return existing;

  // Fora da transacao de proposito: `ensureDayRoutine` abre a sua propria, e o
  // SQLite nao aninha.
  const routine = await ensureDayRoutine(weekdayOf(when));

  const db = await getDb();
  const timestamp = now();
  const session: Session = {
    id: newId(),
    routineId: routine.id,
    date: dateKey,
    startedAt: when.toISOString(),
    finishedAt: when.toISOString(),
    skippedExerciseIds: [],
    exerciseOrder: [],
    completedAt: null,
    updatedAt: timestamp,
    deletedAt: null,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO sessions (id, routine_id, date, started_at, finished_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      session.id,
      session.routineId,
      session.date,
      session.startedAt,
      session.finishedAt,
      session.updatedAt,
    );
    await enqueue(db, 'sessions', session.id);
  });

  return session;
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
    skippedExerciseIds: [],
    exerciseOrder: [],
    completedAt: null,
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

/**
 * Tira um exercicio SO deste treino ("Pular hoje"). O plano da semana nao muda.
 *
 * O que ja estava gravado dele nesta sessao e DESMARCADO, nao apagado. Pular e
 * dizer "nao fiz", entao nada dele pode continuar somando no volume ou virar
 * "ultima vez" na cascata — e as duas leituras ja exigem `done = 1`. Apagar
 * resolveria o mesmo, mas quebraria o "Desfazer" de um exercicio que so existe
 * nesta sessao (adicionado "so hoje"): sem series e fora do plano, ele nao
 * teria de onde voltar.
 */
export async function skipSessionExercise(sessionId: string, exerciseId: string): Promise<void> {
  await updateSkipped(sessionId, (ids) => (ids.includes(exerciseId) ? ids : [...ids, exerciseId]));

  const db = await getDb();
  const timestamp = now();
  await db.withTransactionAsync(async () => {
    const where = 'session_id = ? AND exercise_id = ? AND done = 1 AND deleted_at IS NULL';
    await enqueueWhere(db, 'session_sets', where, [sessionId, exerciseId], timestamp);
    await db.runAsync(
      `UPDATE session_sets SET done = 0, updated_at = ? WHERE ${where}`,
      timestamp,
      sessionId,
      exerciseId,
    );
  });
}

/** O "Desfazer" de `skipSessionExercise`. */
export async function unskipSessionExercise(sessionId: string, exerciseId: string): Promise<void> {
  await updateSkipped(sessionId, (ids) => ids.filter((id) => id !== exerciseId));
}

/** A ordem arrastada na tela do treino. Vale so para esta sessao; o plano nao muda. */
export async function setSessionExerciseOrder(
  sessionId: string,
  exerciseIds: readonly string[],
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE sessions SET exercise_order = ?, updated_at = ? WHERE id = ?',
      JSON.stringify(exerciseIds),
      now(),
      sessionId,
    );
    await enqueue(db, 'sessions', sessionId);
  });
}

async function updateSkipped(
  sessionId: string,
  change: (ids: string[]) => string[],
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<SessionRow>('SELECT * FROM sessions WHERE id = ?', sessionId);
    if (!row) return;
    const timestamp = now();
    await db.runAsync(
      'UPDATE sessions SET skipped_exercise_ids = ?, updated_at = ? WHERE id = ?',
      JSON.stringify(change(toSession(row).skippedExerciseIds)),
      timestamp,
      sessionId,
    );
    await enqueue(db, 'sessions', sessionId);
  });
}

/**
 * "Finalizar treino": o que `finishSession` ja fazia (descartar series nunca
 * marcadas) mais `completed_at`, que e o marcador que a home e o resultado leem.
 *
 * `finished_at` nao serve de marcador porque `getOrCreateSessionForDate` ja cria
 * a sessao com ele preenchido — ver o comentario de la.
 */
export async function completeSession(id: string): Promise<void> {
  await finishSession(id);
  const db = await getDb();
  const timestamp = now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE sessions SET completed_at = ?, updated_at = ? WHERE id = ?',
      timestamp,
      timestamp,
      id,
    );
    await enqueue(db, 'sessions', id);
  });
}

/**
 * O volume do treino anterior a `dateKey` que caiu no mesmo dia da semana e
 * levantou alguma carga. `null` se nao houver nenhum.
 *
 * "Levantou alguma carga" pula a segunda em que o usuario so abriu o treino e
 * saiu: comparar contra zero diria "▲ infinito". O dia da semana e filtrado em
 * JS e nao por `strftime('%w')`, porque `date` e a data LOCAL do usuario e o
 * SQLite a leria como UTC.
 */
export async function previousVolumeSameWeekday(dateKey: string): Promise<number | null> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string; volume: number }>(
    `SELECT s.date AS date, SUM(ss.reps * ss.weight_kg) AS volume
       FROM sessions s
       JOIN session_sets ss
         ON ss.session_id = s.id AND ss.done = 1 AND ss.deleted_at IS NULL
      WHERE s.deleted_at IS NULL AND s.date < ?
      GROUP BY s.date
     HAVING volume > 0
      ORDER BY s.date DESC
      LIMIT 60`,
    dateKey,
  );
  const weekday = weekdayOf(fromDateKey(dateKey));
  const match = rows.find((row) => weekdayOf(fromDateKey(row.date)) === weekday);
  return match ? match.volume : null;
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

  // Uma UPDATE so, com as colunas presentes em `patch` — nao uma por campo.
  // Nomes de coluna sao literais fixos, incluidos condicionalmente; os
  // VALORES sempre vao por bind param, nunca concatenados na string.
  const assignments: string[] = [];
  const values: (string | number)[] = [];
  if (patch.reps !== undefined) {
    assignments.push('reps = ?');
    values.push(patch.reps);
  }
  if (patch.weightKg !== undefined) {
    assignments.push('weight_kg = ?');
    values.push(patch.weightKg);
  }
  if (patch.distanceKm !== undefined) {
    assignments.push('distance_km = ?');
    values.push(patch.distanceKm);
  }
  if (patch.durationMin !== undefined) {
    assignments.push('duration_min = ?');
    values.push(patch.durationMin);
  }
  if (patch.done !== undefined) {
    assignments.push('done = ?');
    values.push(patch.done ? 1 : 0);
  }
  assignments.push('updated_at = ?');
  values.push(timestamp);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE session_sets SET ${assignments.join(', ')} WHERE id = ?`,
      ...values,
      id,
    );
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

/**
 * Grava o que foi feito de UM exercicio num treino, de uma vez.
 *
 * O modelo da tela de registro e por exercicio, nao por serie: o usuario diz
 * "3 x 10 a 60 kg" e nao marca cada serie. Entao a escrita substitui o
 * exercicio inteiro — apaga as linhas que existiam e insere `targets.sets`
 * linhas iguais — em vez de tentar casar serie a serie. Sem isso, baixar de 4
 * para 3 series deixaria a quarta viva no historico.
 *
 * `done` e o que separa "anotei os numeros" de "levantei isso". Desmarcar grava
 * as mesmas linhas com `done = 0` em vez de apaga-las: assim os numeros
 * ajustados sobrevivem ao desmarcar, e nem o volume (`setVolume`) nem a cascata
 * (`lastPerformedTargets`) os enxergam, porque as duas exigem `done = 1`.
 *
 * Corrida ocupa uma linha so, mesma regra de `startSession` — repetir a
 * distancia em N series multiplicaria a quilometragem do dia.
 */
export async function setSessionExerciseTargets(
  sessionId: string,
  exerciseId: string,
  kind: ExerciseKind,
  targets: Targets,
  done: boolean,
): Promise<void> {
  const db = await getDb();
  const timestamp = now();
  const rows = kind === 'run' ? 1 : Math.max(0, Math.floor(targets.sets));

  await db.withTransactionAsync(async () => {
    // Soft-delete em lote: uma UPDATE so para todas as linhas do exercicio,
    // em vez de um SELECT de ids seguido de uma UPDATE + um enqueue por linha
    // (o N+1 sequencial que deixava o toggle "concluido" lento — ver o
    // comentario de `setSessionExerciseSets`, irma desta funcao).
    await db.runAsync(
      `UPDATE session_sets SET deleted_at = ?, updated_at = ?
        WHERE session_id = ? AND exercise_id = ? AND deleted_at IS NULL`,
      timestamp,
      timestamp,
      sessionId,
      exerciseId,
    );
    // `timestamp` e unico por chamada (um so `await now()` por escrita), entao
    // filtrar por ele aqui re-seleciona exatamente as linhas que a UPDATE
    // acima acabou de tocar, escopadas pelo mesmo par sessao/exercicio.
    await enqueueWhere(
      db,
      'session_sets',
      'session_id = ? AND exercise_id = ? AND deleted_at = ?',
      [sessionId, exerciseId, timestamp],
      timestamp,
    );

    if (rows > 0) {
      // Idem para a reinsercao: um INSERT multi-linha so, com os ids gerados
      // em JS antes. `rows` nunca passa de umas poucas dezenas numa sessao
      // real (SQLite aceita ate SQLITE_MAX_VARIABLE_NUMBER bind params por
      // statement, 999 no pior caso — 10 por linha aqui, entao havia margem
      // de sobra).
      const setIds = Array.from({ length: rows }, () => newId());
      const placeholders = setIds.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)').join(', ');
      const values: (string | number)[] = [];
      setIds.forEach((setId, index) => {
        values.push(
          setId,
          sessionId,
          exerciseId,
          index + 1,
          targets.reps,
          targets.weightKg,
          targets.distanceKm,
          targets.durationMin,
          done ? 1 : 0,
          timestamp,
        );
      });
      await db.runAsync(
        `INSERT INTO session_sets
           (id, session_id, exercise_id, set_index, reps, weight_kg,
            distance_km, duration_min, done, updated_at, deleted_at)
         VALUES ${placeholders}`,
        ...values,
      );
      await enqueueWhere(
        db,
        'session_sets',
        'session_id = ? AND exercise_id = ? AND deleted_at IS NULL AND updated_at = ?',
        [sessionId, exerciseId, timestamp],
        timestamp,
      );
    }
  });
}

/**
 * Serie extra, alem do que a rotina planejava. Copia os valores da ultima.
 *
 * `done` nasce `false` por padrao — o caso comum e adicionar antes de marcar o
 * exercicio. Quando o exercicio ja esta concluido (o editor por serie da tela
 * de sessao chama isto com `done: true`), a serie nova precisa nascer marcada:
 * do contrario o exercicio ficaria com uma serie "pendente" no meio de um
 * grupo que a UI ja mostra como feito.
 *
 * Devolve a linha recem-criada porque quem chama (o rascunho local da tela)
 * precisa do `id` real para poder editar essa serie logo em seguida — sem ele,
 * um toque no peso dela um segundo depois de adicionada nao teria onde
 * gravar.
 */
export async function addSet(
  sessionId: string,
  exerciseId: string,
  done = false,
): Promise<{ id: string; setIndex: number; reps: number; weightKg: number }> {
  const db = await getDb();
  const id = newId();

  let created!: { id: string; setIndex: number; reps: number; weightKg: number };

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
    const setIndex = (last?.set_index ?? 0) + 1;
    const reps = last?.reps ?? 10;
    const weightKg = last?.weight_kg ?? 0;

    await db.runAsync(
      `INSERT INTO session_sets
         (id, session_id, exercise_id, set_index, reps, weight_kg,
          distance_km, duration_min, done, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      id,
      sessionId,
      exerciseId,
      setIndex,
      reps,
      weightKg,
      last?.distance_km ?? 0,
      last?.duration_min ?? 0,
      done ? 1 : 0,
      now(),
    );
    await enqueue(db, 'session_sets', id);
    created = { id, setIndex, reps, weightKg };
  });

  return created;
}

export async function removeSet(id: string): Promise<void> {
  await softDelete('session_sets', id);
}

/**
 * Grava o que foi feito de UM exercicio de musculacao num treino, serie a
 * serie.
 *
 * Irma de `setSessionExerciseTargets`, mas aceita reps/carga divergentes por
 * serie — o modelo uniforme daquela funcao (um par repetido em todas as
 * linhas) nao comporta rampa de aquecimento nem carga que varia ao longo do
 * exercicio. Mesma estrategia de escrita, pelo mesmo motivo: apaga as linhas
 * do exercicio e reinsere, em vez de casar serie a serie por id — do
 * contrario baixar de 4 para 3 series deixaria a quarta viva no historico, e
 * casar por posicao arriscaria escrever a carga da serie 2 na 3 se uma delas
 * tivesse sido removida no meio.
 *
 * So serve exercicio de carga: corrida continua por `setSessionExerciseTargets`,
 * que soma distancia e tempo numa linha so — fatiar isso em "serie" nao faz
 * sentido para ela.
 *
 * Devolve as linhas recem-inseridas, na mesma ordem de `rows`. Quem chama
 * precisa disso para trocar o rascunho local (que ainda tem `id: null` nas
 * series que nunca foram gravadas) pelos ids reais — sem isso, editar uma
 * serie logo depois de marcar o exercicio concluido nao encontraria linha
 * nenhuma para atualizar.
 */
export async function setSessionExerciseSets(
  sessionId: string,
  exerciseId: string,
  rows: readonly { reps: number; weightKg: number }[],
  done: boolean,
): Promise<{ id: string; setIndex: number; reps: number; weightKg: number }[]> {
  const db = await getDb();
  const timestamp = now();
  const inserted: { id: string; setIndex: number; reps: number; weightKg: number }[] = [];

  await db.withTransactionAsync(async () => {
    // Mesmo tratamento de `setSessionExerciseTargets`: uma UPDATE em lote em
    // vez de SELECT + (UPDATE + enqueue) por linha existente.
    await db.runAsync(
      `UPDATE session_sets SET deleted_at = ?, updated_at = ?
        WHERE session_id = ? AND exercise_id = ? AND deleted_at IS NULL`,
      timestamp,
      timestamp,
      sessionId,
      exerciseId,
    );
    await enqueueWhere(
      db,
      'session_sets',
      'session_id = ? AND exercise_id = ? AND deleted_at = ?',
      [sessionId, exerciseId, timestamp],
      timestamp,
    );

    if (rows.length > 0) {
      // `reps`/`weightKg` variam por linha aqui (rampa de aquecimento, carga
      // que muda ao longo do exercicio) — o que nao varia e o numero de
      // round-trips: um INSERT multi-linha so, como na funcao irma.
      const placeholders = rows.map(() => '(?, ?, ?, ?, ?, ?, 0, 0, ?, ?, NULL)').join(', ');
      const values: (string | number)[] = [];
      rows.forEach((row, index) => {
        const setId = newId();
        const setIndex = index + 1;
        values.push(setId, sessionId, exerciseId, setIndex, row.reps, row.weightKg, done ? 1 : 0, timestamp);
        inserted.push({ id: setId, setIndex, reps: row.reps, weightKg: row.weightKg });
      });
      await db.runAsync(
        `INSERT INTO session_sets
           (id, session_id, exercise_id, set_index, reps, weight_kg,
            distance_km, duration_min, done, updated_at, deleted_at)
         VALUES ${placeholders}`,
        ...values,
      );
      await enqueueWhere(
        db,
        'session_sets',
        'session_id = ? AND exercise_id = ? AND deleted_at IS NULL AND updated_at = ?',
        [sessionId, exerciseId, timestamp],
        timestamp,
      );
    }
  });

  return inserted;
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

import { DatabaseSync } from 'node:sqlite';

import { normalizeName } from '../catalog';
import { yieldLocalToAccount } from '../repo';
import { MIGRATIONS } from '../schema';

/**
 * `yieldLocalToAccount` contra um SQLite de verdade, em memoria, com o schema
 * das proprias migrations do app. O cenario e o de todo aparelho novo: o
 * onboarding criou catalogo e plano aqui (na outbox, nunca subiram), e o
 * primeiro pull trouxe os da conta.
 */

let mockDb: ReturnType<typeof adapter>;

jest.mock('../client', () => ({ getDb: async () => mockDb }));

/** A parte da API do expo-sqlite que o repo usa, por cima do node:sqlite. */
function adapter(db: DatabaseSync) {
  return {
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    runAsync: async (sql: string, ...params: (string | number | null)[]) => {
      db.prepare(sql).run(...params);
    },
    getAllAsync: async <T>(sql: string, ...params: (string | number | null)[]) =>
      db.prepare(sql).all(...params) as T[],
    getFirstAsync: async <T>(sql: string, ...params: (string | number | null)[]) =>
      (db.prepare(sql).get(...params) ?? null) as T | null,
    withTransactionAsync: async (task: () => Promise<void>) => {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

const T0 = '2026-01-01T00:00:00.000Z';
let raw: DatabaseSync;

function seed(sql: string) {
  raw.exec(sql);
}

/** Linhas criadas no aparelho: tambem entram na outbox, como o repo faz. */
function local(table: string, id: string) {
  raw.prepare('INSERT INTO outbox (table_name, row_id, queued_at) VALUES (?, ?, ?)').run(table, id, T0);
}

function row(table: string, id: string) {
  return raw.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Record<string, unknown>;
}

beforeEach(() => {
  raw = new DatabaseSync(':memory:');
  for (const migration of MIGRATIONS) raw.exec(migration);
  mockDb = adapter(raw);
});

afterEach(() => raw.close());

describe('aparelho novo entrando numa conta com dados', () => {
  beforeEach(() => {
    // Da conta (vieram no pull, nao estao na outbox).
    seed(`
      INSERT INTO exercises (id, name, updated_at) VALUES ('conta-supino', 'Supino reto', '${T0}');
      INSERT INTO routines (id, name, weekday, position, updated_at) VALUES ('conta-seg', 'Push', 1, 0, '${T0}');
      INSERT INTO routine_exercises (id, routine_id, exercise_id, updated_at)
        VALUES ('conta-seg-supino', 'conta-seg', 'conta-supino', '${T0}');
    `);
    // Do aparelho (o onboarding).
    seed(`
      INSERT INTO exercises (id, name, updated_at) VALUES
        ('local-supino', 'supino reto', '${T0}'),
        ('local-remada', 'Remada baixa', '${T0}');
      INSERT INTO routines (id, name, weekday, position, updated_at) VALUES
        ('local-seg', 'Push', 1, 0, '${T0}'),
        ('local-ter', 'Pull', 2, 0, '${T0}');
      INSERT INTO routine_exercises (id, routine_id, exercise_id, updated_at) VALUES
        ('local-seg-supino', 'local-seg', 'local-supino', '${T0}'),
        ('local-ter-supino', 'local-ter', 'local-supino', '${T0}'),
        ('local-ter-remada', 'local-ter', 'local-remada', '${T0}');
      INSERT INTO week_targets (id, week_start, routine_exercise_id, target_sets, target_reps, target_weight_kg, updated_at)
        VALUES ('local-ajuste', '2026-10-11', 'local-seg-supino', 4, 8, 60, '${T0}');
      INSERT INTO sessions (id, routine_id, date, started_at, updated_at, skipped_exercise_ids, exercise_order)
        VALUES ('local-treino', 'local-seg', '2026-10-12', '${T0}', '${T0}', '["local-supino"]', '["local-supino","local-remada"]');
      INSERT INTO session_sets (id, session_id, exercise_id, set_index, reps, weight_kg, done, updated_at)
        VALUES ('local-serie', 'local-treino', 'local-supino', 1, 10, 50, 1, '${T0}');
    `);
    for (const [table, id] of [
      ['exercises', 'local-supino'],
      ['exercises', 'local-remada'],
      ['routines', 'local-seg'],
      ['routines', 'local-ter'],
      ['routine_exercises', 'local-seg-supino'],
      ['routine_exercises', 'local-ter-supino'],
      ['routine_exercises', 'local-ter-remada'],
      ['week_targets', 'local-ajuste'],
      ['sessions', 'local-treino'],
      ['session_sets', 'local-serie'],
    ]) {
      local(table, id);
    }
  });

  it('o exercicio do aparelho cede ao da conta com o mesmo nome, e o resto continua', async () => {
    const result = await yieldLocalToAccount(normalizeName);

    expect(result).toEqual({ exercises: 1, routines: 1 });
    expect(row('exercises', 'local-supino').deleted_at).not.toBeNull();
    expect(row('exercises', 'local-remada').deleted_at).toBeNull();
    expect(row('exercises', 'conta-supino').deleted_at).toBeNull();
  });

  it('a serie, o plano e as listas do treino passam a apontar para o exercicio da conta', async () => {
    await yieldLocalToAccount(normalizeName);

    expect(row('session_sets', 'local-serie').exercise_id).toBe('conta-supino');
    expect(row('routine_exercises', 'local-ter-supino').exercise_id).toBe('conta-supino');
    const treino = row('sessions', 'local-treino');
    expect(JSON.parse(String(treino.skipped_exercise_ids))).toEqual(['conta-supino']);
    expect(JSON.parse(String(treino.exercise_order))).toEqual(['conta-supino', 'local-remada']);
  });

  it('a rotina do aparelho no mesmo dia cede, com exercicios e ajustes; o dia que a conta nao tem fica', async () => {
    await yieldLocalToAccount(normalizeName);

    expect(row('routines', 'local-seg').deleted_at).not.toBeNull();
    expect(row('routine_exercises', 'local-seg-supino').deleted_at).not.toBeNull();
    expect(row('week_targets', 'local-ajuste').deleted_at).not.toBeNull();
    expect(row('routines', 'local-ter').deleted_at).toBeNull();
    expect(row('routines', 'conta-seg').deleted_at).toBeNull();
    // O treino feito antes do login passa para a rotina da conta do mesmo dia.
    expect(row('sessions', 'local-treino').routine_id).toBe('conta-seg');
  });

  it('o que ja subiu nao e so do aparelho: com a outbox vazia, nada cede', async () => {
    raw.exec('DELETE FROM outbox');

    expect(await yieldLocalToAccount(normalizeName)).toEqual({ exercises: 0, routines: 0 });
    expect(row('exercises', 'local-supino').deleted_at).toBeNull();
    expect(row('routines', 'local-seg').deleted_at).toBeNull();
  });

  it('rodar de novo nao faz nada', async () => {
    await yieldLocalToAccount(normalizeName);
    expect(await yieldLocalToAccount(normalizeName)).toEqual({ exercises: 0, routines: 0 });
  });
});

it('conta sem dados: nada cede, e o que o aparelho criou sobe como esta', async () => {
  seed(`
    INSERT INTO exercises (id, name, updated_at) VALUES ('local-supino', 'Supino reto', '${T0}');
    INSERT INTO routines (id, name, weekday, position, updated_at) VALUES ('local-seg', 'Push', 1, 0, '${T0}');
  `);
  local('exercises', 'local-supino');
  local('routines', 'local-seg');

  expect(await yieldLocalToAccount(normalizeName)).toEqual({ exercises: 0, routines: 0 });
  expect(row('exercises', 'local-supino').deleted_at).toBeNull();
  expect(row('routines', 'local-seg').deleted_at).toBeNull();
});

it('cada linha que a troca mexe entra na outbox, para o servidor receber igual', async () => {
  seed(`
    INSERT INTO exercises (id, name, updated_at) VALUES
      ('conta-supino', 'Supino reto', '${T0}'),
      ('local-supino', 'Supino reto', '${T0}');
    INSERT INTO session_sets (id, session_id, exercise_id, set_index, reps, weight_kg, done, updated_at)
      VALUES ('local-serie', 'x', 'local-supino', 1, 10, 50, 1, '${T0}');
  `);
  local('exercises', 'local-supino');

  await yieldLocalToAccount(normalizeName);

  const queued = raw.prepare("SELECT table_name || '/' || row_id AS key FROM outbox").all() as { key: string }[];
  expect(queued.map((entry) => entry.key)).toEqual(
    expect.arrayContaining(['exercises/local-supino', 'session_sets/local-serie']),
  );
});

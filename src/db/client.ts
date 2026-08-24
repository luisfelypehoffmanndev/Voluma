import * as SQLite from 'expo-sqlite';

import { MIGRATIONS, SCHEMA_VERSION } from './schema';

/**
 * Abertura unica do banco local.
 *
 * `getDb()` e idempotente: a primeira chamada abre o arquivo e roda as
 * migrations pendentes, as seguintes reaproveitam a mesma conexao. Chamadas
 * concorrentes durante a abertura compartilham a mesma promise, senao dois
 * componentes montando ao mesmo tempo rodariam a migration duas vezes.
 */

const DB_NAME = 'cleangym.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= open();
  return dbPromise;
}

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await migrate(db);
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  if (current >= SCHEMA_VERSION) return;

  for (let version = current; version < MIGRATIONS.length; version += 1) {
    await db.execAsync(MIGRATIONS[version]);
  }
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

/** Apaga tudo — usado ao trocar de conta, para nao misturar dados de usuarios. */
export async function resetDb(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM session_sets;
    DELETE FROM sessions;
    DELETE FROM week_targets;
    DELETE FROM routine_exercises;
    DELETE FROM routines;
    DELETE FROM exercises;
    DELETE FROM body_weight_logs;
    DELETE FROM outbox;
    DELETE FROM sync_state;
  `);
}

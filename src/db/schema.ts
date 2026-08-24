/**
 * Schema do SQLite local.
 *
 * O SQLite e a fonte de verdade para LEITURA — nenhuma tela consulta o
 * Supabase diretamente. Toda escrita grava aqui e enfileira uma linha em
 * `outbox`, que o servico de sync drena quando ha rede. E o que faz o app
 * funcionar igual dentro da academia sem sinal.
 *
 * `updated_at` e `deleted_at` existem em toda tabela sincronizavel para o
 * last-write-wins do sync. Nada e apagado de verdade: delete e soft delete.
 */

export const SCHEMA_VERSION = 1;

export const MIGRATIONS: readonly string[] = [
  // v1 — schema inicial
  `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS exercises (
    id           TEXT PRIMARY KEY NOT NULL,
    name         TEXT NOT NULL,
    muscle_group TEXT,
    updated_at   TEXT NOT NULL,
    deleted_at   TEXT
  );

  CREATE TABLE IF NOT EXISTS routines (
    id         TEXT PRIMARY KEY NOT NULL,
    name       TEXT NOT NULL,
    weekday    INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    position   INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS routine_exercises (
    id               TEXT PRIMARY KEY NOT NULL,
    routine_id       TEXT NOT NULL,
    exercise_id      TEXT NOT NULL,
    position         INTEGER NOT NULL DEFAULT 0,
    target_sets      INTEGER NOT NULL DEFAULT 3,
    target_reps      INTEGER NOT NULL DEFAULT 10,
    target_weight_kg REAL NOT NULL DEFAULT 0,
    updated_at       TEXT NOT NULL,
    deleted_at       TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY NOT NULL,
    routine_id  TEXT,
    date        TEXT NOT NULL,
    started_at  TEXT NOT NULL,
    finished_at TEXT,
    updated_at  TEXT NOT NULL,
    deleted_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS session_sets (
    id          TEXT PRIMARY KEY NOT NULL,
    session_id  TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    set_index   INTEGER NOT NULL,
    reps        INTEGER NOT NULL DEFAULT 0,
    weight_kg   REAL NOT NULL DEFAULT 0,
    done        INTEGER NOT NULL DEFAULT 0,
    updated_at  TEXT NOT NULL,
    deleted_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS body_weight_logs (
    id         TEXT PRIMARY KEY NOT NULL,
    logged_at  TEXT NOT NULL,
    weight_kg  REAL NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  -- Fila de sync. Local apenas, nunca sobe para o Supabase.
  CREATE TABLE IF NOT EXISTS outbox (
    seq        INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    row_id     TEXT NOT NULL,
    queued_at  TEXT NOT NULL
  );

  -- Estado do sync: quando foi o ultimo pull bem-sucedido de cada tabela.
  CREATE TABLE IF NOT EXISTS sync_state (
    table_name     TEXT PRIMARY KEY NOT NULL,
    last_pulled_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine
    ON routine_exercises (routine_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_date
    ON sessions (date);
  CREATE INDEX IF NOT EXISTS idx_session_sets_session
    ON session_sets (session_id);
  CREATE INDEX IF NOT EXISTS idx_session_sets_exercise
    ON session_sets (exercise_id);
  CREATE INDEX IF NOT EXISTS idx_body_weight_logged
    ON body_weight_logs (logged_at);
  `,
];

/** Tabelas que participam do sync, na ordem em que devem subir (pais antes de filhos). */
export const SYNCED_TABLES = [
  'exercises',
  'routines',
  'routine_exercises',
  'sessions',
  'session_sets',
  'body_weight_logs',
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

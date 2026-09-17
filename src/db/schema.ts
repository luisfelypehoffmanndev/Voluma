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

export const SCHEMA_VERSION = 4;

export const MIGRATIONS: readonly string[] = [
  // v1 — schema inicial
  //
  // Os PRAGMAs que ficavam aqui (journal_mode e foreign_keys) mudaram para o
  // `open()`: cada migration roda dentro de uma transacao agora, e la dentro
  // `journal_mode` da erro e `foreign_keys` vira no-op silencioso. Alem disso
  // `foreign_keys` e por CONEXAO — no array de migrations ele valia so no boot
  // em que esta rodou, e nunca mais.
  `
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

  // v2 — a semana vira um eixo: um dia por dia da semana, alvos por semana
  `
  CREATE TABLE IF NOT EXISTS week_targets (
    id                  TEXT PRIMARY KEY NOT NULL,
    week_start          TEXT NOT NULL,
    routine_exercise_id TEXT NOT NULL,
    target_sets         INTEGER NOT NULL,
    target_reps         INTEGER NOT NULL,
    target_weight_kg    REAL NOT NULL,
    updated_at          TEXT NOT NULL,
    deleted_at          TEXT
  );

  -- Indice comum, NAO unico. O pull do sync grava com INSERT OR REPLACE
  -- (src/sync/engine.ts) e o REPLACE resolve conflito de unicidade APAGANDO a
  -- linha conflitante. Com indice unico, dois aparelhos que ajustassem a mesma
  -- semana offline ficariam se apagando um ao outro em looping, cada pull
  -- destruindo a linha do outro. Duplicata e desempatada na leitura, por
  -- updated_at — a mesma postura que o resto do app ja tem.
  CREATE INDEX IF NOT EXISTS idx_week_targets_slot
    ON week_targets (week_start, routine_exercise_id);

  -- Um dia da semana passa a ter no maximo um plano. Nada impedia duas rotinas
  -- no mesmo weekday (createRoutine sempre gravava position 0) e a segunda
  -- ficava invisivel, escondida pelo LIMIT 1 de routineForWeekday. Antes de
  -- apagar as duplicatas, os exercicios delas mudam de dono para a
  -- sobrevivente do dia — a que tem menor position, com o id como desempate.
  --
  -- A tabela temporaria existe porque a outbox precisa saber QUAIS linhas
  -- mudaram. Depois do UPDATE nao da mais para distinguir uma linha
  -- re-parenteada de uma que ja era daquela rotina, e enfileirar todas
  -- encheria a fila de linhas intactas em cada instalacao.
  CREATE TEMP TABLE IF NOT EXISTS dedupe_perdedoras AS
  SELECT perdedora.id AS id
    FROM routines perdedora
   WHERE perdedora.deleted_at IS NULL
     AND perdedora.id <> (
           SELECT vencedora.id FROM routines vencedora
            WHERE vencedora.deleted_at IS NULL
              AND vencedora.weekday = perdedora.weekday
            ORDER BY vencedora.position, vencedora.id LIMIT 1);

  -- A migracao escreve direto, sem passar pelo enqueue() do repositorio, entao
  -- a outbox e alimentada na mao: sem isso a deduplicacao ficaria so neste
  -- aparelho e o Supabase continuaria com as duplicatas.
  INSERT INTO outbox (table_name, row_id, queued_at)
  SELECT 'routine_exercises', id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    FROM routine_exercises
   WHERE deleted_at IS NULL
     AND routine_id IN (SELECT id FROM dedupe_perdedoras);

  INSERT INTO outbox (table_name, row_id, queued_at)
  SELECT 'routines', id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    FROM dedupe_perdedoras;

  UPDATE routine_exercises
     SET routine_id = (
           SELECT vencedora.id FROM routines vencedora
            WHERE vencedora.deleted_at IS NULL
              AND vencedora.weekday = (
                    SELECT dona.weekday FROM routines dona
                     WHERE dona.id = routine_exercises.routine_id)
            ORDER BY vencedora.position, vencedora.id LIMIT 1),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   WHERE deleted_at IS NULL
     AND routine_id IN (SELECT id FROM dedupe_perdedoras);

  UPDATE routines
     SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   WHERE id IN (SELECT id FROM dedupe_perdedoras);

  DROP TABLE dedupe_perdedoras;
  `,

  // v3 — corrida: distancia e tempo ao lado de series, reps e carga
  `
  -- A coluna kind distingue a corrida do resto. Default 'strength' faz toda linha que
  -- ja existe continuar sendo exercicio de carga, sem backfill.
  ALTER TABLE exercises ADD COLUMN kind TEXT NOT NULL DEFAULT 'strength';

  -- Os alvos ganham o par distancia/tempo. Ficam em zero na musculacao, e os
  -- campos de carga ficam em zero na corrida — e o que mantem setVolume
  -- (reps vezes peso) devolvendo zero para corrida sem nenhum caso especial, e o
  -- "Volume levantado" em kg livre de quilometro.
  ALTER TABLE routine_exercises ADD COLUMN target_distance_km REAL NOT NULL DEFAULT 0;
  ALTER TABLE routine_exercises ADD COLUMN target_duration_min INTEGER NOT NULL DEFAULT 0;

  ALTER TABLE week_targets ADD COLUMN target_distance_km REAL NOT NULL DEFAULT 0;
  ALTER TABLE week_targets ADD COLUMN target_duration_min INTEGER NOT NULL DEFAULT 0;

  ALTER TABLE session_sets ADD COLUMN distance_km REAL NOT NULL DEFAULT 0;
  ALTER TABLE session_sets ADD COLUMN duration_min INTEGER NOT NULL DEFAULT 0;

  CREATE INDEX IF NOT EXISTS idx_exercises_kind ON exercises (kind);
  `,

  `
  -- Exercicios que o usuario tirou SO deste treino ("Pular hoje"), sem mexer no
  -- plano. Lista JSON de exercise_id na propria sessao, e nao tabela nova: e
  -- estado de uma linha so, o last-write-wins por updated_at ja cobre, e
  -- desfazer e regravar a lista.
  ALTER TABLE sessions ADD COLUMN skipped_exercise_ids TEXT NOT NULL DEFAULT '[]';

  -- Quando o usuario tocou em "Finalizar treino". Nao da para reusar
  -- finished_at: getOrCreateSessionForDate ja cria a sessao com ele preenchido,
  -- porque a cascata de alvos (lastPerformedTargets) exige finished_at. Nulo =
  -- nunca finalizado.
  ALTER TABLE sessions ADD COLUMN completed_at TEXT;
  `,
];

/**
 * Os indices das migrations que ainda faltam rodar, dada a versao atual do
 * banco.
 *
 * Funcao pura por ser a parte da migracao que da para testar sem abrir arquivo
 * nenhum — e a que erra em silencio se alguem acrescentar uma migration e
 * esquecer de subir `SCHEMA_VERSION`.
 *
 * Banco de versao FUTURA (usuario que voltou para uma build antiga) devolve
 * lista vazia: rodar migration para tras nao existe, e e melhor o app tentar
 * abrir um schema adiantado do que reaplicar DDL por cima.
 */
export function pendingMigrations(current: number): number[] {
  const indices: number[] = [];
  for (let version = Math.max(0, current); version < MIGRATIONS.length; version += 1) {
    indices.push(version);
  }
  return indices;
}

/** Tabelas que participam do sync, na ordem em que devem subir (pais antes de filhos). */
export const SYNCED_TABLES = [
  'exercises',
  'routines',
  'routine_exercises',
  'week_targets',
  'sessions',
  'session_sets',
  'body_weight_logs',
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

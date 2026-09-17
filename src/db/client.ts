import * as SQLite from 'expo-sqlite';

import { MIGRATIONS, pendingMigrations } from './schema';

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
  // A promise fica cacheada para que chamadas concorrentes compartilhem a mesma
  // abertura — mas uma REJEITADA nao pode ficar. Sem limpar, toda chamada
  // futura receberia a mesma falha, e o app so voltaria a abrir o banco se
  // fosse fechado e reaberto, mesmo que a causa tenha sido passageira.
  dbPromise ??= open().catch((error: unknown) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

async function open(): Promise<SQLite.SQLiteDatabase> {
  // `serializeTransactions` ANTES de migrar: a migracao agora roda dentro de
  // transacao, e precisa da versao corrigida daqui, nao da da biblioteca (o
  // porque esta documentado em `serializeTransactions`). Trocar um metodo e
  // devolver o mesmo objeto e seguro neste ponto — `dbPromise` ainda nao
  // resolveu, entao ninguem mais alcanca este banco.
  const db = serializeTransactions(await SQLite.openDatabaseAsync(DB_NAME));

  // Fora de qualquer transacao, e por isso sairam da migration v1: o SQLite
  // recusa trocar `journal_mode` dentro de uma, e `foreign_keys` vira no-op
  // la dentro. `journal_mode` fica gravado no arquivo (reaplicar e barato);
  // `foreign_keys` e por conexao e precisa ser reaplicado toda abertura.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  await migrate(db);
  return db;
}

/**
 * Quantas vezes uma transacao que NAO chegou a abrir pode ser tentada de novo,
 * e o intervalo entre as tentativas.
 *
 * So cobre falha do proprio `BEGIN` — ver `runTransaction`. Dois retries com
 * esse espacamento cobrem a janela em que a conexao ainda esta ocupada com a
 * transacao anterior, sem segurar o dedo do usuario esperando.
 */
const BEGIN_RETRIES = 2;
const BEGIN_BACKOFF_MS = [50, 150];

/**
 * Substitui `withTransactionAsync` por uma versao enfileirada e correta.
 *
 * Sao DOIS problemas distintos, e a versao da biblioteca sofre dos dois.
 *
 * **1. Nao ha fila.** A doc do proprio expo-sqlite avisa que a transacao "pode
 * ser interrompida por outras queries assincronas" e que, entre chamadas
 * concorrentes, "a ordem de execucao nao e garantida". Como `repo.ts` inteiro
 * compartilha UMA conexao (`getDb()`) e cada escrita otimista da UI dispara sua
 * propria chamada, duas delas perto no tempo — dois toques em sequencia — se
 * sobrepoem: o `BEGIN` da segunda falha com "cannot start a transaction within
 * a transaction" enquanto a primeira ainda esta aberta.
 *
 * **2. O `ROLLBACK` do catch e incondicional.** A implementacao da lib e
 * `try { BEGIN; task(); COMMIT } catch { ROLLBACK; throw }` — entao quando foi o
 * proprio `BEGIN` que falhou, ela ainda dispara um `ROLLBACK` sem transacao
 * aberta, que falha com "cannot rollback - no transaction is active". Pior:
 * numa conexao compartilhada esse `ROLLBACK` espurio derruba a transacao de
 * OUTRO caminho que estava legitimamente aberta, e a falha vira cascata. E o
 * issue expo/expo#49281; o fix (PR #49727) segue sem merge, entao nao adianta
 * atualizar a lib — a correcao mora aqui.
 *
 * O efeito visivel disso no app era a escrita se perder em silencio (so um
 * `console.warn`), e quem chamou desfazer o otimismo no `catch` — a caixa
 * marcada "voltava sozinha", que era o "delay" relatado.
 *
 * A fila e segura porque `repo.ts` nunca aninha transacoes de verdade (uma
 * chamada disparada de DENTRO do `task` de outra travaria em deadlock): ver o
 * comentario em `getOrCreateSessionForDate`, "SQLite nao aninha" — funcoes que
 * dependem de outra escrita dao `await` nela inteira antes, nunca por dentro.
 */
function serializeTransactions(db: SQLite.SQLiteDatabase): SQLite.SQLiteDatabase {
  let queue: Promise<void> = Promise.resolve();

  db.withTransactionAsync = (task: () => Promise<void>): Promise<void> => {
    const result = queue.then(() => runTransaction(db, task));
    // A fila em si nunca fica "travada" numa rejeicao — ela so decide QUANDO a
    // proxima chamada comeca, nunca SE ela deve rodar. Quem fez a chamada
    // continua recebendo a rejeicao real via `result`.
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  return db;
}

/**
 * `BEGIN` / `task` / `COMMIT` feito na mao, com o `ROLLBACK` condicionado.
 *
 * A diferenca para a versao da biblioteca esta toda na fronteira do `try`: o
 * `BEGIN` fica FORA dele, entao uma falha de abertura nunca leva a um
 * `ROLLBACK` sem transacao (o bug #49281 descrito acima). Dentro do `try` so
 * entra o que roda com a transacao comprovadamente aberta.
 *
 * O retry cobre exclusivamente a falha do `BEGIN`, e e por isso que ele e
 * seguro: se a transacao nao abriu, nada foi aplicado, e repetir nao pode
 * duplicar escrita nenhuma. Falha de dentro do `task` ou do `COMMIT` NUNCA e
 * repetida — ali a escrita pode ter sido parcial ou ate commitada, e uma
 * segunda passada arriscaria aplicar tudo duas vezes.
 */
async function runTransaction(
  db: SQLite.SQLiteDatabase,
  task: () => Promise<void>,
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await db.execAsync('BEGIN');
    } catch (error) {
      if (attempt >= BEGIN_RETRIES) throw error;
      await delay(BEGIN_BACKOFF_MS[attempt] ?? 0);
      continue;
    }

    try {
      await task();
      await db.execAsync('COMMIT');
    } catch (error) {
      // Best-effort: se o proprio ROLLBACK falhar, o erro que interessa e o
      // de cima — o da escrita —, nao o da limpeza.
      await db.execAsync('ROLLBACK').catch(() => undefined);
      throw error;
    }

    return;
  }
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Aplica as migrations que faltam, UMA TRANSACAO POR MIGRATION, com o
 * `user_version` gravado dentro dela.
 *
 * O que isso compra: no SQLite o DDL e transacional (`ALTER TABLE`,
 * `CREATE INDEX`, ate o `CREATE TEMP TABLE` da v2 fazem rollback) e o
 * `user_version` mora no header do arquivo, que e journaled como qualquer
 * pagina. Entao ou a migration inteira entra e a versao sobe junto, ou nada
 * entra. Antes disto, o `user_version` so era gravado depois do loop inteiro:
 * o SO matando o app no meio — coisa rotineira em celular — deixava o schema
 * adiantado com o header em zero, e no boot seguinte a v3 reaplicava
 * `ALTER TABLE exercises ADD COLUMN kind` e falhava com "duplicate column
 * name" para sempre. O app simplesmente nao abria mais o banco.
 */
async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = (row?.user_version ?? 0) || (await detectVersion(db));

  for (const version of pendingMigrations(current)) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

/**
 * A versao deduzida do proprio schema, para os bancos que o bug antigo deixou
 * pelo caminho: header em zero com tabelas e colunas de versoes posteriores ja
 * aplicadas. Sem esta ponte eles continuariam travados mesmo depois da
 * correcao acima, porque a migration recomecaria do zero e falharia igual.
 *
 * So roda quando o header diz zero, que e ou banco novo (devolve zero, nada
 * mudou) ou banco daquele acidente. Imperfeita apenas para quem morreu no meio
 * da v2: a deduplicacao de rotinas e pulada, o que e cosmetico e nao impede o
 * app de abrir.
 */
async function detectVersion(db: SQLite.SQLiteDatabase): Promise<number> {
  if (!(await hasTable(db, 'exercises'))) return 0;
  if (!(await hasTable(db, 'week_targets'))) return 1;
  if (!(await hasColumn(db, 'exercises', 'kind'))) return 2;
  if (!(await hasColumn(db, 'sessions', 'completed_at'))) return 3;
  return 4;
}

async function hasTable(db: SQLite.SQLiteDatabase, table: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    table,
  );
  return row != null;
}

async function hasColumn(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
): Promise<boolean> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return columns.some((item) => item.name === column);
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

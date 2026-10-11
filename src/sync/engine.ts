import { getDb } from '@/db/client';
import { SYNCED_TABLES, type SyncedTable } from '@/db/schema';
import { GYM } from '@/world';

import { supabase } from './supabase';

/**
 * Sync bidirecional entre o SQLite local e o Supabase.
 *
 * push: drena a `outbox` — as linhas que o app escreveu offline — e faz upsert
 *       delas no Postgres, carimbando `user_id` e `gym_id`.
 * pull: baixa tudo que chegou ao servidor desde o ultimo pull daquela tabela.
 *
 * Conflito resolve por last-write-wins comparando `updated_at`, o relogio do
 * APARELHO que editou: dos dois lados. Aqui, o pull nao sobrescreve uma versao
 * local mais nova; no servidor, o gatilho `sync_stamp` (v13) recusa gravar uma
 * versao mais velha por cima de uma mais nova.
 *
 * Mas "o que ainda nao baixei" e medido pelo relogio do SERVIDOR (`synced_at`,
 * a hora em que a linha chegou). Medido pelo `updated_at`, uma edicao offline
 * antiga que subisse depois de o outro aparelho ja ter baixado coisa mais nova
 * nunca chegaria nele.
 *
 * A ordem de `SYNCED_TABLES` importa no push: rotinas antes de
 * routine_exercises, sessoes antes de series. Sem isso, um pull no outro
 * aparelho poderia ver series de um treino que ainda nao chegou.
 */

export type SyncOutcome = {
  pushed: number;
  pulled: number;
  /** Mensagem curta quando falhou. `null` em caso de sucesso. */
  error: string | null;
};

const IDLE: SyncOutcome = { pushed: 0, pulled: 0, error: null };

let running: Promise<SyncOutcome> | null = null;

/**
 * Conta trocas de conta. O `pull` guarda o valor no inicio e confere antes de
 * escrever: se mudou no meio, o `userId` que ele carrega virou lixo e as linhas
 * que desceram sao de outra pessoa.
 */
let generation = 0;

/**
 * Roda um ciclo completo. Chamadas concorrentes compartilham o mesmo ciclo —
 * duas telas pedindo sync ao mesmo tempo nao devem gerar dois pushes.
 */
export function sync(): Promise<SyncOutcome> {
  running ??= runCycle().finally(() => {
    running = null;
  });
  return running;
}

/**
 * O ciclo em voo, se houver — `null` quando nao ha nenhum.
 *
 * Existe para o logout poder ESPERAR o ciclo terminar antes de limpar o banco.
 * `sync()` nao serve para isso: ela iniciaria um ciclo novo justamente quando
 * nao ha nenhum, que e o contrario do que o logout quer.
 */
export function inFlightSync(): Promise<SyncOutcome> | null {
  return running;
}

/**
 * Invalida o ciclo em voo. Chamado no logout: dali em diante o `pull` desiste
 * antes de escrever, em vez de plantar dados da conta anterior no banco que
 * acabou de ser limpo.
 */
export function invalidateSync(): void {
  generation += 1;
}

async function runCycle(): Promise<SyncOutcome> {
  if (!supabase) return IDLE;

  // A geracao no inicio do ciclo. Se ela mudar no meio, houve logout: o
  // `userId` abaixo virou lixo e nada do que descer pode ser gravado.
  const mine = generation;

  try {
    // `getUser` fica DENTRO do try junto com o resto: ela tambem vai na rede, e
    // uma falha dela precisa virar SyncOutcome como qualquer outra. Escapando
    // como rejeicao, ela deixaria o `syncing` de quem chamou preso em true — e
    // `runSync` comeca com `if (get().syncing) return`, entao todo sync futuro
    // viraria no-op ate o app reiniciar.
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return IDLE;

    const pushed = await push(userId, mine);
    const pulled = await pull(userId, mine);
    return { pushed, pulled, error: null };
  } catch (error) {
    // Falha de rede e o caso normal, nao excecao: o app segue funcionando
    // local e tenta de novo no proximo ciclo. A outbox nao e limpa.
    return { pushed: 0, pulled: 0, error: describe(error) };
  }
}

// --------------------------------------------------------------------- push

/**
 * Quantas linhas por lote no push.
 *
 * O `IN (?,?,...)` gasta um parametro por id, e o SQLite tem teto
 * (SQLITE_MAX_VARIABLE_NUMBER). Estourar nao seria so um erro: o proximo ciclo
 * montaria a mesma query, entao a fila daquela tabela nunca mais drenaria.
 * Um teto nosso, bem abaixo do dele, torna isso impossivel.
 */
const PUSH_CHUNK = 500;

async function push(userId: string, mine: number): Promise<number> {
  if (!supabase) return 0;
  const db = await getDb();

  // Uma linha editada dez vezes offline gera dez entradas na outbox; so
  // interessa o estado atual dela. `MAX(seq)` mantem a marca de agua para
  // limpar exatamente o que foi enviado, sem apagar o que entrou no meio.
  const pending = await db.getAllAsync<{
    table_name: SyncedTable;
    row_id: string;
    max_seq: number;
  }>(
    `SELECT table_name, row_id, MAX(seq) AS max_seq
       FROM outbox
      GROUP BY table_name, row_id`,
  );

  if (pending.length === 0) return 0;

  let sent = 0;

  for (const table of SYNCED_TABLES) {
    const ids = pending.filter((item) => item.table_name === table).map((item) => item.row_id);
    if (ids.length === 0) continue;

    for (let start = 0; start < ids.length; start += PUSH_CHUNK) {
      const chunk = ids.slice(start, start + PUSH_CHUNK);
      const placeholders = chunk.map(() => '?').join(',');
      const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM ${table} WHERE id IN (${placeholders})`,
        ...chunk,
      );

      const payload = rows.map((row) => toRemote(table, row, userId, GYM));
      // `select('id')` devolve so as linhas que o servidor GRAVOU: o gatilho
      // `sync_stamp` recusa uma versao mais velha que a que ele ja tem.
      const { data: written, error } = await supabase
        .from(table)
        .upsert(payload, { onConflict: 'id' })
        .select('id');
      if (error) throw new Error(error.message);

      sent += payload.length;

      // Quem mandou a versao recusada (uma edicao offline que perdeu para a de
      // outro aparelho, ou um relogio atrasado) passa a ter a do servidor. Sem
      // isto, cada aparelho ficaria com a sua para sempre.
      const writtenIds = new Set((written ?? []).map((row) => String(row.id)));
      const refused = payload.map((row) => String(row.id)).filter((id) => !writtenIds.has(id));
      if (refused.length > 0) await adoptServerRows(db, table, refused, mine);
    }

    // A limpeza fica FORA do laco de lotes, de proposito: a marca de agua e a
    // da tabela inteira, e apagar por lote perderia as linhas dos lotes
    // seguintes se um deles falhasse no meio.
    const maxSeq = Math.max(
      ...pending.filter((item) => item.table_name === table).map((item) => item.max_seq),
    );
    await db.runAsync('DELETE FROM outbox WHERE table_name = ? AND seq <= ?', table, maxSeq);
  }

  return sent;
}

// --------------------------------------------------------------------- pull

async function pull(userId: string, mine: number): Promise<number> {
  if (!supabase) return 0;
  const db = await getDb();
  let received = 0;

  for (const table of SYNCED_TABLES) {
    const state = await db.getFirstAsync<{ last_pulled_at: string | null }>(
      'SELECT last_pulled_at FROM sync_state WHERE table_name = ?',
      table,
    );
    const since = state?.last_pulled_at ?? '1970-01-01T00:00:00.000Z';

    // Em paginas, por cursor (synced_at, id). Uma consulta so parava nas 1000
    // linhas da API, e linhas gravadas no mesmo lote empatam no carimbo: o
    // resto de um empate cortado no limite nunca mais descia. Cursor, e nao
    // offset: uma linha atualizada no meio da paginacao muda de posicao e
    // faria outra pular de pagina.
    //
    // A primeira pagina comeca um pouco ANTES do marcador. O carimbo e a hora
    // em que a escrita comecou, e uma escrita lenta pode ficar visivel depois
    // de outra carimbada mais tarde; quem baixou entre as duas ja teria passado
    // dela. Baixar de novo essa margem e inofensivo (last-write-wins).
    let cursor: PullCursor | null = null;
    const from = shiftStamp(since, -PULL_OVERLAP_MS);

    for (;;) {
      const base = supabase.from(table).select('*').eq('user_id', userId).eq('gym_id', GYM);
      const { data, error } = await (cursor
        ? base.or(afterCursor(cursor))
        : base.gt('synced_at', from)
      )
        .order('synced_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(PULL_PAGE);

      if (error) throw new Error(error.message);
      const page = (data ?? []) as Record<string, unknown>[];
      if (page.length === 0) break;

      // Trocou de conta enquanto isto descia da rede: escrever agora plantaria
      // dados da conta anterior no banco que o logout acabou de limpar.
      if (mine !== generation) return received;

      // O cursor usa o carimbo CRU do servidor (microssegundos): cortado em
      // milissegundos, o empate deixaria de ser exato.
      const last = page[page.length - 1];
      cursor = { stamp: String(last.synced_at), id: String(last.id) };

      received += await applyRemoteRows(db, table, page);

      if (page.length < PULL_PAGE) break;
    }

    // So depois de todas as paginas: uma falha no meio volta ao mesmo `since`
    // no proximo ciclo, e o last-write-wins torna repetir inofensivo. O marcador
    // nunca anda para tras (a margem traz linhas anteriores a ele).
    if (cursor && stampKey(cursor.stamp) > stampKey(since)) {
      await db.runAsync(
        'INSERT OR REPLACE INTO sync_state (table_name, last_pulled_at) VALUES (?, ?)',
        table,
        cursor.stamp,
      );
    }
  }

  return received;
}

type Db = Awaited<ReturnType<typeof getDb>>;

/**
 * Grava as linhas que vieram do servidor, respeitando o last-write-wins.
 * Devolve quantas foram de fato gravadas.
 */
async function applyRemoteRows(
  db: Db,
  table: SyncedTable,
  remote: readonly Record<string, unknown>[],
): Promise<number> {
  if (remote.length === 0) return 0;
  const columns = await localColumns(db, table);
  let written = 0;

  await db.withTransactionAsync(async () => {
    for (const raw of remote) {
      // Normaliza antes de qualquer comparacao: o Postgres devolve
      // "2026-08-21 12:00:00+00" e o local guarda ISO com milissegundos.
      // Comparar as duas formas como texto daria resultado errado.
      const row = keepColumns(toLocal(table, raw), columns);
      const local = await db.getFirstAsync<{ updated_at: string }>(
        `SELECT updated_at FROM ${table} WHERE id = ?`,
        String(row.id),
      );

      // Last-write-wins: a versao local so e sobrescrita se for mais antiga.
      // Isso e o que impede o pull de desfazer uma serie que o usuario acabou
      // de marcar e que ainda esta esperando na outbox.
      if (local && local.updated_at >= String(row.updated_at)) continue;

      const names = Object.keys(row);
      await db.runAsync(
        `INSERT OR REPLACE INTO ${table} (${names.join(',')})
         VALUES (${names.map(() => '?').join(',')})`,
        ...(names.map((name) => row[name]) as never[]),
      );
      written += 1;
    }
  });

  return written;
}

/** Ids por consulta ao buscar as versoes do servidor: cabem na URL com folga. */
const ADOPT_CHUNK = 100;

/** Troca as versoes locais recusadas pelo servidor pelas que ele tem. */
async function adoptServerRows(
  db: Db,
  table: SyncedTable,
  ids: readonly string[],
  mine: number,
): Promise<void> {
  if (!supabase) return;
  for (let start = 0; start < ids.length; start += ADOPT_CHUNK) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .in('id', ids.slice(start, start + ADOPT_CHUNK));
    if (error) throw new Error(error.message);
    if (mine !== generation) return;
    await applyRemoteRows(db, table, (data ?? []) as Record<string, unknown>[]);
  }
}

const columnCache = new Map<SyncedTable, Set<string>>();

/** As colunas que o SQLite local tem, lidas uma vez por tabela. */
async function localColumns(db: Db, table: SyncedTable): Promise<Set<string>> {
  let columns = columnCache.get(table);
  if (!columns) {
    const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    columns = new Set(rows.map((row) => row.name));
    columnCache.set(table, columns);
  }
  return columns;
}

/**
 * So as colunas que o SQLite local tem.
 *
 * O pull pede `select('*')`: uma coluna nova no servidor (o `gym_id` da v11, o
 * `synced_at` da v13) quebrava o INSERT de todo app instalado que ainda nao a
 * conhecia ("no such column"), e o sync dele parava de baixar.
 */
export function keepColumns(
  row: Record<string, unknown>,
  columns: ReadonlySet<string>,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([name]) => columns.has(name)));
}

/**
 * Linhas por pagina no pull. Precisa ficar ABAIXO do limite de linhas da API
 * (1000 no Supabase): com uma pagina do tamanho do limite, uma pagina cortada
 * pelo servidor pareceria a ultima.
 */
export const PULL_PAGE = 500;

/** Quanto antes do marcador o pull recomeca (ver `pull`). */
export const PULL_OVERLAP_MS = 60_000;

export type PullCursor = { stamp: string; id: string };

/** O filtro "depois de (synced_at, id)", no formato `or` do PostgREST. */
export function afterCursor({ stamp, id }: PullCursor): string {
  // Aspas no timestamp: ele tem ':' e '+', que o PostgREST le como sintaxe.
  return `synced_at.gt."${stamp}",and(synced_at.eq."${stamp}",id.gt.${id})`;
}

/**
 * Um timestamp do servidor ("…33.394964+00:00") ou ISO ("…33.394Z") como texto
 * comparavel, em microssegundos UTC.
 */
export function stampKey(stamp: string): string {
  const utc = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00(?::?00)?)$/.exec(
    stamp,
  );
  if (utc) return `${utc[1]}T${utc[2]}.${(utc[3] ?? '').padEnd(6, '0')}`;
  // Outro fuso: perde os microssegundos, mas compara certo.
  return `${new Date(stamp).toISOString().slice(0, 23)}000`;
}

/** `stamp` deslocado em `ms`, em ISO. */
export function shiftStamp(stamp: string, ms: number): string {
  return new Date(new Date(stamp).getTime() + ms).toISOString();
}

// ---------------------------------------------------------------- conversao

/**
 * A linha local como o servidor espera: com dono e mundo carimbados, e os tipos
 * que diferem entre SQLite e Postgres normalizados.
 */
export function toRemote(
  table: SyncedTable,
  row: Record<string, unknown>,
  userId: string,
  gym: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row, user_id: userId, gym_id: gym };
  if (table === 'session_sets') {
    // SQLite guarda 0/1; a coluna no Postgres e boolean.
    out.done = row.done === 1 || row.done === true;
  }
  return out;
}

/** Caminho inverso, descartando `user_id` e `gym_id`, que so existem no servidor. */
export function toLocal(table: SyncedTable, row: Record<string, unknown>): Record<string, unknown> {
  const { user_id: _user, gym_id: _gym, ...rest } = row;
  const out: Record<string, unknown> = { ...rest };

  if (table === 'session_sets') {
    out.done = row.done === true ? 1 : 0;
  }
  // Timestamps do Postgres vem como "2026-08-21 12:00:00+00"; o resto do app
  // compara essas strings com ISO, entao normaliza aqui.
  for (const key of ['updated_at', 'deleted_at', 'started_at', 'finished_at', 'completed_at', 'logged_at']) {
    const value = out[key];
    if (typeof value === 'string') out[key] = new Date(value).toISOString();
  }

  return out;
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Falha de sincronização';
}

/** Quantas mudancas ainda nao subiram — o indicador discreto dos Ajustes. */
export async function pendingCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(DISTINCT table_name || row_id) AS count FROM outbox',
  );
  return row?.count ?? 0;
}

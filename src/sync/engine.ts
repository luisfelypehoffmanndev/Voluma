import { getDb } from '@/db/client';
import { SYNCED_TABLES, type SyncedTable } from '@/db/schema';

import { supabase } from './supabase';

/**
 * Sync bidirecional entre o SQLite local e o Supabase.
 *
 * push: drena a `outbox` — as linhas que o app escreveu offline — e faz upsert
 *       delas no Postgres, carimbando `user_id`.
 * pull: baixa tudo que mudou no servidor desde o ultimo pull daquela tabela.
 *
 * Conflito resolve por last-write-wins comparando `updated_at`. Para um app de
 * um usuario so, com no maximo dois aparelhos, isso e suficiente: o unico jeito
 * de gerar conflito real e editar a mesma rotina nos dois offline ao mesmo
 * tempo, e ai "a ultima edicao vence" e exatamente o esperado.
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

  try {
    // `getUser` fica DENTRO do try junto com o resto: ela tambem vai na rede, e
    // uma falha dela precisa virar SyncOutcome como qualquer outra. Escapando
    // como rejeicao, ela deixaria o `syncing` de quem chamou preso em true — e
    // `runSync` comeca com `if (get().syncing) return`, entao todo sync futuro
    // viraria no-op ate o app reiniciar.
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return IDLE;

    const pushed = await push(userId);
    const pulled = await pull(userId);
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

async function push(userId: string): Promise<number> {
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

      const payload = rows.map((row) => ({ ...toRemote(table, row), user_id: userId }));
      const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
      if (error) throw new Error(error.message);

      sent += payload.length;
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

async function pull(userId: string): Promise<number> {
  if (!supabase) return 0;
  const db = await getDb();
  let received = 0;

  // A geracao no inicio do ciclo. Se ela mudar no meio, houve logout: o
  // `userId` acima virou lixo e nada do que desceu pode ser gravado.
  const mine = generation;

  for (const table of SYNCED_TABLES) {
    const state = await db.getFirstAsync<{ last_pulled_at: string | null }>(
      'SELECT last_pulled_at FROM sync_state WHERE table_name = ?',
      table,
    );
    const since = state?.last_pulled_at ?? '1970-01-01T00:00:00.000Z';

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', since)
      .order('updated_at', { ascending: true });

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) continue;

    // Trocou de conta enquanto isto descia da rede: escrever agora plantaria
    // dados da conta anterior no banco que o logout acabou de limpar.
    if (mine !== generation) return received;

    // Normaliza antes de qualquer comparacao: o Postgres devolve
    // "2026-08-21 12:00:00+00" e o local guarda ISO com milissegundos.
    // Comparar as duas formas como texto daria resultado errado.
    const incoming = (data as Record<string, unknown>[]).map((remote) => toLocal(table, remote));

    let newest = since;
    for (const row of incoming) {
      const stamp = String(row.updated_at);
      if (stamp > newest) newest = stamp;
    }

    await db.withTransactionAsync(async () => {
      for (const row of incoming) {
        const local = await db.getFirstAsync<{ updated_at: string }>(
          `SELECT updated_at FROM ${table} WHERE id = ?`,
          String(row.id),
        );

        // Last-write-wins: a versao local so e sobrescrita se for mais antiga.
        // Isso e o que impede o pull de desfazer uma serie que o usuario acabou
        // de marcar e que ainda esta esperando na outbox.
        if (local && local.updated_at >= String(row.updated_at)) continue;

        const columns = Object.keys(row);
        await db.runAsync(
          `INSERT OR REPLACE INTO ${table} (${columns.join(',')})
           VALUES (${columns.map(() => '?').join(',')})`,
          ...(columns.map((column) => row[column]) as never[]),
        );
        received += 1;
      }
    });

    await db.runAsync(
      'INSERT OR REPLACE INTO sync_state (table_name, last_pulled_at) VALUES (?, ?)',
      table,
      newest,
    );
  }

  return received;
}

// ---------------------------------------------------------------- conversao

/** Remove colunas locais e normaliza tipos que diferem entre SQLite e Postgres. */
function toRemote(table: SyncedTable, row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  if (table === 'session_sets') {
    // SQLite guarda 0/1; a coluna no Postgres e boolean.
    out.done = row.done === 1 || row.done === true;
  }
  return out;
}

/** Caminho inverso, descartando `user_id`, que so existe no servidor. */
function toLocal(table: SyncedTable, row: Record<string, unknown>): Record<string, unknown> {
  const { user_id: _ignored, ...rest } = row;
  const out: Record<string, unknown> = { ...rest };

  if (table === 'session_sets') {
    out.done = row.done === true ? 1 : 0;
  }
  // Timestamps do Postgres vem como "2026-08-21 12:00:00+00"; o resto do app
  // compara essas strings com ISO, entao normaliza aqui.
  for (const key of ['updated_at', 'deleted_at', 'started_at', 'finished_at', 'logged_at']) {
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

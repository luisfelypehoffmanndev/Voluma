import { afterCursor, PULL_OVERLAP_MS, PULL_PAGE, shiftStamp, stampKey, sync } from '../engine';

/**
 * O ciclo de sync de verdade (push e pull), contra um servidor falso que imita
 * o que importa do Supabase:
 * - corta em 1000 linhas por consulta;
 * - carimba cada escrita com o PROPRIO relogio (`synced_at`, microssegundos);
 * - o gatilho `sync_stamp` recusa uma versao mais velha (pelo `updated_at` do
 *   aparelho) e a deixa fora do retorno do upsert.
 * O banco local e um Map, e o SQLite falso tem so algumas colunas.
 */

const SERVER_MAX_ROWS = 1000;

type ServerRow = {
  id: string;
  user_id: string;
  gym_id: string;
  updated_at: string;
  synced_at: string;
  [column: string]: unknown;
};

let mockServer: Record<string, ServerRow[]>;
let mockLocal: Map<string, Record<string, unknown>>;
let mockSyncState: Map<string, string>;
let mockOutbox: { seq: number; table_name: string; row_id: string }[];
let mockTick: number;

/** As colunas do SQLite falso: `synced_at`, `user_id` e `gym_id` so existem no servidor. */
const mockLocalColumns = ['id', 'updated_at', 'reps', 'done'];

/** O relogio do servidor: cada escrita ganha um carimbo novo, em microssegundos. */
function mockNow(): string {
  mockTick += 1;
  return `2026-10-11T00:00:00.${String(mockTick).padStart(6, '0')}+00:00`;
}

/** Timestamp em qualquer dos formatos → texto comparavel, em microssegundos UTC. */
function mockKey(stamp: string): string {
  const match = /^(.{10})[T ](.{8})(?:\.(\d+))?/.exec(stamp)!;
  return `${match[1]}T${match[2]}.${(match[3] ?? '').padEnd(6, '0')}`;
}

jest.mock('@/world', () => ({ GYM: 'padrao' }));

jest.mock('@/db/client', () => ({
  getDb: async () => ({
    getAllAsync: async (sql: string, ...args: unknown[]) => {
      if (sql.startsWith('PRAGMA table_info')) return mockLocalColumns.map((name) => ({ name }));
      if (sql.includes('FROM outbox')) {
        const groups = new Map<string, { table_name: string; row_id: string; max_seq: number }>();
        for (const entry of mockOutbox) {
          const key = `${entry.table_name}/${entry.row_id}`;
          const group = groups.get(key);
          if (!group || entry.seq > group.max_seq) groups.set(key, { ...entry, max_seq: entry.seq });
        }
        return [...groups.values()];
      }
      if (sql.includes('WHERE id IN')) {
        return args.map((id) => mockLocal.get(String(id))).filter(Boolean);
      }
      return [];
    },
    getFirstAsync: async (sql: string, key: string) => {
      if (sql.includes('sync_state')) {
        const value = mockSyncState.get(key);
        return value ? { last_pulled_at: value } : null;
      }
      const row = mockLocal.get(key);
      return row ? { updated_at: row.updated_at } : null;
    },
    runAsync: async (sql: string, ...args: unknown[]) => {
      if (sql.includes('sync_state')) {
        mockSyncState.set(String(args[0]), String(args[1]));
        return;
      }
      if (sql.startsWith('DELETE FROM outbox')) {
        const [table, maxSeq] = args as [string, number];
        mockOutbox = mockOutbox.filter((e) => !(e.table_name === table && e.seq <= maxSeq));
        return;
      }
      const columns = /\(([^)]+)\)/.exec(sql)![1].split(',');
      const row = Object.fromEntries(columns.map((column, index) => [column, args[index]]));
      mockLocal.set(String(row.id), row);
    },
    withTransactionAsync: async (work: () => Promise<void>) => work(),
  }),
}));

jest.mock('../supabase', () => ({
  get supabase() {
    return {
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
      from: (table: string) => {
        const filters: ((row: ServerRow) => boolean)[] = [];
        let limit = Infinity;
        let orderBy = 'synced_at';
        const builder = {
          select: () => builder,
          eq: (column: string, value: string) => {
            filters.push((row) => row[column] === value);
            return builder;
          },
          gt: (column: string, value: string) => {
            filters.push((row) => mockKey(String(row[column])) > mockKey(value));
            return builder;
          },
          in: (column: string, values: string[]) => {
            filters.push((row) => values.includes(String(row[column])));
            return builder;
          },
          or: (expression: string) => {
            const [, column, stamp, , id] =
              /^(\w+)\.gt\."(.+?)",and\(\1\.eq\."(.+?)",id\.gt\.(.+)\)$/.exec(expression)!;
            filters.push(
              (row) =>
                mockKey(String(row[column])) > mockKey(stamp) ||
                (mockKey(String(row[column])) === mockKey(stamp) && row.id > id),
            );
            return builder;
          },
          order: (column: string) => {
            if (column !== 'id') orderBy = column;
            return builder;
          },
          limit: (count: number) => {
            limit = count;
            return builder;
          },
          upsert: (payload: Record<string, unknown>[]) => ({
            select: () => ({
              then: (resolve: (value: { data: { id: string }[]; error: null }) => unknown) => {
                const rows = (mockServer[table] ??= []);
                const written: { id: string }[] = [];
                for (const incoming of payload) {
                  const index = rows.findIndex((row) => row.id === incoming.id);
                  const current = rows[index];
                  // O gatilho `sync_stamp`: a versao mais velha nao grava.
                  if (current && mockKey(String(incoming.updated_at)) < mockKey(current.updated_at)) {
                    continue;
                  }
                  const next = { ...current, ...incoming, synced_at: mockNow() } as ServerRow;
                  if (index >= 0) rows[index] = next;
                  else rows.push(next);
                  written.push({ id: next.id });
                }
                return Promise.resolve({ data: written, error: null }).then(resolve);
              },
            }),
          }),
          then: (resolve: (value: { data: ServerRow[]; error: null }) => unknown) => {
            const key = (row: ServerRow) => mockKey(String(row[orderBy]));
            const rows = (mockServer[table] ?? [])
              .filter((row) => filters.every((filter) => filter(row)))
              .sort((a, b) =>
                key(a) === key(b) ? a.id.localeCompare(b.id) : key(a).localeCompare(key(b)),
              )
              .slice(0, Math.min(limit, SERVER_MAX_ROWS));
            return Promise.resolve({ data: rows, error: null }).then(resolve);
          },
        };
        return builder;
      },
    };
  },
  isCloudConfigured: true,
}));

function serverRow(id: string, updatedAt: string, syncedAt = mockNow(), extra = {}): ServerRow {
  return { id, user_id: 'u1', gym_id: 'padrao', updated_at: updatedAt, synced_at: syncedAt, ...extra };
}

beforeEach(() => {
  mockServer = {};
  mockLocal = new Map();
  mockSyncState = new Map();
  mockOutbox = [];
  mockTick = 0;
});

describe('pull', () => {
  it('a pagina fica abaixo do limite da API, senao uma pagina cortada pareceria a ultima', () => {
    expect(PULL_PAGE).toBeLessThan(SERVER_MAX_ROWS);
  });

  it('baixa tudo, mesmo com empates atravessando as paginas e o limite da API', async () => {
    const empate = mockNow();
    mockServer.session_sets = [
      ...Array.from({ length: 300 }, (_, i) => serverRow(`a${String(i).padStart(4, '0')}`, '2026-10-01T10:00:00.000Z')),
      // 900 linhas do mesmo lote, com o MESMO carimbo: atravessa as paginas de
      // 500 e o corte de 1000 da API.
      ...Array.from({ length: 900 }, (_, i) =>
        serverRow(`b${String(i).padStart(4, '0')}`, '2026-10-01T10:00:00.000Z', empate),
      ),
      ...Array.from({ length: 100 }, (_, i) => serverRow(`c${String(i).padStart(4, '0')}`, '2026-10-01T10:00:00.000Z')),
    ];

    const outcome = await sync();

    expect(outcome.error).toBeNull();
    expect(mockLocal.size).toBe(1300);
    expect(outcome.pulled).toBe(1300);
  });

  it('guarda o carimbo cru do servidor, e o ciclo seguinte nao grava nada de novo', async () => {
    const carimbo = mockNow();
    mockServer.session_sets = [serverRow('s1', '2026-10-01T08:00:00.000Z', carimbo)];

    await sync();
    expect(mockSyncState.get('session_sets')).toBe(carimbo);

    const second = await sync();
    expect(second.pulled).toBe(0);
    expect(mockSyncState.get('session_sets')).toBe(carimbo);
  });

  // O motivo da v13: o marcador era o `updated_at`, o relogio do APARELHO.
  it('recebe uma edicao antiga que chegou ao servidor depois do ultimo pull', async () => {
    mockServer.session_sets = [serverRow('outro', '2026-10-10T11:00:00.000Z')];
    await sync();

    // O outro aparelho editou offline as 10h e so agora sincronizou.
    mockServer.session_sets.push(serverRow('antiga', '2026-10-10T10:00:00.000Z'));
    await sync();

    expect(mockLocal.has('antiga')).toBe(true);
  });

  it('recebe uma escrita lenta, carimbada antes do marcador mas visivel so depois', async () => {
    mockServer.session_sets = [serverRow('rapida', '2026-10-10T11:00:00.000Z')];
    await sync();
    const marcador = mockSyncState.get('session_sets')!;

    // Comecou antes (carimbo 30 s antes do marcador), terminou depois.
    mockServer.session_sets.push(
      serverRow('lenta', '2026-10-10T11:00:00.000Z', shiftStamp(marcador, -30_000)),
    );
    await sync();

    expect(mockLocal.has('lenta')).toBe(true);
    // A margem traz linhas anteriores ao marcador, mas ele nao anda para tras.
    expect(mockSyncState.get('session_sets')).toBe(marcador);
  });

  it('coluna que o SQLite local nao tem nao quebra o pull', async () => {
    mockServer.session_sets = [
      serverRow('s1', '2026-10-01T08:00:00.000Z', mockNow(), { reps: 10, coluna_nova: 'x' }),
    ];

    const outcome = await sync();

    expect(outcome.error).toBeNull();
    expect(Object.keys(mockLocal.get('s1')!).sort()).toEqual(['done', 'id', 'reps', 'updated_at']);
  });
});

describe('push', () => {
  it('a versao mais nova do aparelho grava no servidor', async () => {
    mockServer.session_sets = [serverRow('x1', '2026-10-10T11:00:00.000Z', mockNow(), { reps: 9 })];
    mockLocal.set('x1', { id: 'x1', updated_at: '2026-10-10T12:00:00.000Z', reps: 7, done: 1 });
    mockOutbox = [{ seq: 1, table_name: 'session_sets', row_id: 'x1' }];

    await sync();

    expect(mockServer.session_sets[0].reps).toBe(7);
    expect(mockLocal.get('x1')!.reps).toBe(7);
    expect(mockOutbox).toEqual([]);
  });

  // Uma edicao offline que perdeu para a de outro aparelho (ou um relogio
  // atrasado): o servidor recusa, e o aparelho passa a ter a versao dele.
  it('versao recusada pelo servidor e trocada pela dele no aparelho', async () => {
    // A linha do servidor chegou ha um dia, e o aparelho ja baixou bem depois
    // disso: o pull, sozinho, nao a traria de novo. So a adocao resolve.
    mockServer.session_sets = [
      serverRow('x1', '2026-10-10T11:00:00.000Z', '2026-10-10T00:00:00.000000+00:00', { reps: 9 }),
    ];
    mockSyncState.set('session_sets', mockNow());
    mockLocal.set('x1', { id: 'x1', updated_at: '2026-10-10T10:00:00.000Z', reps: 5, done: 1 });
    mockOutbox = [{ seq: 1, table_name: 'session_sets', row_id: 'x1' }];

    const outcome = await sync();

    expect(outcome.error).toBeNull();
    expect(mockServer.session_sets[0].reps).toBe(9);
    expect(mockLocal.get('x1')).toMatchObject({ reps: 9, updated_at: '2026-10-10T11:00:00.000Z' });
    expect(mockOutbox).toEqual([]);
  });
});

describe('carimbos', () => {
  it('o filtro do cursor tem aspas no timestamp, que traz ":" e "+"', () => {
    expect(afterCursor({ stamp: '2026-10-01T08:00:00.123456+00:00', id: 's1' })).toBe(
      'synced_at.gt."2026-10-01T08:00:00.123456+00:00",and(synced_at.eq."2026-10-01T08:00:00.123456+00:00",id.gt.s1)',
    );
  });

  it('compara os formatos do servidor e do aparelho', () => {
    expect(stampKey('2026-09-28T12:52:33.394964+00:00') > stampKey('2026-09-28T12:52:33.394Z')).toBe(true);
    expect(stampKey('2026-10-10T22:40:22.495Z')).toBe(stampKey('2026-10-10 22:40:22.495+00'));
    expect(stampKey('2026-10-10T19:40:22.495-03:00')).toBe(stampKey('2026-10-10T22:40:22.495Z'));
  });

  it('a margem do pull e de um minuto', () => {
    expect(PULL_OVERLAP_MS).toBe(60_000);
    expect(shiftStamp('2026-10-11T00:00:00.000Z', -PULL_OVERLAP_MS)).toBe('2026-10-10T23:59:00.000Z');
  });
});

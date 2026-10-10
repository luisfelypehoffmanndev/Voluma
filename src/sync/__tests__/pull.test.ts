import { afterCursor, PULL_PAGE, sync } from '../engine';

/**
 * O pull de verdade, contra um servidor falso que imita o que importa do
 * Supabase: corta em 1000 linhas por consulta, ordena por (updated_at, id) e
 * devolve timestamps com microssegundos. O banco local e um Map.
 *
 * O caso que motivou: series gravadas em lote compartilham o mesmo updated_at,
 * e uma consulta unica parava no limite no meio de um empate. O resto do
 * empate nunca mais descia, porque o ciclo seguinte pedia `> updated_at`.
 */

const SERVER_MAX_ROWS = 1000;

type Row = { id: string; updated_at: string; user_id: string; gym_id: string };

let mockServer: Record<string, Row[]> = {};
let mockLocal: Map<string, Record<string, unknown>>;
let mockSyncState: Map<string, string>;

/** "2026-09-28T12:52:33.394964+00:00" ou "...394Z" → texto comparavel. */
function mockMicros(stamp: string): string {
  const [, base, fraction = ''] = /^(.{19})(?:\.(\d+))?/.exec(stamp) ?? [];
  return `${base}.${fraction.padEnd(6, '0')}`;
}

jest.mock('@/world', () => ({ GYM: 'padrao' }));

jest.mock('@/db/client', () => ({
  getDb: async () => ({
    getAllAsync: async () => [], // outbox vazia: o push nao faz nada
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
        const filters: ((row: Row) => boolean)[] = [];
        let limit = Infinity;
        const builder = {
          select: () => builder,
          upsert: async () => ({ error: null }),
          eq: (column: keyof Row, value: string) => {
            filters.push((row) => row[column] === value);
            return builder;
          },
          gt: (_column: string, value: string) => {
            filters.push((row) => mockMicros(row.updated_at) > mockMicros(value));
            return builder;
          },
          or: (expression: string) => {
            const [, stamp, , id] =
              /^updated_at\.gt\."(.+?)",and\(updated_at\.eq\."(.+?)",id\.gt\.(.+)\)$/.exec(expression)!;
            filters.push(
              (row) =>
                mockMicros(row.updated_at) > mockMicros(stamp) ||
                (mockMicros(row.updated_at) === mockMicros(stamp) && row.id > id),
            );
            return builder;
          },
          order: () => builder,
          limit: (count: number) => {
            limit = count;
            return builder;
          },
          then: (resolve: (value: { data: Row[]; error: null }) => unknown) => {
            const rows = (mockServer[table] ?? [])
              .filter((row) => filters.every((filter) => filter(row)))
              .sort((a, b) =>
                mockMicros(a.updated_at) === mockMicros(b.updated_at)
                  ? a.id.localeCompare(b.id)
                  : mockMicros(a.updated_at).localeCompare(mockMicros(b.updated_at)),
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

function serie(index: number, updatedAt: string): Row {
  return { id: `s${String(index).padStart(5, '0')}`, updated_at: updatedAt, user_id: 'u1', gym_id: 'padrao' };
}

beforeEach(() => {
  mockServer = {};
  mockLocal = new Map();
  mockSyncState = new Map();
});

it('a pagina fica abaixo do limite da API, senao uma pagina cortada pareceria a ultima', () => {
  expect(PULL_PAGE).toBeLessThan(SERVER_MAX_ROWS);
});

it('baixa todas as linhas, mesmo com empates atravessando as paginas e o limite da API', async () => {
  const empate = '2026-09-28T12:52:33.394964+00:00';
  mockServer.session_sets = [
    ...Array.from({ length: 300 }, (_, i) => serie(i, `2026-09-20T10:00:${String(i % 60).padStart(2, '0')}.000001+00:00`)),
    // 900 series do mesmo lote, com o MESMO updated_at: atravessa as paginas
    // de 500 e o corte de 1000 da API.
    ...Array.from({ length: 900 }, (_, i) => serie(300 + i, empate)),
    ...Array.from({ length: 100 }, (_, i) => serie(1200 + i, `2026-10-01T08:00:00.${String(i).padStart(6, '0')}+00:00`)),
  ];

  const outcome = await sync();

  expect(outcome.error).toBeNull();
  expect(mockLocal.size).toBe(1300);
  expect(outcome.pulled).toBe(1300);
});

it('guarda o timestamp cru como marcador, e o ciclo seguinte nao baixa nada de novo', async () => {
  mockServer.session_sets = [serie(1, '2026-10-01T08:00:00.123456+00:00'), serie(2, '2026-10-01T08:00:00.123456+00:00')];

  await sync();
  expect(mockSyncState.get('session_sets')).toBe('2026-10-01T08:00:00.123456+00:00');

  const second = await sync();
  expect(second.pulled).toBe(0);
});

it('o filtro do cursor tem aspas no timestamp, que traz ":" e "+"', () => {
  expect(afterCursor({ stamp: '2026-10-01T08:00:00.123456+00:00', id: 's1' })).toBe(
    'updated_at.gt."2026-10-01T08:00:00.123456+00:00",and(updated_at.eq."2026-10-01T08:00:00.123456+00:00",id.gt.s1)',
  );
});

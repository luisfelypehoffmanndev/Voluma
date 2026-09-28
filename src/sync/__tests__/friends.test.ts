import {
  listFriends,
  monthlyDistance,
  removeFriendship,
  requestFriendship,
  respondFriendship,
  weeklyDays,
} from '../friends';

/**
 * A rede e falsa, mas o que esta sob teste e real: a traducao das linhas do
 * servidor para o dominio, e qual verbo cada acao usa — aceitar e um update,
 * recusar e um delete, e confundir os dois deixaria pedido recusado vivo na
 * lista do outro lado.
 */

type Resposta = { data: unknown; error: { code?: string; message: string } | null };

let mockRpcResponse: Resposta = { data: null, error: null };
let mockRpcCalls: { fn: string; args: unknown }[] = [];
let mockUpdates: { changes: unknown; filters: Record<string, unknown> }[] = [];
let mockDeletes: Record<string, unknown>[] = [];

jest.mock('../supabase', () => ({
  get supabase() {
    return {
      rpc: async (fn: string, args: unknown) => {
        mockRpcCalls.push({ fn, args });
        return mockRpcResponse;
      },
      from: () => ({
        update: (changes: unknown) => {
          const filters: Record<string, unknown> = {};
          const chain = {
            eq: (column: string, value: unknown) => {
              filters[column] = value;
              return chain;
            },
            then: (resolve: (value: Resposta) => unknown) => {
              mockUpdates.push({ changes, filters });
              return Promise.resolve({ data: null, error: null }).then(resolve);
            },
          };
          return chain;
        },
        delete: () => {
          const filters: Record<string, unknown> = {};
          const chain = {
            eq: (column: string, value: unknown) => {
              filters[column] = value;
              return chain;
            },
            then: (resolve: (value: Resposta) => unknown) => {
              mockDeletes.push({ ...filters });
              return Promise.resolve({ data: null, error: null }).then(resolve);
            },
          };
          return chain;
        },
      }),
    };
  },
  isCloudConfigured: true,
}));

beforeEach(() => {
  mockRpcResponse = { data: null, error: null };
  mockRpcCalls = [];
  mockUpdates = [];
  mockDeletes = [];
});

describe('listFriends', () => {
  it('traduz a linha do servidor para o dominio', async () => {
    mockRpcResponse = {
      data: [
        {
          id: 'u2',
          handle: 'bia',
          status: 'accepted',
          direction: 'incoming',
          shares_stats: true,
          age: 28,
          training_years: 4,
        },
      ],
      error: null,
    };

    expect(await listFriends()).toEqual([
      {
        id: 'u2',
        handle: 'bia',
        status: 'accepted',
        direction: 'incoming',
        sharesStats: true,
        age: 28,
        trainingYears: 4,
      },
    ]);
  });

  it('devolve lista vazia quando ainda nao ha ninguem', async () => {
    mockRpcResponse = { data: [], error: null };
    expect(await listFriends()).toEqual([]);
  });

  it('propaga erro do servidor', async () => {
    mockRpcResponse = { data: null, error: { message: 'Sem conexão' } };
    await expect(listFriends()).rejects.toThrow('Sem conexão');
  });
});

describe('weeklyDays', () => {
  it('manda o intervalo de semanas exato para a RPC', async () => {
    mockRpcResponse = { data: [], error: null };

    await weeklyDays('2026-07-12', '2026-09-27');

    expect(mockRpcCalls).toEqual([
      { fn: 'friend_weekly_days', args: { first_week: '2026-07-12', last_week: '2026-09-27' } },
    ]);
  });

  it('traduz as linhas e preserva os nulos de quem nao compartilha', async () => {
    mockRpcResponse = {
      data: [
        { handle: 'ana', shares: true, planned_days: 4, week_start: '2026-09-27', days: 3 },
        { handle: 'bia', shares: false, planned_days: null, week_start: null, days: null },
      ],
      error: null,
    };

    expect(await weeklyDays('2026-07-12', '2026-09-27')).toEqual([
      { handle: 'ana', shares: true, plannedDays: 4, weekStart: '2026-09-27', days: 3 },
      { handle: 'bia', shares: false, plannedDays: null, weekStart: null, days: null },
    ]);
  });

  it.each([[[]], [null]])('sem amigos devolve lista vazia (data %p)', async (data) => {
    mockRpcResponse = { data, error: null };
    expect(await weeklyDays('2026-07-12', '2026-09-27')).toEqual([]);
  });

  it('propaga erro do servidor', async () => {
    mockRpcResponse = { data: null, error: { message: 'Sem conexão' } };
    await expect(weeklyDays('2026-07-12', '2026-09-27')).rejects.toThrow('Sem conexão');
  });
});

describe('monthlyDistance', () => {
  it('manda o mes exato para a RPC', async () => {
    mockRpcResponse = { data: [], error: null };

    await monthlyDistance('2026-09-01', '2026-09-30');

    expect(mockRpcCalls).toEqual([
      {
        fn: 'friend_monthly_distance',
        args: { month_start: '2026-09-01', month_end: '2026-09-30' },
      },
    ]);
  });

  // Nulo e "nao compartilha"; zero e "compartilha e nao correu".
  it('preserva km nulo e zero como vieram', async () => {
    mockRpcResponse = {
      data: [
        { handle: 'ana', km: 12.4 },
        { handle: 'bia', km: null },
        { handle: 'carla', km: 0 },
      ],
      error: null,
    };

    expect(await monthlyDistance('2026-09-01', '2026-09-30')).toEqual([
      { handle: 'ana', value: 12.4 },
      { handle: 'bia', value: null },
      { handle: 'carla', value: 0 },
    ]);
  });

  it('propaga erro do servidor', async () => {
    mockRpcResponse = { data: null, error: { message: 'Sem conexão' } };
    await expect(monthlyDistance('2026-09-01', '2026-09-30')).rejects.toThrow('Sem conexão');
  });
});

describe('requestFriendship', () => {
  it('manda o handle para a RPC', async () => {
    mockRpcResponse = { data: 'ok', error: null };

    expect(await requestFriendship('bia')).toBe('ok');
    expect(mockRpcCalls).toEqual([{ fn: 'request_friendship', args: { target_handle: 'bia' } }]);
  });

  // Os codigos do servidor viram texto na tela, e cada um diz outra coisa:
  // "nao existe esse @" nao e "voces ja sao amigos".
  it.each(['not-found', 'already', 'self'])('devolve o codigo %p como veio', async (codigo) => {
    mockRpcResponse = { data: codigo, error: null };
    expect(await requestFriendship('bia')).toBe(codigo);
  });
});

describe('respondFriendship', () => {
  it('aceitar e um update de status', async () => {
    await respondFriendship('me', 'u2', true);

    expect(mockUpdates).toHaveLength(1);
    expect(mockUpdates[0].changes).toMatchObject({ status: 'accepted' });
    expect(mockUpdates[0].filters).toEqual({ requester_id: 'u2', addressee_id: 'me' });
    expect(mockDeletes).toHaveLength(0);
  });

  // Recusar apaga a linha em vez de marcar "recusado": guardar a recusa faria
  // o pedido morar para sempre na tabela, e impediria a pessoa de pedir de
  // novo por causa do indice do par.
  it('recusar apaga a linha, em vez de marcar um status', async () => {
    await respondFriendship('me', 'u2', false);

    expect(mockDeletes).toEqual([{ requester_id: 'u2', addressee_id: 'me' }]);
    expect(mockUpdates).toHaveLength(0);
  });
});

describe('removeFriendship', () => {
  // A relacao pode estar gravada em qualquer das duas direcoes, e quem desfaz
  // nem sempre e quem pediu.
  it('apaga nas duas direcoes, porque so uma delas existe', async () => {
    await removeFriendship('me', 'u2');

    expect(mockDeletes).toEqual([
      { requester_id: 'me', addressee_id: 'u2' },
      { requester_id: 'u2', addressee_id: 'me' },
    ]);
  });
});

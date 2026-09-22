import { claimHandle, fetchProfile, updateProfile } from '../profile';

/**
 * A rede e falsa aqui, mas a regra sob teste e real: o que acontece quando o
 * indice unico do Postgres recusa um handle. Essa decisao mora no cliente (qual
 * candidato tentar em seguida, e quando desistir), e e a unica parte deste
 * modulo que nao e I/O puro.
 */

const UNIQUE_VIOLATION = '23505';

type Resposta = { data: unknown; error: { code?: string; message: string } | null };

/** Fila de respostas do `insert`, consumida em ordem a cada tentativa. */
let mockInsertQueue: Resposta[] = [];
let mockSelectResponse: Resposta = { data: null, error: null };
let mockUpdateResponse: Resposta = { data: null, error: null };
let mockHandlesTentados: string[] = [];

jest.mock('../supabase', () => ({
  get supabase() {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => mockSelectResponse }),
        }),
        insert: (row: { handle: string }) => {
          mockHandlesTentados.push(row.handle);
          const proxima = mockInsertQueue.shift() ?? { data: null, error: null };
          return { select: () => ({ single: async () => proxima }) };
        },
        update: () => ({
          eq: () => ({ select: () => ({ single: async () => mockUpdateResponse }) }),
        }),
      }),
    };
  },
  isCloudConfigured: true,
}));

function linha(handle: string) {
  return { id: 'u1', handle, age: null, training_years: null, updated_at: '2026-09-21T00:00:00Z' };
}

function ocupado(): Resposta {
  return { data: null, error: { code: UNIQUE_VIOLATION, message: 'duplicate key' } };
}

beforeEach(() => {
  mockInsertQueue = [];
  mockHandlesTentados = [];
  mockSelectResponse = { data: null, error: null };
  mockUpdateResponse = { data: null, error: null };
});

describe('claimHandle', () => {
  it('grava o primeiro candidato quando esta livre', async () => {
    mockInsertQueue = [{ data: linha('luis'), error: null }];

    const resultado = await claimHandle('u1', ['luis', 'luis2'], {});

    expect(resultado).not.toBe('handle-taken');
    expect(mockHandlesTentados).toEqual(['luis']);
  });

  it('passa para o proximo candidato quando o banco recusa por duplicidade', async () => {
    mockInsertQueue = [ocupado(), { data: linha('luis2'), error: null }];

    const resultado = await claimHandle('u1', ['luis', 'luis2'], {});

    expect(mockHandlesTentados).toEqual(['luis', 'luis2']);
    expect(resultado).toMatchObject({ handle: 'luis2' });
  });

  it('desiste quando todos os candidatos estao ocupados', async () => {
    mockInsertQueue = [ocupado(), ocupado()];

    expect(await claimHandle('u1', ['luis', 'luis2'], {})).toBe('handle-taken');
  });

  // Erro que nao e colisao nao pode virar "tenta outro nome": insistir com o
  // proximo candidato esconderia a falha real e gravaria um handle que a pessoa
  // nao escolheu.
  it('propaga erro que nao e duplicidade, sem tentar o proximo', async () => {
    mockInsertQueue = [{ data: null, error: { code: '42501', message: 'permission denied' } }];

    await expect(claimHandle('u1', ['luis', 'luis2'], {})).rejects.toThrow('permission denied');
    expect(mockHandlesTentados).toEqual(['luis']);
  });

  it('leva idade e anos de treino junto na criacao', async () => {
    mockInsertQueue = [{ data: { ...linha('luis'), age: 28, training_years: 4 }, error: null }];

    const resultado = await claimHandle('u1', ['luis'], { age: 28, trainingYears: 4 });

    expect(resultado).toMatchObject({ age: 28, trainingYears: 4 });
  });
});

describe('fetchProfile', () => {
  it('devolve null quando a pessoa ainda nao tem perfil', async () => {
    mockSelectResponse = { data: null, error: null };
    expect(await fetchProfile('u1')).toBeNull();
  });

  it('converte a linha do banco para o tipo de dominio', async () => {
    mockSelectResponse = { data: { ...linha('luis'), age: 30, training_years: 6 }, error: null };

    expect(await fetchProfile('u1')).toEqual({
      id: 'u1',
      handle: 'luis',
      age: 30,
      trainingYears: 6,
    });
  });
});

describe('updateProfile', () => {
  it('devolve handle-taken quando o novo handle e de outra pessoa', async () => {
    mockUpdateResponse = ocupado();
    expect(await updateProfile('u1', { handle: 'luis' })).toBe('handle-taken');
  });

  it('devolve o perfil atualizado no caminho feliz', async () => {
    mockUpdateResponse = { data: { ...linha('novo'), age: 31 }, error: null };

    expect(await updateProfile('u1', { handle: 'novo', age: 31 })).toMatchObject({
      handle: 'novo',
      age: 31,
    });
  });
});

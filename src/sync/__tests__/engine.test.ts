import { toLocal, toRemote } from '../engine';

jest.mock('@/db/client', () => ({ getDb: jest.fn() }));
jest.mock('../supabase', () => ({ supabase: null, isCloudConfigured: false }));

/**
 * O SQLite do aparelho nao sabe de dono nem de mundo: cada instalacao e de uma
 * pessoa num mundo so. Quem carimba ao subir e descarta ao descer e esta
 * conversao, e e ela que impede o treino de um app cair no mundo de outro.
 */

const serie = {
  id: 's1',
  session_id: 'x1',
  exercise_id: 'e1',
  set_index: 1,
  reps: 10,
  weight_kg: 50,
  done: 1,
  updated_at: '2026-10-09T12:00:00.000Z',
  deleted_at: null,
};

describe('toRemote', () => {
  it('carimba o dono e o mundo do app', () => {
    expect(toRemote('exercises', { id: 'e1', name: 'Supino' }, 'u1', 'zztx')).toEqual({
      id: 'e1',
      name: 'Supino',
      user_id: 'u1',
      gym_id: 'zztx',
    });
  });

  it('converte o done de 0/1 para boolean', () => {
    expect(toRemote('session_sets', serie, 'u1', 'padrao')).toMatchObject({ done: true });
    expect(toRemote('session_sets', { ...serie, done: 0 }, 'u1', 'padrao')).toMatchObject({
      done: false,
    });
  });
});

describe('toLocal', () => {
  it('descarta o dono e o mundo, que nao existem no SQLite', () => {
    const local = toLocal('exercises', {
      id: 'e1',
      name: 'Supino',
      user_id: 'u1',
      gym_id: 'zztx',
      updated_at: '2026-10-09 12:00:00+00',
    });

    expect(local).toEqual({ id: 'e1', name: 'Supino', updated_at: '2026-10-09T12:00:00.000Z' });
  });

  it('volta o done para 0/1', () => {
    const remota = { ...serie, done: true, user_id: 'u1', gym_id: 'padrao' };
    expect(toLocal('session_sets', remota)).toMatchObject({ done: 1 });
  });
});

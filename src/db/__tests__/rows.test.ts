import { toSession, type SessionRow } from '../rows';

const row = (overrides: Partial<SessionRow> = {}): SessionRow => ({
  id: 's1',
  routine_id: null,
  date: '2026-09-23',
  started_at: '2026-09-23T10:00:00.000Z',
  finished_at: null,
  skipped_exercise_ids: '[]',
  exercise_order: '[]',
  completed_at: null,
  updated_at: '2026-09-23T10:00:00.000Z',
  deleted_at: null,
  ...overrides,
});

describe('toSession — exercise_order', () => {
  it('le a ordem salva', () => {
    expect(toSession(row({ exercise_order: '["b","a"]' })).exerciseOrder).toEqual(['b', 'a']);
  });

  it('lixo vindo do sync vira ordem vazia (a do plano), sem derrubar a tela', () => {
    expect(toSession(row({ exercise_order: 'nao e json' })).exerciseOrder).toEqual([]);
    expect(toSession(row({ exercise_order: '{"a":1}' })).exerciseOrder).toEqual([]);
  });

  it('descarta o que nao e id', () => {
    expect(toSession(row({ exercise_order: '["a",2,null,"b"]' })).exerciseOrder).toEqual(['a', 'b']);
  });
});

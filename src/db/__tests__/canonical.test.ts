import {
  exercisesYieldingToAccount,
  pickCanonicalRun,
  routinesYieldingToAccount,
} from '../canonical';
import type { ExerciseRow } from '../rows';

const row = (overrides: Partial<ExerciseRow> & { name: string }): ExerciseRow => ({
  id: overrides.name.toLowerCase(),
  muscle_group: 'Cardio',
  kind: 'run',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  ...overrides,
});

describe('pickCanonicalRun', () => {
  it('devolve null quando nao ha candidato nenhum', () => {
    expect(pickCanonicalRun([])).toBeNull();
  });

  // O bug: `kind = 'run'` cobre caminhada, bicicleta e remo. Com so caminhada
  // no banco, a versao antiga devolvia ELA — e o botao "Adicionar corrida"
  // punha caminhada no dia.
  it('devolve null quando so existe outro movimento de distancia e tempo', () => {
    expect(pickCanonicalRun([row({ name: 'Caminhada' })])).toBeNull();
  });

  it('escolhe a corrida entre os outros movimentos de distancia e tempo', () => {
    const corrida = row({ name: 'Corrida' });
    const picked = pickCanonicalRun([row({ name: 'Caminhada' }), corrida, row({ name: 'Remo' })]);
    expect(picked).toBe(corrida);
  });

  // Duas corridas acontecem de verdade: dois aparelhos criando offline ao mesmo
  // tempo, e o sync trazendo as duas.
  it('desempata duplicata pela mais antiga', () => {
    const antiga = row({ name: 'Corrida', id: 'b', updated_at: '2026-01-01T00:00:00.000Z' });
    const nova = row({ name: 'Corrida', id: 'a', updated_at: '2026-06-01T00:00:00.000Z' });
    expect(pickCanonicalRun([nova, antiga])).toBe(antiga);
  });

  // Com o mesmo updated_at o id decide, para que todo aparelho chegue na MESMA
  // linha em vez de cada um escolher a sua.
  it('desempata pelo id quando o updated_at empata', () => {
    const primeira = row({ name: 'Corrida', id: 'a' });
    const segunda = row({ name: 'Corrida', id: 'b' });
    expect(pickCanonicalRun([segunda, primeira])).toBe(primeira);
    expect(pickCanonicalRun([primeira, segunda])).toBe(primeira);
  });
});

describe('routinesYieldingToAccount', () => {
  const routine = (id: string, weekday: number, position = 0, updatedAt = '2026-01-01T00:00:00.000Z') => ({
    id,
    weekday,
    position,
    updatedAt,
  });

  it('a rotina do aparelho cede a da conta no mesmo dia', () => {
    const yielding = routinesYieldingToAccount(
      [routine('conta-seg', 1), routine('local-seg', 1)],
      new Set(['local-seg']),
    );
    expect(yielding).toEqual(new Map([['local-seg', 'conta-seg']]));
  });

  // A decisao foi "nos mesmos dias": um dia que a conta nao tem continua do aparelho.
  it('dia que so o aparelho tem continua', () => {
    const yielding = routinesYieldingToAccount(
      [routine('conta-seg', 1), routine('local-ter', 2)],
      new Set(['local-ter']),
    );
    expect(yielding.size).toBe(0);
  });

  it('com duas da conta no dia, cede para a que o app mostra (position, updated_at, id)', () => {
    const yielding = routinesYieldingToAccount(
      [
        routine('conta-b', 1, 0, '2026-02-01T00:00:00.000Z'),
        routine('conta-a', 1, 0, '2026-01-01T00:00:00.000Z'),
        routine('local', 1),
      ],
      new Set(['local']),
    );
    expect(yielding.get('local')).toBe('conta-a');
  });

  it('conta sem plano: nada cede, o plano do aparelho sobe', () => {
    const yielding = routinesYieldingToAccount([routine('local-seg', 1)], new Set(['local-seg']));
    expect(yielding.size).toBe(0);
  });
});

describe('exercisesYieldingToAccount', () => {
  const exercise = (id: string, key: string, updatedAt = '2026-01-01T00:00:00.000Z') => ({
    id,
    key,
    updatedAt,
  });

  it('o exercicio do aparelho cede ao da conta com o mesmo nome', () => {
    const yielding = exercisesYieldingToAccount(
      [exercise('conta-supino', 'supino reto'), exercise('local-supino', 'supino reto')],
      new Set(['local-supino']),
    );
    expect(yielding).toEqual(new Map([['local-supino', 'conta-supino']]));
  });

  it('exercicio que a conta nao tem continua', () => {
    const yielding = exercisesYieldingToAccount(
      [exercise('conta-supino', 'supino reto'), exercise('local-remada', 'remada baixa')],
      new Set(['local-remada']),
    );
    expect(yielding.size).toBe(0);
  });

  it('entre dois da conta com o mesmo nome, cede ao mais antigo', () => {
    const yielding = exercisesYieldingToAccount(
      [
        exercise('conta-nova', 'supino reto', '2026-03-01T00:00:00.000Z'),
        exercise('conta-velha', 'supino reto', '2026-01-01T00:00:00.000Z'),
        exercise('local', 'supino reto'),
      ],
      new Set(['local']),
    );
    expect(yielding.get('local')).toBe('conta-velha');
  });
});

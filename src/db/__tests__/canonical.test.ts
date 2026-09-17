import { pickCanonicalRun } from '../canonical';
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

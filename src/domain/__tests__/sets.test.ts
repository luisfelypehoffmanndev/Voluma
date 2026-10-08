import { allDone, countSets, nextSetIndex, summarizeSets } from '../sets';

describe('summarizeSets', () => {
  it('series uniformes viram um numero so', () => {
    const summary = summarizeSets([
      { reps: 10, weightKg: 60 },
      { reps: 10, weightKg: 60 },
      { reps: 10, weightKg: 60 },
    ]);
    expect(summary).toEqual({ uniform: true, reps: 10, weightRange: [60, 60], volume: 1800 });
  });

  it('peso divergente com reps iguais vira faixa, mas reps continua unico', () => {
    const summary = summarizeSets([
      { reps: 10, weightKg: 60 },
      { reps: 10, weightKg: 65 },
      { reps: 10, weightKg: 70 },
    ]);
    expect(summary.uniform).toBe(false);
    expect(summary.reps).toBe(10);
    expect(summary.weightRange).toEqual([60, 70]);
    expect(summary.volume).toBe(10 * 60 + 10 * 65 + 10 * 70);
  });

  it('reps tambem divergente devolve reps null', () => {
    const summary = summarizeSets([
      { reps: 12, weightKg: 60 },
      { reps: 8, weightKg: 70 },
    ]);
    expect(summary.uniform).toBe(false);
    expect(summary.reps).toBeNull();
    expect(summary.weightRange).toEqual([60, 70]);
  });

  it('serie unica e uniforme por definicao', () => {
    const summary = summarizeSets([{ reps: 5, weightKg: 100 }]);
    expect(summary).toEqual({ uniform: true, reps: 5, weightRange: [100, 100], volume: 500 });
  });

  it('lista vazia nao lanca e devolve volume zero', () => {
    expect(summarizeSets([])).toEqual({ uniform: true, reps: 0, weightRange: [0, 0], volume: 0 });
  });

  it('acha min/max fora de ordem', () => {
    const summary = summarizeSets([
      { reps: 10, weightKg: 70 },
      { reps: 10, weightKg: 60 },
      { reps: 10, weightKg: 65 },
    ]);
    expect(summary.weightRange).toEqual([60, 70]);
  });
});

describe('nextSetIndex', () => {
  const row = (done: boolean) => ({ done });

  it('e a primeira nao marcada', () => {
    expect(nextSetIndex([row(true), row(false), row(false)])).toBe(1);
  });

  it('volta para tras quando o usuario desmarca uma serie ja feita', () => {
    expect(nextSetIndex([row(false), row(true), row(true)])).toBe(0);
  });

  it('e nulo com o exercicio inteiro feito', () => {
    expect(nextSetIndex([row(true), row(true)])).toBeNull();
  });

  it('e nulo sem serie nenhuma', () => {
    expect(nextSetIndex([])).toBeNull();
  });
});

describe('allDone', () => {
  it('exige todas as series', () => {
    expect(allDone([{ done: true }, { done: false }])).toBe(false);
    expect(allDone([{ done: true }, { done: true }])).toBe(true);
  });

  it('exercicio sem serie nenhuma nao esta concluido', () => {
    expect(allDone([])).toBe(false);
  });
});

describe('countSets', () => {
  const set = (done: boolean) => ({ done });

  it('conta series, nao exercicios', () => {
    expect(
      countSets([
        { rows: [set(true), set(true), set(false)], done: false },
        { rows: [set(false), set(false)], done: false },
      ]),
    ).toEqual({ done: 2, total: 5 });
  });

  it('corrida conta como uma serie, pelo done do exercicio', () => {
    expect(countSets([{ rows: [], done: true }, { rows: [], done: false }])).toEqual({
      done: 1,
      total: 2,
    });
  });

  it('treino vazio nao divide por zero', () => {
    expect(countSets([])).toEqual({ done: 0, total: 0 });
  });
});

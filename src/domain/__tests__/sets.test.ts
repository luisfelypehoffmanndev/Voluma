import { summarizeSets } from '../sets';

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

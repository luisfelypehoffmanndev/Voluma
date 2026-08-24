import { resolveTargets, targetsFromSets } from '../targets';
import type { Targets } from '../types';

const SEED: Targets = { sets: 3, reps: 10, weightKg: 0, distanceKm: 0, durationMin: 0 };

describe('targetsFromSets', () => {
  it('conta as series concluidas', () => {
    const targets = targetsFromSets([
      { setIndex: 1, reps: 10, weightKg: 60 },
      { setIndex: 2, reps: 10, weightKg: 60 },
      { setIndex: 3, reps: 10, weightKg: 60 },
    ]);
    expect(targets).toEqual({ sets: 3, reps: 10, weightKg: 60, distanceKm: 0, durationMin: 0 });
  });

  it('em rampa, o peso que vale e o da ULTIMA serie, nao o da primeira', () => {
    // Aquecimento sobe: 60, 62.5, 62.5. A serie de trabalho e a ultima.
    const targets = targetsFromSets([
      { setIndex: 1, reps: 10, weightKg: 60 },
      { setIndex: 2, reps: 10, weightKg: 62.5 },
      { setIndex: 3, reps: 10, weightKg: 62.5 },
    ]);
    expect(targets?.weightKg).toBe(62.5);
  });

  it('reps e peso saem da MESMA serie, nunca de series diferentes', () => {
    // Pegar MAX(peso) com as reps de outra serie inventaria 12 reps a 62.5 kg,
    // que nao aconteceu: as 12 reps foram a 60.
    const targets = targetsFromSets([
      { setIndex: 1, reps: 12, weightKg: 60 },
      { setIndex: 2, reps: 6, weightKg: 62.5 },
    ]);
    expect(targets).toEqual({ sets: 2, reps: 6, weightKg: 62.5, distanceKm: 0, durationMin: 0 });
  });

  it('acha a ultima serie mesmo fora de ordem', () => {
    const targets = targetsFromSets([
      { setIndex: 3, reps: 8, weightKg: 65 },
      { setIndex: 1, reps: 10, weightKg: 60 },
      { setIndex: 2, reps: 10, weightKg: 62.5 },
    ]);
    expect(targets).toEqual({ sets: 3, reps: 8, weightKg: 65, distanceKm: 0, durationMin: 0 });
  });

  it('serie unica funciona', () => {
    expect(targetsFromSets([{ setIndex: 1, reps: 5, weightKg: 100 }])).toEqual({
      sets: 1,
      reps: 5,
      weightKg: 100,
      distanceKm: 0,
      durationMin: 0,
    });
  });

  it('sem serie nenhuma devolve null, para o chamador cair no proximo degrau', () => {
    expect(targetsFromSets([])).toBeNull();
  });
});

describe('resolveTargets', () => {
  const performed: Targets = { sets: 4, reps: 8, weightKg: 70, distanceKm: 0, durationMin: 0 };
  const override: Targets = { sets: 5, reps: 6, weightKg: 75, distanceKm: 0, durationMin: 0 };

  it('o ajuste da semana ganha de tudo', () => {
    expect(resolveTargets(override, performed, SEED)).toEqual(override);
  });

  it('sem ajuste, vale o que foi levantado da ultima vez', () => {
    expect(resolveTargets(null, performed, SEED)).toEqual(performed);
  });

  it('exercicio nunca treinado cai na semente', () => {
    expect(resolveTargets(null, null, SEED)).toEqual(SEED);
  });

  it('o ajuste vale mesmo quando nao ha historico', () => {
    expect(resolveTargets(override, null, SEED)).toEqual(override);
  });

  it('ajuste que zera o peso e respeitado — nao e tratado como ausente', () => {
    // Guarda contra `override || lastPerformed`: um alvo de 0 kg (peso
    // corporal) e uma escolha valida do usuario, nao um valor vazio.
    const zeroed: Targets = { sets: 3, reps: 15, weightKg: 0, distanceKm: 0, durationMin: 0 };
    expect(resolveTargets(zeroed, performed, SEED)).toEqual(zeroed);
  });
});

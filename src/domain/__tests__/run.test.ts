import {
  formatDistance,
  formatDuration,
  formatPace,
  runTargetsFromSets,
  totalDistance,
  totalDuration,
} from '../run';

function makeSet(overrides: Partial<{ distanceKm: number; durationMin: number; done: boolean }>) {
  return { distanceKm: 0, durationMin: 0, done: true, ...overrides };
}

describe('formatPace', () => {
  it('5 km em 28 min da 5:36 por km', () => {
    expect(formatPace(5, 28)).toBe('5:36');
  });

  it('preenche o segundo com zero a esquerda', () => {
    // 10 km em 50 min = exatamente 5:00.
    expect(formatPace(10, 50)).toBe('5:00');
    // 10 km em 51 min = 5,1 min/km = 5:06, nao 5:6.
    expect(formatPace(10, 51)).toBe('5:06');
  });

  it('nao produz 5:60 no arredondamento', () => {
    // 6 km em 36,0 min daria 6:00; o caso perigoso e cair em 59,6 segundos.
    expect(formatPace(1.0001, 6)).toBe('6:00');
  });

  it('sem distancia ou sem tempo nao ha pace', () => {
    expect(formatPace(0, 28)).toBeNull();
    expect(formatPace(5, 0)).toBeNull();
    expect(formatPace(0, 0)).toBeNull();
  });

  it('nao devolve Infinity nem NaN com numero negativo', () => {
    expect(formatPace(-5, 28)).toBeNull();
  });
});

describe('totalDistance / totalDuration', () => {
  it('soma so o que foi concluido', () => {
    const sets = [
      makeSet({ distanceKm: 3, durationMin: 17 }),
      makeSet({ distanceKm: 2, durationMin: 11 }),
      makeSet({ distanceKm: 10, durationMin: 60, done: false }),
    ];
    expect(totalDistance(sets)).toBe(5);
    expect(totalDuration(sets)).toBe(28);
  });

  it('lista vazia da zero, nao NaN', () => {
    expect(totalDistance([])).toBe(0);
    expect(totalDuration([])).toBe(0);
  });
});

describe('runTargetsFromSets', () => {
  it('soma as series em vez de pegar a ultima', () => {
    // Correu 3 km, parou, correu mais 2: o dia rendeu 5 km.
    const targets = runTargetsFromSets([
      makeSet({ distanceKm: 3, durationMin: 17 }),
      makeSet({ distanceKm: 2, durationMin: 11 }),
    ]);
    expect(targets).toEqual({
      sets: 1,
      reps: 0,
      weightKg: 0,
      distanceKm: 5,
      durationMin: 28,
    });
  });

  it('zera carga, para nao poluir o volume levantado', () => {
    const targets = runTargetsFromSets([makeSet({ distanceKm: 5, durationMin: 28 })]);
    expect(targets?.reps).toBe(0);
    expect(targets?.weightKg).toBe(0);
  });

  it('nao acumula erro de ponto flutuante', () => {
    const targets = runTargetsFromSets([
      makeSet({ distanceKm: 0.1, durationMin: 1 }),
      makeSet({ distanceKm: 0.2, durationMin: 1 }),
    ]);
    expect(targets?.distanceKm).toBe(0.3);
  });

  it('ignora serie nao concluida', () => {
    const targets = runTargetsFromSets([
      makeSet({ distanceKm: 5, durationMin: 28 }),
      makeSet({ distanceKm: 10, durationMin: 60, done: false }),
    ]);
    expect(targets?.distanceKm).toBe(5);
  });

  it('sem serie concluida devolve null, para cair no proximo degrau', () => {
    expect(runTargetsFromSets([])).toBeNull();
    expect(runTargetsFromSets([makeSet({ distanceKm: 5, done: false })])).toBeNull();
  });
});

describe('formatDistance / formatDuration', () => {
  it('distancia inteira nao ganha casa decimal', () => {
    expect(formatDistance(5)).toBe('5');
    expect(formatDistance(5.5)).toBe('5,5');
  });

  it('duracao abaixo de uma hora fica em minutos', () => {
    expect(formatDuration(28)).toBe('28 min');
  });

  it('acima de uma hora vira h + min', () => {
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(72)).toBe('1 h 12');
    expect(formatDuration(65)).toBe('1 h 05');
  });
});

import {
  completedSets,
  formatVolume,
  formatWeight,
  heaviestSet,
  setVolume,
  totalVolume,
  volumeByExercise,
  volumeBySession,
  volumeByWeek,
} from '../volume';
import type { SessionSet } from '../types';

function makeSet(overrides: Partial<SessionSet>): SessionSet {
  return {
    id: 'set-1',
    updatedAt: '2026-08-21T10:00:00.000Z',
    deletedAt: null,
    sessionId: 'session-1',
    exerciseId: 'exercise-1',
    setIndex: 1,
    reps: 10,
    weightKg: 60,
    distanceKm: 0,
    durationMin: 0,
    done: true,
    ...overrides,
  };
}

describe('setVolume', () => {
  it('multiplica reps por peso', () => {
    expect(setVolume(makeSet({ reps: 10, weightKg: 60 }))).toBe(600);
  });

  it('ignora serie nao concluida — e alvo, nao carga levantada', () => {
    expect(setVolume(makeSet({ reps: 10, weightKg: 60, done: false }))).toBe(0);
  });

  it('aceita peso zero (exercicio de peso corporal)', () => {
    expect(setVolume(makeSet({ reps: 15, weightKg: 0 }))).toBe(0);
  });

  it('aceita peso fracionado', () => {
    expect(setVolume(makeSet({ reps: 8, weightKg: 22.5 }))).toBe(180);
  });
});

describe('totalVolume', () => {
  it('soma apenas as series concluidas', () => {
    const sets = [
      makeSet({ id: 'a', reps: 10, weightKg: 60 }),
      makeSet({ id: 'b', reps: 8, weightKg: 70 }),
      makeSet({ id: 'c', reps: 8, weightKg: 70, done: false }),
    ];
    expect(totalVolume(sets)).toBe(600 + 560);
  });

  it('treino vazio tem volume zero, nao NaN', () => {
    expect(totalVolume([])).toBe(0);
  });
});

describe('volumeByExercise', () => {
  it('agrupa as series por movimento', () => {
    const sets = [
      makeSet({ id: 'a', exerciseId: 'supino', reps: 10, weightKg: 60 }),
      makeSet({ id: 'b', exerciseId: 'supino', reps: 10, weightKg: 60 }),
      makeSet({ id: 'c', exerciseId: 'remada', reps: 12, weightKg: 50 }),
    ];
    const byExercise = volumeByExercise(sets);
    expect(byExercise.get('supino')).toBe(1200);
    expect(byExercise.get('remada')).toBe(600);
  });

  it('mantem o exercicio no mapa mesmo quando nenhuma serie foi concluida', () => {
    const sets = [makeSet({ exerciseId: 'supino', done: false })];
    expect(volumeByExercise(sets).get('supino')).toBe(0);
  });
});

describe('volumeBySession', () => {
  it('agrupa as series por treino, base do volume de 7 dias', () => {
    const sets = [
      makeSet({ id: 'a', sessionId: 's1', reps: 10, weightKg: 60 }),
      makeSet({ id: 'b', sessionId: 's2', reps: 5, weightKg: 100 }),
      makeSet({ id: 'c', sessionId: 's2', reps: 5, weightKg: 100 }),
    ];
    const bySession = volumeBySession(sets);
    expect(bySession.get('s1')).toBe(600);
    expect(bySession.get('s2')).toBe(1000);
  });
});

describe('completedSets', () => {
  it('conta so o que foi marcado como feito', () => {
    const sets = [
      makeSet({ id: 'a' }),
      makeSet({ id: 'b' }),
      makeSet({ id: 'c', done: false }),
    ];
    expect(completedSets(sets)).toBe(2);
  });
});

describe('heaviestSet', () => {
  it('retorna a maior carga entre series concluidas', () => {
    const sets = [
      makeSet({ id: 'a', weightKg: 60 }),
      makeSet({ id: 'b', weightKg: 80 }),
      makeSet({ id: 'c', weightKg: 100, done: false }),
    ];
    expect(heaviestSet(sets)).toBe(80);
  });

  it('retorna null quando nada foi concluido', () => {
    expect(heaviestSet([makeSet({ done: false })])).toBeNull();
  });

  it('distingue peso corporal (0 kg) de ausencia de serie', () => {
    expect(heaviestSet([makeSet({ weightKg: 0 })])).toBe(0);
  });
});

describe('formatVolume', () => {
  it('mostra o valor cheio abaixo de 1000', () => {
    expect(formatVolume(940)).toBe('940');
  });

  it('arredonda para inteiro abaixo de 1000', () => {
    expect(formatVolume(940.4)).toBe('940');
  });

  it('nao abrevia acima de 1000', () => {
    expect(formatVolume(3200)).toBe('3200');
  });

  it('nao abrevia nem na casa dos dez mil', () => {
    expect(formatVolume(12400)).toBe('12400');
  });
});

describe('formatWeight', () => {
  it('nao adiciona casa decimal inutil', () => {
    expect(formatWeight(60)).toBe('60');
  });

  it('usa virgula na fracao', () => {
    expect(formatWeight(22.5)).toBe('22,5');
  });

  // Anilha de 1,25 kg: arredondar para uma casa mostraria um peso que ninguem
  // levantou.
  it('mostra ate duas casas, sem zero sobrando', () => {
    expect(formatWeight(61.25)).toBe('61,25');
    expect(formatWeight(62.5)).toBe('62,5');
  });

  it('corta o erro de ponto flutuante', () => {
    expect(formatWeight(0.1 + 0.2)).toBe('0,3');
  });
});

describe('volumeByWeek', () => {
  // 24/09/2026 e uma quinta; a semana dela comeca no domingo 20/09.
  const now = new Date(2026, 8, 24, 15, 0);

  it('devolve as semanas em ordem, da mais antiga para a atual', () => {
    const weeks = volumeByWeek(new Map(), now, 3);
    expect(weeks.map((week) => week.weekStart)).toEqual(['2026-09-06', '2026-09-13', '2026-09-20']);
  });

  it('soma os dias de cada semana e deixa zero na semana sem treino', () => {
    const volumes = new Map([
      ['2026-09-07', 1000],
      ['2026-09-12', 500], // sabado, ainda na semana de 06/09
      ['2026-09-21', 800],
    ]);
    expect(volumeByWeek(volumes, now, 3).map((week) => week.volume)).toEqual([1500, 0, 800]);
  });

  it('ignora dias fora da janela', () => {
    const volumes = new Map([
      ['2026-08-01', 9999],
      ['2026-09-20', 100],
    ]);
    expect(volumeByWeek(volumes, now, 2).map((week) => week.volume)).toEqual([0, 100]);
  });

  it('atravessa a virada do ano', () => {
    const newYear = new Date(2027, 0, 2); // sabado; semana comeca em 27/12
    const volumes = new Map([
      ['2026-12-26', 300],
      ['2026-12-31', 200],
      ['2027-01-02', 100],
    ]);
    expect(volumeByWeek(volumes, newYear, 2)).toEqual([
      { weekStart: '2026-12-20', volume: 300 },
      { weekStart: '2026-12-27', volume: 300 },
    ]);
  });
});

import { monthTicks, niceScale, weekMonthKey } from '../axis';

describe('monthTicks', () => {
  it('marca o primeiro ponto de cada mes novo', () => {
    const keys = ['2026-07-02', '2026-07-20', '2026-08-03', '2026-08-15', '2026-09-01'];
    expect(monthTicks(keys)).toEqual([
      { index: 0, label: 'jul' },
      { index: 2, label: 'ago' },
      { index: 4, label: 'set' },
    ]);
  });

  it('solta o rotulo da ponta esquerda quando o proximo mes vem colado', () => {
    // O primeiro ponto e o fim de julho; agosto comeca logo no segundo, e os
    // dois rotulos se encostariam.
    const keys = ['2026-07-30', '2026-08-02', '2026-08-10', '2026-08-20'];
    expect(monthTicks(keys, 2)).toEqual([{ index: 1, label: 'ago' }]);
  });

  it('mantem a ponta esquerda quando ha espaco', () => {
    const keys = ['2026-07-20', '2026-07-27', '2026-08-03'];
    expect(monthTicks(keys, 2)).toEqual([
      { index: 0, label: 'jul' },
      { index: 2, label: 'ago' },
    ]);
  });

  it('nada para lista vazia', () => {
    expect(monthTicks([])).toEqual([]);
  });
});

describe('weekMonthKey', () => {
  it('usa a quinta da semana: a semana que atravessa o mes fica com o mes da maioria', () => {
    // Semana de 30 ago (domingo) a 5 set: quinta 3 set.
    expect(weekMonthKey('2026-08-30')).toBe('2026-09-03');
    // Semana de 26 jul a 1 ago: quinta 30 jul.
    expect(weekMonthKey('2026-07-26')).toBe('2026-07-30');
  });

  it('a semana em curso nao passa de hoje', () => {
    expect(weekMonthKey('2026-09-27', '2026-09-28')).toBe('2026-09-28');
    expect(weekMonthKey('2026-09-27', '2026-10-02')).toBe('2026-10-01');
  });
});

describe('niceScale', () => {
  it('sobe o topo ate o proximo valor redondo', () => {
    expect(niceScale(9300, 3)).toEqual({ max: 10000, ticks: [5000, 10000] });
  });

  it('usa o passo da anilha quando cabe', () => {
    expect(niceScale(7, 3)).toEqual({ max: 7.5, ticks: [2.5, 5, 7.5] });
  });

  it('nunca passa de maxLines linhas', () => {
    const { ticks } = niceScale(12345, 3);
    expect(ticks.length).toBeLessThanOrEqual(3);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(12345);
  });

  it('pico zero ou negativo vira escala de 1, sem linhas', () => {
    expect(niceScale(0, 3)).toEqual({ max: 1, ticks: [] });
  });
});

import { relativeTime } from '../relative';

// Datas locais (o construtor com numeros usa o fuso do aparelho).
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe('relativeTime', () => {
  it('minutos e horas do mesmo dia', () => {
    const now = at(2026, 10, 10, 15);
    expect(relativeTime(at(2026, 10, 10, 14, 30).toISOString(), now)).toBe('há 30 min');
    expect(relativeTime(at(2026, 10, 10, 9).toISOString(), now)).toBe('há 6 h');
  });

  it('ontem, mesmo a menos de 24 horas', () => {
    const now = at(2026, 10, 10, 8);
    expect(relativeTime(at(2026, 10, 9, 22).toISOString(), now)).toBe('Ontem · 9 out');
  });

  it('ontem atravessando o mes', () => {
    expect(relativeTime(at(2026, 9, 30, 20).toISOString(), at(2026, 10, 1, 9))).toBe('Ontem · 30 set');
  });

  // Comparava so dia e mes: um ano atras, no mesmo dia, virava "Ontem".
  it('o mesmo dia de outro ano nao e ontem', () => {
    expect(relativeTime(at(2025, 10, 9, 20).toISOString(), at(2026, 10, 10, 10))).toBe('9 out 25');
  });
});

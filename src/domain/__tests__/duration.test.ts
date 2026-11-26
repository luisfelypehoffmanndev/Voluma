import { MAX_PLAUSIBLE_MS, elapsedMs, formatClock } from '../duration';

const START = '2026-11-25T18:00:00.000Z';
const at = (iso: string) => Date.parse(iso);

describe('elapsedMs', () => {
  it('conta ate agora enquanto o treino nao acabou', () => {
    expect(elapsedMs(START, null, at('2026-11-25T18:24:15.000Z'))).toBe(24 * 60_000 + 15_000);
  });

  it('para no fim quando o treino foi finalizado, nao importa o agora', () => {
    expect(elapsedMs(START, '2026-11-25T19:02:00.000Z', at('2026-11-26T08:00:00.000Z'))).toBe(
      62 * 60_000,
    );
  });

  it('desiste de numero implausivel: negativo ou acima do teto', () => {
    expect(elapsedMs(START, null, at('2026-11-25T17:59:00.000Z'))).toBeNull();
    expect(elapsedMs(START, null, at(START) + MAX_PLAUSIBLE_MS + 1)).toBeNull();
  });

  it('desiste de data ilegivel', () => {
    expect(elapsedMs('ontem', null, at(START))).toBeNull();
  });
});

describe('formatClock', () => {
  it('formata como relogio de painel', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(4 * 60_000 + 7_000)).toBe('4:07');
    expect(formatClock(24 * 60_000 + 15_000)).toBe('24:15');
    expect(formatClock(62 * 60_000 + 9_000)).toBe('1:02:09');
  });

  it('mostra um traco quando nao ha numero confiavel', () => {
    expect(formatClock(null)).toBe('-');
  });
});

import { dailyBodyWeight } from '../bodyweight';

// Horarios locais: o dia do grafico e o do usuario, nao o do UTC.
const at = (y: number, m: number, d: number, h = 8) => new Date(y, m - 1, d, h).toISOString();

describe('dailyBodyWeight', () => {
  it('devolve em ordem cronologica, mesmo com a entrada invertida', () => {
    const logs = [
      { loggedAt: at(2026, 9, 20), weightKg: 80 },
      { loggedAt: at(2026, 9, 10), weightKg: 81 },
    ];
    expect(dailyBodyWeight(logs, '2026-09-01')).toEqual([
      { date: '2026-09-10', weightKg: 81 },
      { date: '2026-09-20', weightKg: 80 },
    ]);
  });

  it('fica com a ultima pesagem do dia', () => {
    const logs = [
      { loggedAt: at(2026, 9, 20, 22), weightKg: 80.6 },
      { loggedAt: at(2026, 9, 20, 7), weightKg: 79.9 },
    ];
    expect(dailyBodyWeight(logs, '2026-09-01')).toEqual([{ date: '2026-09-20', weightKg: 80.6 }]);
  });

  it('descarta o que veio antes da janela', () => {
    const logs = [
      { loggedAt: at(2026, 8, 31), weightKg: 82 },
      { loggedAt: at(2026, 9, 1), weightKg: 81.5 },
    ];
    expect(dailyBodyWeight(logs, '2026-09-01')).toEqual([{ date: '2026-09-01', weightKg: 81.5 }]);
  });
});

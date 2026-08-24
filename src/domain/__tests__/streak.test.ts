import { buildDotMatrix, currentStreak, monthBlocks } from '../streak';
import { fromDateKey } from '../week';

describe('buildDotMatrix', () => {
  const end = new Date(2026, 7, 21);

  it('gera um ponto por dia da janela', () => {
    expect(buildDotMatrix(new Map(), end, 30)).toHaveLength(30);
  });

  it('marca como treinado apenas os dias com volume', () => {
    const volumes = new Map([['2026-08-21', 3200]]);
    const dots = buildDotMatrix(volumes, end, 3);
    expect(dots.map((dot) => dot.trained)).toEqual([false, false, true]);
  });

  it('destaca um unico ponto: o de maior volume', () => {
    const volumes = new Map([
      ['2026-08-19', 1000],
      ['2026-08-20', 4000],
      ['2026-08-21', 2000],
    ]);
    const dots = buildDotMatrix(volumes, end, 3);
    expect(dots.filter((dot) => dot.record)).toHaveLength(1);
    expect(dots.find((dot) => dot.record)?.dateKey).toBe('2026-08-20');
  });

  it('nao destaca nada quando nunca se treinou', () => {
    const dots = buildDotMatrix(new Map(), end, 10);
    expect(dots.some((dot) => dot.record)).toBe(false);
  });

  it('em empate mantem o primeiro, para o destaque nao ficar pulando', () => {
    const volumes = new Map([
      ['2026-08-20', 2000],
      ['2026-08-21', 2000],
    ]);
    const dots = buildDotMatrix(volumes, end, 2);
    expect(dots.find((dot) => dot.record)?.dateKey).toBe('2026-08-20');
  });
});

describe('buildDotMatrix — intensidade', () => {
  const end = new Date(2026, 7, 21);

  it('da intensidade 1 ao dia mais pesado da janela', () => {
    const volumes = new Map([
      ['2026-08-20', 4000],
      ['2026-08-21', 1000],
    ]);
    const dots = buildDotMatrix(volumes, end, 2);
    expect(dots.find((dot) => dot.dateKey === '2026-08-20')?.intensity).toBe(1);
  });

  it('escala os demais dias em relacao ao recorde', () => {
    const volumes = new Map([
      ['2026-08-20', 4000],
      ['2026-08-21', 1000],
    ]);
    const dots = buildDotMatrix(volumes, end, 2);
    expect(dots.find((dot) => dot.dateKey === '2026-08-21')?.intensity).toBe(0.25);
  });

  it('zera a intensidade em dia sem treino', () => {
    const volumes = new Map([['2026-08-21', 3200]]);
    const dots = buildDotMatrix(volumes, end, 3);
    expect(dots.map((dot) => dot.intensity)).toEqual([0, 0, 1]);
  });

  it('nao divide por zero quando ninguem treinou', () => {
    const dots = buildDotMatrix(new Map(), end, 5);
    expect(dots.every((dot) => dot.intensity === 0)).toBe(true);
  });
});

describe('monthBlocks', () => {
  const end = new Date(2026, 7, 21);

  it('cria um bloco por mes presente na janela', () => {
    // 3 meses de calendario a partir de 01/06 -> jun, jul, ago.
    const dots = buildDotMatrix(new Map(), end, 82);
    expect(monthBlocks(dots).map((block) => block.month)).toEqual([5, 6, 7]);
  });

  it('separa o mesmo mes em anos diferentes', () => {
    // Janela cruzando o ano: dez/2025 e jan/2026 sao blocos distintos.
    const dots = buildDotMatrix(new Map(), new Date(2026, 0, 10), 20);
    const blocks = monthBlocks(dots);
    expect(blocks.map((block) => [block.year, block.month])).toEqual([
      [2025, 11],
      [2026, 0],
    ]);
  });

  it('alinha a primeira coluna pelo dia da semana do primeiro dia do bloco', () => {
    const dots = buildDotMatrix(new Map(), end, 82);
    for (const block of monthBlocks(dots)) {
      const first = block.cells[0];
      expect(first.column).toBe(0);
      expect(first.row).toBe(fromDateKey(first.dateKey).getDay());
    }
  });

  it('coloca cada dia na linha do seu dia da semana', () => {
    const dots = buildDotMatrix(new Map(), end, 82);
    for (const block of monthBlocks(dots)) {
      for (const cell of block.cells) {
        expect(cell.row).toBe(fromDateKey(cell.dateKey).getDay());
      }
    }
  });

  it('nunca deixa dois dias na mesma celula do mesmo bloco', () => {
    const dots = buildDotMatrix(new Map(), end, 82);
    for (const block of monthBlocks(dots)) {
      const slots = block.cells.map((cell) => `${cell.column}:${cell.row}`);
      expect(new Set(slots).size).toBe(slots.length);
    }
  });

  it('conta colunas suficientes para o ultimo dia de cada bloco', () => {
    const dots = buildDotMatrix(new Map(), end, 82);
    for (const block of monthBlocks(dots)) {
      const last = block.cells[block.cells.length - 1];
      expect(block.columns).toBe(last.column + 1);
      expect(block.columns).toBeLessThanOrEqual(6);
    }
  });

  it('preserva todos os dias da janela, sem perder nem duplicar', () => {
    const dots = buildDotMatrix(new Map(), end, 82);
    const flattened = monthBlocks(dots).flatMap((block) => block.cells.map((c) => c.dateKey));
    expect(flattened).toEqual(dots.map((dot) => dot.dateKey));
  });

  it('janela vazia nao quebra', () => {
    expect(monthBlocks([])).toEqual([]);
  });
});

describe('currentStreak', () => {
  const today = new Date(2026, 7, 21);

  it('conta dias consecutivos terminando hoje', () => {
    const trained = new Set(['2026-08-19', '2026-08-20', '2026-08-21']);
    expect(currentStreak(trained, today)).toBe(3);
  });

  it('nao quebra a sequencia se ainda nao treinou hoje — o dia nao acabou', () => {
    const trained = new Set(['2026-08-19', '2026-08-20']);
    expect(currentStreak(trained, today)).toBe(2);
  });

  it('zera quando nem hoje nem ontem tiveram treino', () => {
    const trained = new Set(['2026-08-18', '2026-08-19']);
    expect(currentStreak(trained, today)).toBe(0);
  });

  it('para no primeiro buraco', () => {
    const trained = new Set(['2026-08-21', '2026-08-20', '2026-08-18']);
    expect(currentStreak(trained, today)).toBe(2);
  });

  it('e zero sem nenhum treino', () => {
    expect(currentStreak(new Set(), today)).toBe(0);
  });
});

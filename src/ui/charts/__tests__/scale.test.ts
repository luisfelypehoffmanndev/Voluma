import {
  barIndexAt,
  lineDomain,
  niceTicks,
  plotPoints,
  pointIndexAt,
  signedDelta,
  valueY,
} from '../scale';

describe('plotPoints', () => {
  it('nao devolve nada para uma serie vazia', () => {
    expect(plotPoints([], 100, 50, 4)).toEqual([]);
  });

  it('centraliza um ponto so', () => {
    expect(plotPoints([60], 100, 50, 4)).toEqual([{ x: 50, y: 25 }]);
  });

  it('deixa a serie constante no meio da altura', () => {
    expect(plotPoints([60, 60, 60], 100, 50, 4).map((point) => point.y)).toEqual([25, 25, 25]);
  });

  it('espalha nas pontas do inset e poe o maior valor mais alto', () => {
    const [low, high] = plotPoints([60, 70], 100, 50, 4);
    expect(low.x).toBe(4);
    expect(high.x).toBe(96);
    expect(high.y).toBeLessThan(low.y);
    // A folga de 10% nao deixa nenhum ponto encostar na borda util.
    expect(high.y).toBeGreaterThan(4);
    expect(low.y).toBeLessThan(46);
  });

  it('nao ancora o eixo no zero: 2,5 kg sobre 60 kg ocupam a altura inteira', () => {
    const [a, b] = plotPoints([60, 62.5], 100, 50, 0);
    expect(a.y - b.y).toBeCloseTo(50 / 1.2, 5);
  });
});

describe('signedDelta', () => {
  const fmt = (value: number) => String(value).replace('.', ',');

  it('usa + e o sinal de menos tipografico', () => {
    expect(signedDelta(7.5, fmt)).toBe('+7,5');
    expect(signedDelta(-2.9, fmt)).toBe('−2,9');
  });

  it('zero fica sem sinal', () => {
    expect(signedDelta(0, fmt)).toBe('0');
  });
});

describe('barIndexAt', () => {
  it('cada barra responde pela sua fatia da largura', () => {
    // 4 barras em 100px: fatias de 25px.
    expect(barIndexAt(0, 100, 4)).toBe(0);
    expect(barIndexAt(24.9, 100, 4)).toBe(0);
    expect(barIndexAt(25, 100, 4)).toBe(1);
    expect(barIndexAt(99, 100, 4)).toBe(3);
  });

  it('toque fora das bordas cai na ponta mais proxima', () => {
    expect(barIndexAt(-10, 100, 4)).toBe(0);
    expect(barIndexAt(100, 100, 4)).toBe(3);
    expect(barIndexAt(250, 100, 4)).toBe(3);
  });

  it('nao quebra sem barras', () => {
    expect(barIndexAt(50, 100, 0)).toBe(0);
  });
});

describe('pointIndexAt', () => {
  it('escolhe o ponto mais proximo, casando com o x de plotPoints', () => {
    const xs = plotPoints([1, 2, 3, 4, 5], 100, 50, 4).map((point) => point.x);
    xs.forEach((x, index) => expect(pointIndexAt(x, 100, 5, 4)).toBe(index));
  });

  it('o limite entre dois pontos e o meio do caminho', () => {
    // Pontos em 4 e 96: o meio e 50.
    expect(pointIndexAt(49, 100, 2, 4)).toBe(0);
    expect(pointIndexAt(51, 100, 2, 4)).toBe(1);
  });

  it('prende nas pontas e aguenta um ponto so', () => {
    expect(pointIndexAt(-20, 100, 5, 4)).toBe(0);
    expect(pointIndexAt(500, 100, 5, 4)).toBe(4);
    expect(pointIndexAt(50, 100, 1, 4)).toBe(0);
  });
});

describe('valueY', () => {
  it('casa com o y dos pontos: a linha de grade passa pelo ponto de mesmo valor', () => {
    const values = [20, 22.5, 25, 27.5];
    const domain = lineDomain(values)!;
    const points = plotPoints(values, 100, 80, 6);
    values.forEach((value, index) =>
      expect(valueY(value, domain, 80, 6)).toBeCloseTo(points[index].y, 9),
    );
  });

  it('dominio sem altura poe tudo no meio', () => {
    expect(valueY(60, { low: 60, high: 60 }, 80, 6)).toBe(40);
  });
});

describe('niceTicks', () => {
  it('fica com o menor passo redondo que cabe no limite de linhas', () => {
    // Passo 10000 daria 0, 10k, 20k e 30k: quatro, uma a mais que o limite.
    expect(niceTicks(0, 33448, 3)).toEqual([0, 20000]);
    expect(niceTicks(0, 33448, 4)).toEqual([0, 10000, 20000, 30000]);
  });

  it('usa o passo de anilha quando e ele que cabe', () => {
    expect(niceTicks(20.1, 20.9, 3)).toEqual([20.25, 20.5, 20.75]);
    expect(niceTicks(19, 28, 4)).toEqual([20, 22.5, 25, 27.5]);
  });

  it('escolhe um passo so para progressao e peso reais', () => {
    expect(niceTicks(19.25, 28.25, 3)).toEqual([20, 25]);
    expect(niceTicks(79.9, 93.2, 3)).toEqual([80, 85, 90]);
  });

  it('inclui as pontas quando elas sao redondas', () => {
    expect(niceTicks(0, 10000, 3)).toEqual([0, 5000, 10000]);
  });

  it('nao devolve nada para intervalo vazio ou invertido', () => {
    expect(niceTicks(5, 5, 3)).toEqual([]);
    expect(niceTicks(10, 5, 3)).toEqual([]);
  });
});

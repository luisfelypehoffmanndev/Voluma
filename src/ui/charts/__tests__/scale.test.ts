import { plotPoints, signedDelta } from '../scale';

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

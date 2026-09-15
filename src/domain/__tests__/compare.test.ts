import { compareVolume, formatComparison } from '../compare';

describe('compareVolume', () => {
  it('sem treino anterior nao ha comparacao', () => {
    expect(compareVolume(3200, null)).toBeNull();
  });

  it('anterior sem volume nao vira divisao por zero', () => {
    expect(compareVolume(3200, 0)).toBeNull();
  });

  it('subiu', () => {
    expect(compareVolume(3240, 3000)).toEqual({ direction: 'up', percent: 8 });
  });

  it('caiu, com percentual positivo e a direcao dizendo o sentido', () => {
    expect(compareVolume(2910, 3000)).toEqual({ direction: 'down', percent: 3 });
  });

  it('o que arredonda para zero e igual, nao "▲ 0%"', () => {
    expect(compareVolume(3004, 3000)).toEqual({ direction: 'same', percent: 0 });
  });

  it('treino com volume zero contra um anterior com volume cai 100%', () => {
    expect(compareVolume(0, 3000)).toEqual({ direction: 'down', percent: 100 });
  });
});

describe('formatComparison', () => {
  it('seta e numero', () => {
    expect(formatComparison({ direction: 'up', percent: 8 })).toBe('▲ 8%');
    expect(formatComparison({ direction: 'down', percent: 3 })).toBe('▼ 3%');
  });

  it('igual', () => {
    expect(formatComparison({ direction: 'same', percent: 0 })).toBe('= mesmo volume');
  });
});

import { contrastRatio, hexToRgba } from '../color';

describe('hexToRgba', () => {
  // O mesmo texto que estava escrito a mao no tema antes do accent por academia.
  it('escreve no formato do tema', () => {
    expect(hexToRgba('#FF5C00', 0.24)).toBe('rgba(255,92,0,0.24)');
    expect(hexToRgba('#ff5c00', 0)).toBe('rgba(255,92,0,0)');
  });
});

describe('contrastRatio', () => {
  it('vai de 1 (mesma cor) a 21 (preto e branco), em qualquer ordem', () => {
    expect(contrastRatio('#FF5C00', '#FF5C00')).toBe(1);
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
  });

  // O valor que o comentario do accent em tokens.ts cita.
  it('da 6,8:1 para o laranja da marca sobre o preto', () => {
    expect(contrastRatio('#FF5C00', '#000000')).toBeCloseTo(6.8, 1);
  });
});

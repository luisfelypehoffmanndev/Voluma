import { contrast, grayHex, grayOf, over, overlayAlpha, stack } from '../composite';
import { palette } from '../tokens';

/**
 * A paleta da linguagem Blink (Design/design.md §2) e monocromatica: toda cor
 * de superficie e texto e um cinza, entao um canal basta para a conta WCAG.
 */
const dark = palette.dark;
const light = palette.light;
const g = (hex: string) => grayOf(hex);

describe('as contas de composicao', () => {
  it('branco a 0 nao mexe no fundo e a 1 chega no branco', () => {
    expect(over(0, 10)).toBe(10);
    expect(over(1, 10)).toBe(255);
  });

  it('empilhar duas camadas e o mesmo que compor uma sobre a outra', () => {
    expect(stack(10, 0.06, 0.08)).toBeCloseTo(over(0.08, over(0.06, 10)), 10);
  });

  it('a camada de toque pousa exatamente no estado pressionado', () => {
    const alpha = overlayAlpha(0.06, 0.11);
    for (const base of [0, 32, 64]) {
      expect(over(alpha, over(0.06, base))).toBeCloseTo(over(0.11, base), 10);
    }
  });

  it('converte de volta para hex', () => {
    expect(grayHex(18)).toBe('#121212');
  });
});

describe('contraste da paleta escura', () => {
  const surfaces = [
    dark.background,
    dark.surfaceContainerLow,
    dark.surfaceContainer,
    dark.surfaceContainerHigh,
  ];

  it('calcula a razao WCAG nos extremos', () => {
    expect(contrast(255, 0)).toBeCloseTo(21, 5);
    expect(contrast(128, 128)).toBe(1);
  });

  it('o texto principal passa 7:1 (AAA) em toda superficie de conteudo', () => {
    for (const surface of surfaces) {
      expect(contrast(g(dark.onSurface), g(surface))).toBeGreaterThanOrEqual(7);
    }
  });

  it('o texto principal nunca e branco puro sobre preto puro: fica abaixo de 15:1', () => {
    // Branco a 21:1 vibra e cansa (regra que veio de teste no Blink).
    expect(contrast(g(dark.onSurface), g(dark.background))).toBeLessThan(15);
  });

  it('o texto auxiliar passa 4,5:1 ate na linha da serie da vez', () => {
    for (const surface of surfaces) {
      expect(contrast(g(dark.onSurfaceVariant), g(surface))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('o texto sobre o botao principal passa 7:1', () => {
    expect(contrast(g(dark.onPrimary), g(dark.primaryContainer))).toBeGreaterThanOrEqual(7);
  });

  it('o icone inativo passa 3:1, o minimo de elemento grafico', () => {
    expect(contrast(g(dark.outline), g(dark.background))).toBeGreaterThanOrEqual(3);
  });

  it('o card se separa do fundo por degrau de cinza, sem precisar de borda', () => {
    expect(g(dark.surfaceContainer)).toBeGreaterThan(g(dark.background));
    expect(g(dark.surfaceContainerHigh)).toBeGreaterThan(g(dark.surfaceContainer));
  });
});

describe('contraste da paleta clara', () => {
  it('nunca usa branco puro no fundo nem no card', () => {
    expect(light.background.toLowerCase()).not.toBe('#ffffff');
    expect(light.surfaceContainer.toLowerCase()).not.toBe('#ffffff');
  });

  it('o texto principal e o auxiliar passam AAA e AA sobre o card', () => {
    expect(contrast(g(light.onSurface), g(light.surfaceContainer))).toBeGreaterThanOrEqual(7);
    expect(contrast(g(light.onSurfaceVariant), g(light.surfaceContainer))).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('o texto sobre o botao principal passa 7:1', () => {
    expect(contrast(g(light.onPrimary), g(light.primaryContainer))).toBeGreaterThanOrEqual(7);
  });
});

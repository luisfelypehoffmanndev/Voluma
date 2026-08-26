import processBackgroundImage from 'react-native/Libraries/StyleSheet/processBackgroundImage';

import { pillFieldGradient } from '../../ui/TabBarSurface';
import { over } from '../composite';
import { falloffAt, fieldGrayAt, whiteAlphaFor } from '../field';
import { ambient } from '../tokens';

/** Uma tela comum de Android, em dp — 1080x2400 fisicos a 2.75x. */
const SCREEN = { screenWidth: 393, screenHeight: 852 };
/** A geometria de `tabBar.ts` com navegacao por gestos. */
const PILL = { ...SCREEN, bottom: 24, height: 60, sideInset: 20 };

describe('falloffAt', () => {
  it('reproduz a curva nos proprios pontos dela', () => {
    for (const point of ambient.falloff) {
      expect(falloffAt(point.offset)).toBeCloseTo(point.weight, 10);
    }
  });

  it('interpola entre os pontos, sem degrau', () => {
    const [first, second] = ambient.falloff;
    const middle = (first.offset + second.offset) / 2;
    expect(falloffAt(middle)).toBeCloseTo((first.weight + second.weight) / 2, 10);
  });

  it('zera fora do raio, para o halo nao ter borda', () => {
    expect(falloffAt(1)).toBe(0);
    expect(falloffAt(1.5)).toBe(0);
  });
});

describe('fieldGrayAt', () => {
  it('nao passa do teto que o design assumiu', () => {
    // `composite.test.ts` exige que o campo chegue a #202020 e nao passe disso.
    // O pico fica no centro do halo mais forte.
    // Arredondado: o teto do brief e o valor renderizado em 8 bits, e a conta
    // em ponto flutuante passa 0,05 dele.
    const peak = fieldGrayAt(0.5, 0);
    expect(Math.round(peak)).toBeLessThanOrEqual(0x20);
  });

  it('e o caminho de volta de `whiteAlphaFor`', () => {
    const gray = fieldGrayAt(0.3, 0.6);
    expect(over(whiteAlphaFor(gray), 0x0a)).toBeCloseTo(gray, 10);
  });
});

/**
 * Estes dois sao a medida que justifica a escolha de desenho da tab bar: um
 * gradiente LINEAR so reproduz o campo porque, no pedaco de tela que o pill
 * ocupa, o campo anda muito na horizontal e quase nada na vertical. Se alguem
 * mexer num halo e isso deixar de valer, a aproximacao linear para de servir —
 * e e este teste que avisa, em vez de a barra ficar sutilmente errada.
 */
describe('o campo atras do pill', () => {
  const centerY = (PILL.screenHeight - PILL.bottom - PILL.height / 2) / PILL.screenHeight;
  const left = PILL.sideInset / PILL.screenWidth;
  const right = (PILL.screenWidth - PILL.sideInset) / PILL.screenWidth;

  it('anda o bastante na horizontal para valer um gradiente', () => {
    const spread = Math.abs(fieldGrayAt(left, centerY) - fieldGrayAt(right, centerY));
    expect(spread).toBeGreaterThan(6);
  });

  it('e praticamente constante na vertical', () => {
    const top = (PILL.screenHeight - PILL.bottom - PILL.height) / PILL.screenHeight;
    const bottom = (PILL.screenHeight - PILL.bottom) / PILL.screenHeight;
    const middle = (left + right) / 2;
    const spread = Math.abs(fieldGrayAt(middle, top) - fieldGrayAt(middle, bottom));
    expect(spread).toBeLessThan(1);
  });

  it('e mais claro na esquerda, onde fica o halo `base`', () => {
    expect(fieldGrayAt(left, centerY)).toBeGreaterThan(fieldGrayAt(right, centerY));
  });
});

describe('pillFieldGradient', () => {
  it('sobrevive ao processamento de estilo do RN', () => {
    // Sem isto, um formato errado deixaria o pill transparente sem erro nenhum.
    const processed = processBackgroundImage([pillFieldGradient(PILL)]);

    expect(processed).toHaveLength(1);
    expect(processed[0].type).toBe('linear-gradient');
  });

  it('nunca emite alpha negativo', () => {
    // `whiteAlphaFor` pode dar negativo se o campo cair abaixo do fundo base;
    // um alpha negativo derruba a camada inteira no processamento.
    for (const stop of pillFieldGradient(PILL).colorStops) {
      const alpha = Number(stop.color.match(/([\d.]+)\)$/)?.[1]);
      expect(alpha).toBeGreaterThanOrEqual(0);
    }
  });
});

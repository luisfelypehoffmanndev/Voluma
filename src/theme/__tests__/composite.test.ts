import { alphaOf, grayHex, grayOf, over, stack } from '../composite';
import { ambient, colors, glass, surfaces } from '../tokens';

const BG = grayOf(colors.bg);

/** O maior valor que o campo de luz produz: o halo mais forte, sozinho. */
const HALO_PEAK = Math.max(...ambient.halos.map((halo) => halo.opacity));

describe('over', () => {
  it('a 0 nao mexe no fundo e a 1 chega no branco', () => {
    expect(over(0, BG)).toBe(BG);
    expect(over(1, BG)).toBe(255);
  });

  it('reproduz a tabela que escolheu o alpha do card', () => {
    // O #161616 da esquerda e o valor exato dos cards solidos de antes.
    expect(grayHex(over(0.05, BG))).toBe('#161616');
    expect(grayHex(over(0.06, BG))).toBe('#191919');
    expect(grayHex(over(0.08, BG))).toBe('#1E1E1E');
  });

  it('empilhar duas camadas e o mesmo que compor uma sobre a outra', () => {
    expect(stack(BG, 0.06, 0.08)).toBeCloseTo(over(0.08, over(0.06, BG)), 10);
  });
});

describe('a escada de densidade', () => {
  it('poe o card em #191919 onde nao ha halo — o baseline nao muda', () => {
    expect(grayHex(over(alphaOf(surfaces.card), BG))).toBe('#191919');
  });

  it('poe o nivel 2 em #2B2B2B, 18 pontos acima do card', () => {
    const card = over(alphaOf(surfaces.card), BG);
    const raised = over(alphaOf(surfaces.raised), card);

    expect(grayHex(raised)).toBe('#2B2B2B');
    // Sobre os cards solidos de antes esse degrau era de 8 pontos (#161616 ->
    // #1E1E1E). Translucido ele ficou mais forte, nao mais fraco.
    expect(raised - card).toBeGreaterThan(8);
    expect(Math.round(raised - card)).toBe(18);
  });

  it('mantem os niveis em ordem crescente de densidade', () => {
    const ladder = [surfaces.card, surfaces.raised].map(alphaOf);
    expect(ladder).toEqual([...ladder].sort((a, b) => a - b));
    // O chrome de nivel 3 esconde o que passa por baixo; e outra ordem de
    // grandeza, nao o proximo degrau.
    expect(alphaOf(glass.fillNoBlur)).toBeGreaterThan(0.8);
  });

  it('acende ao ser pressionado, em vez de apagar', () => {
    expect(alphaOf(surfaces.cardPressed)).toBeGreaterThan(alphaOf(surfaces.card));
    expect(alphaOf(surfaces.controlPressed)).toBeGreaterThan(alphaOf(surfaces.control));
  });
});

describe('o campo de luz', () => {
  it('deixa o fundo quase-preto mesmo no pico do halo', () => {
    // O brief exige fundo quase-preto. No pico o campo chega a #202020, ainda
    // muito abaixo do #161616 que o card tinha como *superficie*.
    expect(grayHex(over(HALO_PEAK, BG))).toBe('#202020');
    expect(over(HALO_PEAK, BG)).toBeLessThan(grayOf('#2A2A2A'));
  });

  it('separa card e fundo por 12 pontos ou mais em qualquer ponto do campo', () => {
    const alpha = alphaOf(surfaces.card);

    // Do preto chapado ao pico do campo, passando pelos valores intermediarios
    // por onde um card desliza ao rolar.
    for (const halo of [0, 0.05, HALO_PEAK, 0.12]) {
      const field = over(halo, BG);
      const card = over(alpha, field);

      // E o argumento quantitativo de que 6% basta: a legibilidade do card nao
      // depende de onde ele esta na tela.
      expect(card - field).toBeGreaterThan(12);
    }
  });

  it('nao tem halo forte o bastante para virar gradiente decorativo', () => {
    for (const halo of ambient.halos) {
      expect(halo.opacity).toBeLessThan(0.1);
    }
  });
});

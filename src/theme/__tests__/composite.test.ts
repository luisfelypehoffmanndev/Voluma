import { alphaOf, grayHex, grayOf, over, overlayAlpha, stack } from '../composite';
import { ambient, colors, glass, surfaces, tabIcon } from '../tokens';

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

  /**
   * O `fillNoBlur` e a unica superficie do app com cor propria, entao e a unica
   * que pode errar de *tom* — e ja errou duas vezes, sempre para o mesmo lado:
   * clara demais, lendo como uma laje cinza colada sobre o fundo quase preto.
   * O resto da escada e branco translucido e nao tem como cair nessa.
   *
   * Este e o corpo do vidro onde nao ha blur atras: Android 11 e abaixo, e o
   * painel dentro de um `Modal`. O caminho com blur usa `fill` e nao passa por
   * aqui — ver `GlassSurface`.
   */
  describe('o preenchimento sem blur', () => {
    const fill = glass.fillNoBlur.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
    const [r, g, b] = fill!.slice(1).map(Number);

    it('e neutro, como toda superficie do app', () => {
      // Um viés de matiz aqui destoa de tudo: nao ha uma so cor no app fora do
      // accent, e um cinza azulado le como material de outro sistema.
      expect(r).toBe(g);
      expect(g).toBe(b);
    });

    it('nivela com o card, e nunca passa dele', () => {
      // O erro concreto que este teste trava: um fill em 34 compunha a barra em
      // #1F, praticamente o pico do campo de luz inteiro (#202020), em qualquer
      // posicao da tela — mais clara que os cards que passam por baixo dela, e
      // lendo como uma laje cinza colada sobre o fundo quase preto.
      //
      // Nivel 3 se define por OCULTAR, nao por brilhar: quem separa a barra do
      // fundo e a aresta especular, nao o preenchimento. Entao o alvo e o
      // proprio valor do card — passar dele e o erro acima; ficar muito abaixo
      // le como escura demais contra o resto do app.
      const alpha = alphaOf(glass.fillNoBlur);
      const onBg = alpha * r + (1 - alpha) * BG;
      const card = over(alphaOf(surfaces.card), BG);

      expect(onBg).toBeLessThanOrEqual(card);
      // A margem de baixo e o que impede de "consertar" escurecendo demais:
      // dentro de 3 niveis de cinza do card, a barra le como a mesma materia.
      expect(card - onBg).toBeLessThan(3);
    });
  });

  /**
   * A camada de toque tem que POUSAR no estado pressionado dos tokens, e nao
   * perto dele. Empilhar ingenuamente a diferenca (0,11 − 0,06 = 0,05) erra,
   * porque a segunda camada so pinta o que a primeira deixou passar.
   */
  describe('a camada de toque', () => {
    it('reproduz exatamente o estado pressionado, em qualquer ponto do campo', () => {
      for (const [rest, active] of [
        [surfaces.card, surfaces.cardPressed],
        [surfaces.control, surfaces.controlPressed],
      ] as const) {
        const from = alphaOf(rest);
        const to = alphaOf(active);
        const layer = overlayAlpha(from, to);

        // Do preto chapado ao pico do campo: o alpha da camada nao depende do
        // que passa por tras, e e isso que deixa usar um valor fixo.
        for (const halo of [0, 0.05, HALO_PEAK]) {
          const field = over(halo, BG);
          expect(over(layer, over(from, field))).toBeCloseTo(over(to, field), 6);
        }
      }
    });

    it('a diferenca ingenua erraria — e por isso que a conta existe', () => {
      const from = alphaOf(surfaces.card);
      const to = alphaOf(surfaces.cardPressed);

      expect(overlayAlpha(from, to)).toBeGreaterThan(to - from);
    });
  });

  /**
   * O icone da aba deixou de ter duas cores e passou a ter dois brilhos. Em
   * repouso ele NAO pode mudar de aparencia: `idleOpacity` existe para pousar
   * no mesmo cinza que o inativo tinha como cor.
   */
  it('poe o icone de aba apagado no mesmo #8A8A8A que ele tinha como cor', () => {
    const alpha = alphaOf(glass.fillNoBlur);
    const fill = Number(glass.fillNoBlur.match(/rgba\((\d+)/)![1]);
    // O corpo da barra sem blur: a laje quase opaca sobre o campo de luz. Onde
    // o vidro borra o corpo e outro, e o icone apagado pousa em outro cinza —
    // e o pior caso que este teste trava, porque a laje e o corpo mais escuro
    // dos dois.
    const bar = alpha * fill + (1 - alpha) * BG;

    const ativo = grayOf(colors.textPrimary);
    const apagado = bar + tabIcon.idleOpacity * (ativo - bar);

    expect(grayHex(apagado)).toBe(colors.textSecondary.toUpperCase());
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

  /**
   * A curva de queda substituiu a rampa linear de dois stops porque a rampa
   * para de mudar de golpe no fim do raio, e essa quina na derivada vira um anel
   * na borda do halo. O que estes testes protegem e o contrato dela: comeca no
   * pico, chega a zero, e so desce.
   */
  describe('a queda do halo', () => {
    it('comeca no pico e termina em zero', () => {
      const curve = ambient.falloff;
      expect(curve[0]).toEqual({ offset: 0, weight: 1 });
      expect(curve[curve.length - 1]).toEqual({ offset: 1, weight: 0 });
    });

    it('so desce, e nunca repete o mesmo peso', () => {
      // Um trecho plano no meio da queda seria uma faixa de luminancia constante
      // — exatamente a banda larga que a curva existe para nao criar.
      for (let i = 1; i < ambient.falloff.length; i += 1) {
        expect(ambient.falloff[i].weight).toBeLessThan(ambient.falloff[i - 1].weight);
      }
    });

    it('tem offsets crescentes dentro de [0,1]', () => {
      for (let i = 0; i < ambient.falloff.length; i += 1) {
        const { offset } = ambient.falloff[i];
        expect(offset).toBeGreaterThanOrEqual(0);
        expect(offset).toBeLessThanOrEqual(1);
        if (i > 0) expect(offset).toBeGreaterThan(ambient.falloff[i - 1].offset);
      }
    });

    it('nao levanta o campo em ponto nenhum', () => {
      // Peso acima de 1 faria o halo passar do pico que o teste de #202020 trava.
      for (const point of ambient.falloff) {
        expect(point.weight).toBeLessThanOrEqual(1);
        expect(point.weight).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

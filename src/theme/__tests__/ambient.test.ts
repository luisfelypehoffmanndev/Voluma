import processBackgroundImage from 'react-native/Libraries/StyleSheet/processBackgroundImage';

import { alphaOf } from '../composite';
import { ambient, ambientBackground } from '../tokens';

/**
 * O campo de luz tem duas representacoes — `ambient`, que e a fonte, e
 * `ambientBackground`, que e a traducao para a camada de fundo nativa. Estes
 * testes existem porque as duas formas de este arquivo apodrecer sao silenciosas:
 *
 * 1. O RN descarta um `radial-gradient` malformado devolvendo lista vazia, sem
 *    erro nenhum — o app so ficaria com o fundo chapado de volta, e o banding
 *    seria o menor dos problemas.
 * 2. A traducao pode sair de sincronia com `ambient` sem nada quebrar.
 */
describe('ambientBackground', () => {
  it('tem uma camada por halo, na mesma ordem', () => {
    expect(ambientBackground).toHaveLength(ambient.halos.length);
    ambientBackground.forEach((layer, i) => {
      expect(layer.position.left).toBe(ambient.halos[i].cx);
      expect(layer.position.top).toBe(ambient.halos[i].cy);
      expect(layer.size).toEqual({ x: ambient.halos[i].r, y: ambient.halos[i].r });
    });
  });

  it('leva `top` e `left` juntos em toda camada', () => {
    // `RadialGradient.parse` devolve null — descartando o gradiente em silencio —
    // se faltar (top|bottom) ou (left|right).
    for (const layer of ambientBackground) {
      expect(layer.position.top).toBeDefined();
      expect(layer.position.left).toBeDefined();
    }
  });

  it('reproduz a queda de `ambient.falloff` em cada halo', () => {
    ambientBackground.forEach((layer, i) => {
      expect(layer.colorStops).toHaveLength(ambient.falloff.length);
      layer.colorStops.forEach((stop, j) => {
        const point = ambient.falloff[j];
        expect(stop.position).toBe(`${point.offset * 100}%`);
        expect(alphaOf(stop.color)).toBeCloseTo(ambient.halos[i].opacity * point.weight, 10);
      });
    });
  });

  it('chega a zero no fim de todo halo, para o campo nao ter borda', () => {
    for (const layer of ambientBackground) {
      const last = layer.colorStops[layer.colorStops.length - 1];
      expect(last.position).toBe('100%');
      expect(alphaOf(last.color)).toBe(0);
    }
  });

  it('sobrevive ao processamento de estilo do RN', () => {
    // O de verdade: se o formato estiver errado, `processBackgroundImage`
    // devolve [] e o campo some sem aviso. Este teste e o que impede isso de
    // chegar no aparelho.
    const processed = processBackgroundImage(ambientBackground);

    expect(processed).toHaveLength(ambient.halos.length);
    for (const layer of processed) {
      expect(layer.type).toBe('radial-gradient');
    }
  });
});

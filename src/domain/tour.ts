/**
 * A geometria do tour guiado: onde cai o recorte em volta do elemento e de que
 * lado o texto cabe.
 *
 * Pura e testada porque e conta de posicao, e conta de posicao errada e o tipo
 * de bug que so aparece num aparelho especifico — texto fora da tela, recorte
 * meio pixel deslocado do botao.
 */

export type Rect = { x: number; y: number; width: number; height: number };
export type Screen = { width: number; height: number };

/** Respiro entre o elemento e a borda do recorte. */
const PADDING = 8;

export type Spotlight = {
  /** O buraco no fundo escurecido: o elemento continua visivel e aceso. */
  hole: Rect;
  /** As quatro faixas escuras em volta do buraco. */
  bars: { top: Rect; bottom: Rect; left: Rect; right: Rect };
  /** O texto vai acima do elemento (quando ele esta na metade de baixo da tela). */
  above: boolean;
};

export function spotlight(target: Rect, screen: Screen, padding = PADDING): Spotlight {
  // Preso a tela: um alvo parcialmente fora (meio rolado) nao pode gerar faixa
  // de largura negativa, que o RN desenha como faixa cheia e apaga a tela toda.
  const x = Math.max(0, target.x - padding);
  const y = Math.max(0, target.y - padding);
  const width = Math.min(screen.width - x, target.width + padding * 2);
  const height = Math.min(screen.height - y, target.height + padding * 2);
  const hole: Rect = { x, y, width, height };

  return {
    hole,
    bars: {
      top: { x: 0, y: 0, width: screen.width, height: y },
      bottom: {
        x: 0,
        y: y + height,
        width: screen.width,
        height: Math.max(0, screen.height - (y + height)),
      },
      left: { x: 0, y, width: x, height },
      right: {
        x: x + width,
        y,
        width: Math.max(0, screen.width - (x + width)),
        height,
      },
    },
    // Metade de baixo da tela: o texto sobe, senao ele nasceria atras do
    // proprio elemento ou fora da tela.
    above: y + height / 2 > screen.height / 2,
  };
}

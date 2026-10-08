import { spotlight } from '../tour';

const screen = { width: 390, height: 844 };

describe('spotlight', () => {
  it('abre o buraco com respiro em volta do elemento', () => {
    const { hole } = spotlight({ x: 20, y: 300, width: 350, height: 54 }, screen);
    expect(hole).toEqual({ x: 12, y: 292, width: 366, height: 70 });
  });

  it('as faixas cobrem a tela inteira menos o buraco', () => {
    const { hole, bars } = spotlight({ x: 20, y: 300, width: 350, height: 54 }, screen);
    const covered =
      bars.top.height + bars.bottom.height + hole.height;
    expect(covered).toBe(screen.height);
    expect(bars.left.width + hole.width + bars.right.width).toBe(screen.width);
  });

  it('elemento na metade de baixo leva o texto para cima', () => {
    expect(spotlight({ x: 20, y: 700, width: 350, height: 54 }, screen).above).toBe(true);
    expect(spotlight({ x: 20, y: 120, width: 350, height: 54 }, screen).above).toBe(false);
  });

  it('alvo encostado na borda nao gera faixa negativa', () => {
    const { bars } = spotlight({ x: 0, y: 0, width: 390, height: 60 }, screen);
    expect(bars.left.width).toBe(0);
    expect(bars.right.width).toBe(0);
    expect(bars.top.height).toBe(0);
    expect(bars.bottom.height).toBeGreaterThan(0);
  });

  it('alvo maior que a tela nao estoura para fora dela', () => {
    const { hole } = spotlight({ x: 10, y: 800, width: 370, height: 200 }, screen);
    expect(hole.y + hole.height).toBeLessThanOrEqual(screen.height);
  });
});

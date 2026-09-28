import {
  BAR_MAX,
  barLayout,
  barShapes,
  goalSquareShapes,
  hBarShapes,
  hLineShapes,
  lineShapes,
  topRoundedBar,
  type GlowPath,
  type GlowRect,
} from '../shapes';

/**
 * A geometria dos graficos com glow, separada do Skia: o Skia nao roda no
 * Jest, e e aqui que moram as regras que dao para errar — escala comum, barra
 * zero que nao aparece, o respiro entre marcas, o estado na forma.
 */

const COR = '#FF5C00';

/** A altura de uma barra, lida do caminho: da base ao `V` do topo reto. */
function barTop(shape: GlowPath): number {
  const match = /A[\d.]+,[\d.]+ 0 0 1 [\d.]+,([\d.]+)/.exec(shape.d);
  return Number(match?.[1]);
}

describe('barLayout', () => {
  it('cada barra no meio da sua fatia, a mesma que o dedo le', () => {
    const layout = barLayout(4, 200);
    expect(layout.slot).toBe(50);
    expect(layout.center(0)).toBe(25);
    expect(layout.center(3)).toBe(175);
  });

  it('a barra nunca passa de 24dp, por mais larga que seja a fatia', () => {
    expect(barLayout(2, 400).barWidth).toBe(BAR_MAX);
  });
});

describe('barShapes', () => {
  const bars = (values: number[], extra: object = {}) =>
    barShapes({ values, max: 10, width: 120, height: 100, color: COR, ...extra });

  it('zero nao desenha barra', () => {
    expect(bars([0, 5, 0])).toHaveLength(1);
  });

  it('a altura segue a escala comum, nao o maior valor da fileira', () => {
    const [half] = bars([5]);
    expect(barTop(half)).toBe(50);
  });

  it('valor pequeno ainda aparece, e valor acima do topo e cortado no topo', () => {
    const [tiny, over] = bars([0.001, 50]);
    expect(barTop(tiny)).toBeLessThan(100);
    expect(barTop(over)).toBe(0);
  });

  it('o periodo atual ganha glow forte', () => {
    const shapes = bars([1, 2, 3], { highlight: 2 });
    expect(shapes.map((shape) => shape.glow)).toEqual(['soft', 'soft', 'strong']);
  });

  it('na leitura, a barra lida acende e as outras apagam', () => {
    const shapes = bars([1, 2, 3], { highlight: 2, selected: 0 });
    expect(shapes[0]).toMatchObject({ glow: 'strong', opacity: 1 });
    expect(shapes[2].glow).toBe('soft');
    expect(shapes[2].opacity).toBeLessThan(1);
  });
});

describe('topRoundedBar', () => {
  it('a base e reta: comeca e termina na linha de base', () => {
    const d = topRoundedBar(10, 20, 8, 30, 4);
    expect(d.startsWith('M10,50')).toBe(true);
    expect(d).toContain('V50');
  });

  it('o raio nunca passa da metade da largura nem da altura', () => {
    expect(topRoundedBar(0, 0, 4, 1, 4)).toContain('A1,1');
  });
});

describe('hLineShapes', () => {
  it('uma linha por altura, de ponta a ponta', () => {
    const lines = hLineShapes({ ys: [10, 40], width: 100, color: '#333' });
    expect(lines.map((line) => line.d)).toEqual(['M0,10 H100', 'M0,40 H100']);
  });

  it('a linha do topo desce meio dp para nao sair cortada', () => {
    const [line] = hLineShapes({ ys: [0], width: 100, color: '#333' });
    expect(line.d).toBe('M0,0.5 H100');
  });
});

describe('lineShapes', () => {
  const points = [
    { x: 0, y: 50 },
    { x: 50, y: 20 },
    { x: 100, y: 30 },
  ];
  const shapes = (lit: number | null) =>
    lineShapes({ points, height: 80, color: COR, area: 'a', fade: 'f', ring: 'r', lit });

  it('area fecha na base, embaixo da linha', () => {
    const [area] = shapes(null) as GlowPath[];
    expect(area.d).toMatch(/L100,80 L0,80 Z$/);
    expect(area.gradient).toEqual({ from: 'a', to: 'f', y0: 20, y1: 80 });
  });

  it('linha de 2dp com glow', () => {
    const line = shapes(null)[1] as GlowPath;
    expect(line).toMatchObject({ style: 'stroke', strokeWidth: 2, glow: 'soft' });
  });

  it('um ponto so: o ultimo, ou o lido', () => {
    const last = shapes(null).at(-1) as GlowRect;
    expect(last.x + last.w / 2).toBe(100);
    const read = shapes(1).at(-1) as GlowRect;
    expect(read.x + read.w / 2).toBe(50);
    expect(read.w).toBeGreaterThanOrEqual(8);
  });

  it('um ponto so na serie: sem linha nem area', () => {
    const single = lineShapes({
      points: [{ x: 5, y: 5 }],
      height: 80,
      color: COR,
      area: 'a',
      fade: 'f',
      ring: 'r',
      lit: null,
    });
    expect(single.every((shape) => shape.kind !== 'path')).toBe(true);
  });
});

describe('hBarShapes', () => {
  const bar = (progress: number) =>
    hBarShapes({ progress, width: 200, height: 8, color: COR, track: '#222', glow: 'soft' });

  it('trilho inteiro e barra ate o progresso', () => {
    const [track, fill] = bar(0.5);
    expect(track.w).toBe(200);
    expect(fill.w).toBe(100);
  });

  it('zero mostra so o trilho', () => {
    expect(bar(0)).toHaveLength(1);
  });

  it('progresso minimo vira pilula, nao ponto', () => {
    expect(bar(0.001)[1].w).toBe(8);
  });
});

describe('goalSquareShapes', () => {
  const squares = (goals: ('closed' | 'missed' | 'open')[]) =>
    goalSquareShapes({ goals, width: 200, color: COR, muted: '#555', open: '#888' });

  // O estado vai na forma, nao so na cor: cheio, contorno, tracejado.
  it('fechou e cheio na cor da pessoa, com glow', () => {
    const [square] = squares(['closed']);
    expect(square).toMatchObject({ style: 'fill', color: COR, glow: 'soft' });
  });

  it('nao fechou e so contorno, sem glow', () => {
    const [square] = squares(['missed']);
    expect(square).toMatchObject({ style: 'stroke', color: '#555', glow: 'none' });
    expect(square.dash).toBeUndefined();
  });

  it('a semana em andamento e contorno tracejado', () => {
    const [square] = squares(['open']);
    expect(square).toMatchObject({ style: 'stroke', color: '#888', glow: 'none' });
    expect(square.dash).toBeDefined();
  });

  it('quadrados de lado igual, sem se encostar, no maximo 12dp', () => {
    const shapes = squares(['closed', 'missed', 'closed']);
    expect(new Set(shapes.map((shape) => shape.w)).size).toBe(1);
    expect(shapes[0].w).toBeLessThanOrEqual(12);
    expect(shapes[1].x - (shapes[0].x + shapes[0].w)).toBeGreaterThan(0);
  });

  it('cada quadrado no meio da sua fatia, como as barras', () => {
    const shapes = squares(['closed', 'closed']);
    expect(shapes[1].x + shapes[1].w / 2).toBe(barLayout(2, 200).center(1));
  });

  it('respeita o teto pedido quando ha espaco', () => {
    const [square] = goalSquareShapes({
      goals: ['closed', 'missed'],
      width: 300,
      color: COR,
      muted: '#555',
      open: '#888',
      maxSize: 18,
    });
    expect(square.w).toBe(18);
  });
});

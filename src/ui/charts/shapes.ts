import type { GlowLevel } from '@/theme/tokens';

/**
 * As marcas de grafico que o `GlowCanvas` sabe desenhar, cada uma com o glow
 * que leva. As regras de cada grafico ficam aqui, puras, onde o Jest alcanca
 * (o Skia nao roda nele).
 *
 * Duas formas:
 * - `rect`, um retangulo arredondado, cheio ou so contorno. O contorno e
 *   desenhado por DENTRO da caixa (o canvas recua meia linha), para um quadrado
 *   vazado ter o mesmo tamanho aparente de um cheio.
 * - `path`, um caminho SVG: a barra de topo arredondado e base reta, a linha da
 *   evolucao, a area embaixo dela e as linhas de grade.
 */
type Common = {
  color: string;
  glow: GlowLevel;
  /** Tracejado do contorno, em dp: [traco, vao]. */
  dash?: [number, number];
  /** Apaga a marca inteira: as barras fora da leitura, quando ha leitura. */
  opacity?: number;
};

export type GlowRect = Common & {
  kind?: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  style: 'fill' | 'stroke';
};

export type GlowPath = Common & {
  kind: 'path';
  d: string;
  style: 'fill' | 'stroke';
  strokeWidth?: number;
  /** Degrade vertical no preenchimento, de `from` em `y0` a `to` em `y1`. */
  gradient?: { from: string; to: string; y0: number; y1: number };
};

export type GlowShape = GlowRect | GlowPath;

/** Largura maxima de uma barra: mais grossa que isso, o vao some e vira bloco. */
export const BAR_MAX = 24;
/** Quanto da fatia de cada periodo a barra ocupa; o resto e respiro. */
const BAR_SHARE = 0.62;
/** O raio do topo da barra. A base fica reta, sentada na linha de base. */
const BAR_RADIUS = 4;
/** Um valor positivo nunca some: vira um toco de 2dp, que ainda se ve. */
const BAR_MIN = 2;
/** As barras fora da leitura, enquanto o dedo le uma. */
const DIMMED = 0.35;

/**
 * Onde cada barra cai numa fileira de `count` barras. Cada periodo tem a sua
 * fatia da largura, e a barra fica no meio dela — a mesma fatia que o dedo le
 * (`barIndexAt`), e o mesmo centro onde cai o rotulo do mes.
 */
export function barLayout(count: number, width: number) {
  const slot = count > 0 ? width / count : 0;
  const barWidth = Math.max(2, Math.min(BAR_MAX, slot * BAR_SHARE));
  return {
    slot,
    barWidth,
    center: (index: number) => slot * index + slot / 2,
  };
}

/**
 * Uma barra por periodo, crescendo da base, na cor da pessoa.
 *
 * `highlight` e o periodo atual (glow forte, e o "agora" do grafico). Com
 * `selected`, a barra lida acende e as outras apagam, para o olho achar
 * a leitura.
 */
export function barShapes({
  values,
  max,
  width,
  height,
  color,
  highlight = null,
  selected = null,
}: {
  values: readonly number[];
  max: number;
  width: number;
  height: number;
  color: string;
  highlight?: number | null;
  selected?: number | null;
}): GlowPath[] {
  if (values.length === 0 || max <= 0) return [];
  const { barWidth, center } = barLayout(values.length, width);

  const shapes: GlowPath[] = [];
  values.forEach((value, index) => {
    if (value <= 0) return;
    const h = Math.max(BAR_MIN, (Math.min(value, max) / max) * height);
    const lit = selected === null ? index === highlight : index === selected;
    shapes.push({
      kind: 'path',
      d: topRoundedBar(center(index) - barWidth / 2, height - h, barWidth, h, BAR_RADIUS),
      color,
      style: 'fill',
      glow: lit ? 'strong' : 'soft',
      opacity: selected !== null && index !== selected ? DIMMED : 1,
    });
  });
  return shapes;
}

/** Retangulo com as duas quinas de cima arredondadas e a base reta. */
export function topRoundedBar(x: number, y: number, w: number, h: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, w / 2, h));
  return [
    `M${x},${y + h}`,
    `V${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    `H${x + w - r}`,
    `A${r},${r} 0 0 1 ${x + w},${y + r}`,
    `V${y + h}`,
    'Z',
  ].join(' ');
}

/**
 * Linhas horizontais atravessando o grafico: as de grade, continuas, e a de
 * referencia (a media), tracejada — as duas nao podem se confundir.
 */
export function hLineShapes({
  ys,
  width,
  color,
  dash,
}: {
  ys: readonly number[];
  width: number;
  color: string;
  dash?: [number, number];
}): GlowPath[] {
  return ys.map((y) => ({
    kind: 'path',
    // Uma linha de 1dp se espalha meio dp para cada lado: na borda de cima ela
    // sairia cortada pela metade.
    d: `M0,${Math.max(0.5, y)} H${width}`,
    color,
    style: 'stroke',
    strokeWidth: 1,
    glow: 'none',
    dash,
  }));
}

/** O ponto em destaque da linha: 8dp, com um anel da cor do card em volta. */
const DOT = 8;
const RING = 2;

/**
 * A evolucao de uma serie: a area em degrade embaixo, a linha de 2dp com glow
 * por cima e UM ponto — o lido, ou o ultimo, o "agora" que o numero grande do
 * card repete. Um ponto em cada treino virava colar de contas.
 */
export function lineShapes({
  points,
  height,
  color,
  area,
  fade,
  ring,
  lit,
}: {
  points: readonly { x: number; y: number }[];
  height: number;
  color: string;
  /** A cor da area no topo; ela desbota ate `fade` na base. */
  area: string;
  /** A mesma cor da area, transparente: desbotar para 'transparent' puxa para o cinza. */
  fade: string;
  /** A cor do anel do ponto: a do card, para ele descolar da linha. */
  ring: string;
  lit: number | null;
}): GlowShape[] {
  if (points.length === 0) return [];
  const shapes: GlowShape[] = [];

  if (points.length > 1) {
    const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`);
    const first = points[0];
    const last = points[points.length - 1];
    const top = Math.min(...points.map((point) => point.y));
    shapes.push({
      kind: 'path',
      d: `${line.join(' ')} L${last.x},${height} L${first.x},${height} Z`,
      color: area,
      style: 'fill',
      glow: 'none',
      gradient: { from: area, to: fade, y0: top, y1: height },
    });
    shapes.push({
      kind: 'path',
      d: line.join(' '),
      color,
      style: 'stroke',
      strokeWidth: 2,
      glow: 'soft',
    });
  }

  const dot = points[lit ?? points.length - 1];
  if (dot) {
    const outer = DOT + RING * 2;
    shapes.push({
      x: dot.x - outer / 2,
      y: dot.y - outer / 2,
      w: outer,
      h: outer,
      r: outer / 2,
      color: ring,
      style: 'fill',
      glow: 'none',
    });
    shapes.push({
      x: dot.x - DOT / 2,
      y: dot.y - DOT / 2,
      w: DOT,
      h: DOT,
      r: DOT / 2,
      color,
      style: 'fill',
      glow: 'strong',
    });
  }
  return shapes;
}

/**
 * Uma barra horizontal cheia ate `progress` (0 a 1), sobre um trilho. O
 * trilho mostra onde seria o 100%, e a barra se compara com ele e com as de
 * cima e de baixo.
 */
export function hBarShapes({
  progress,
  width,
  height,
  color,
  track,
  glow,
}: {
  progress: number;
  width: number;
  height: number;
  color: string;
  track: string;
  glow: GlowLevel;
}): GlowRect[] {
  const r = height / 2;
  const clamped = Math.min(1, Math.max(0, progress));
  const shapes: GlowRect[] = [
    { x: 0, y: 0, w: width, h: height, r, color: track, style: 'fill', glow: 'none' },
  ];
  if (clamped > 0) {
    // Nunca menor que a propria altura: abaixo disso a pilula vira um ponto.
    const w = Math.max(height, clamped * width);
    shapes.push({ x: 0, y: 0, w, h: height, r, color, style: 'fill', glow });
  }
  return shapes;
}

const SQUARE_MAX = 12;
const SQUARE_GAP = 3;
const SQUARE_RADIUS = 3;

/**
 * Um quadrado por semana na meta. O estado vai na FORMA, nao so na cor:
 * cheio (fechou), contorno (nao fechou), tracejado (semana em andamento).
 */
export function goalSquareShapes({
  goals,
  width,
  color,
  muted,
  open,
  maxSize = SQUARE_MAX,
}: {
  goals: readonly ('closed' | 'missed' | 'open')[];
  width: number;
  color: string;
  muted: string;
  open: string;
  /** Teto do lado do quadrado: 12 numa fileira de lista, maior num destaque. */
  maxSize?: number;
}): GlowRect[] {
  const count = goals.length;
  if (count === 0) return [];
  const size = goalSquareSize(width, count, maxSize);
  // Os quadrados se espalham pela largura toda, cada um no meio da sua fatia:
  // assim os meses de baixo caem embaixo da semana certa (ver `barLayout`).
  const slot = width / count;

  return goals.map((goal, index) => {
    const base = {
      x: slot * index + (slot - size) / 2,
      y: 0,
      w: size,
      h: size,
      r: SQUARE_RADIUS,
    };
    if (goal === 'closed') return { ...base, color, style: 'fill', glow: 'soft' };
    if (goal === 'open') {
      return { ...base, color: open, style: 'stroke', glow: 'none', dash: [2, 2] };
    }
    return { ...base, color: muted, style: 'stroke', glow: 'none' };
  });
}

/** Altura de uma fileira de quadrados, para quem precisa reservar o espaco. */
export function goalSquareSize(width: number, count: number, maxSize = SQUARE_MAX): number {
  if (count === 0) return 0;
  return Math.min(maxSize, (width - SQUARE_GAP * (count - 1)) / count);
}

/** O intervalo de valores que a altura de um grafico cobre, de baixo para cima. */
export type Domain = { low: number; high: number };

/**
 * O dominio de um grafico de linha.
 *
 * O eixo Y nao comeca no zero: a progressao de uma carga anda 2,5 kg sobre
 * 60 kg, e um eixo ancorado no zero achataria tudo numa reta. A folga de 10%
 * em cima e embaixo impede que o ponto mais alto e o mais baixo encostem na
 * borda.
 */
export function lineDomain(values: readonly number[]): Domain | null {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.1;
  return { low: min - pad, high: max + pad };
}

/**
 * O `y` de tela de um valor. Pontos e linhas de grade passam os dois por aqui,
 * senao a linha dos 25 kg nao passaria pelo ponto de 25 kg. Dominio sem altura
 * (serie constante, ou um ponto so) poe tudo no meio.
 */
export function valueY(value: number, domain: Domain, height: number, inset: number): number {
  const range = domain.high - domain.low;
  if (range <= 0) return height / 2;
  return inset + (1 - (value - domain.low) / range) * (height - inset * 2);
}

/** Valores em coordenadas de tela para os graficos de linha. */
export function plotPoints(
  values: readonly number[],
  width: number,
  height: number,
  inset: number,
): { x: number; y: number }[] {
  const domain = lineDomain(values);
  if (!domain) return [];

  const step = values.length > 1 ? (width - inset * 2) / (values.length - 1) : 0;

  return values.map((value, index) => ({
    x: values.length > 1 ? inset + step * index : width / 2,
    y: valueY(value, domain, height, inset),
  }));
}

/**
 * Multiplos que uma linha de grade pode marcar, vezes uma potencia de dez.
 * O 2,5 esta aqui pela academia: e o passo da anilha, e uma grade em 22,5 / 25
 * le como a propria barra carregada.
 */
const NICE_FACTORS = [1, 2, 2.5, 5] as const;

/** Folga de ponto flutuante: 0,1 x 3 nao e 0,3, e o 0,3 nao pode cair fora. */
const EPSILON = 1e-9;

/**
 * Os valores redondos por onde passam as linhas de grade dentro de
 * [low, high], no maximo `maxCount` deles.
 *
 * Fica com o menor passo que caiba: passo pequeno demais vira pauta de
 * caderno, e grande demais deixa o grafico sem referencia nenhuma.
 */
export function niceTicks(low: number, high: number, maxCount: number): number[] {
  if (!(high > low) || maxCount < 1) return [];

  // Comeca uma potencia abaixo do passo ingenuo, onde ainda sobram linhas, e
  // sobe: o primeiro passo que cabe e o mais fino que cabe.
  const exponent = Math.floor(Math.log10((high - low) / maxCount));
  for (let power = exponent - 1; power <= exponent + 2; power++) {
    for (const factor of NICE_FACTORS) {
      const step = factor * 10 ** power;
      const first = Math.ceil(low / step - EPSILON);
      const last = Math.floor(high / step + EPSILON);
      if (last - first + 1 <= maxCount) {
        return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) =>
          roundTick((first + index) * step),
        );
      }
    }
  }
  return [];
}

/** 22,500000000000004 volta a ser 22,5. */
function roundTick(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** "+7,5" / "−2,9" / "0": a variacao com sinal, no formato de peso do app. */
export function signedDelta(delta: number, format: (value: number) => string): string {
  if (delta === 0) return '0';
  return `${delta > 0 ? '+' : '−'}${format(Math.abs(delta))}`;
}

/**
 * Os blocos de uma coluna empilhada, de baixo para cima: a distancia de cada um
 * ate a base e a altura dele.
 *
 * A coluna mede o total, e as frestas entre os blocos saem de dentro dela, nao
 * somam por fora: uma semana de cinco treinos nao pode ficar mais alta que uma
 * de dois com o mesmo volume so por ter mais frestas. Cada bloco fica com a sua
 * fatia do que sobra. Nenhum bloco some (`minBlock`): um treino leve continua
 * sendo um treino, e nesse caso raro a coluna passa um pouco do total.
 */
export function stackBlocks(
  values: readonly number[],
  columnHeight: number,
  gap: number,
  minBlock: number,
): { bottom: number; height: number }[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];

  const room = Math.max(0, columnHeight - gap * (values.length - 1));
  let bottom = 0;
  return values.map((value) => {
    const block = { bottom, height: Math.max(minBlock, (value / total) * room) };
    bottom += block.height + gap;
    return block;
  });
}

/**
 * A barra sob o dedo numa fileira de `count` barras espalhadas pela largura.
 *
 * Cada barra responde pela sua fatia inteira da largura, e nao so pelos poucos
 * pixels que ela ocupa: com 14 barras de ~10px, acertar a barra em si seria
 * mira, nao leitura. Toque fora das bordas cai na ponta mais proxima.
 */
export function barIndexAt(x: number, width: number, count: number): number {
  if (count <= 0 || width <= 0) return 0;
  return clampIndex(Math.floor((x / width) * count), count);
}

/**
 * O ponto mais proximo do dedo num grafico de `plotPoints` com o mesmo `inset`.
 * O limite entre dois pontos e o meio do caminho entre eles.
 */
export function pointIndexAt(x: number, width: number, count: number, inset: number): number {
  if (count <= 1) return 0;
  const step = (width - inset * 2) / (count - 1);
  if (step <= 0) return 0;
  return clampIndex(Math.round((x - inset) / step), count);
}

function clampIndex(index: number, count: number): number {
  return Math.min(count - 1, Math.max(0, index));
}

import { fromDateKey, monthLabelShort, toDateKey } from '@/domain/week';

/**
 * Os eixos dos graficos: os meses embaixo e a escala de valores do lado.
 *
 * Puro, para o Jest alcancar — os componentes so desenham o que sai daqui.
 */

export type MonthTick = { index: number; label: string };

/**
 * Um rotulo de mes ("jul", "ago") no primeiro ponto de cada mes novo.
 *
 * Substitui as datas so nas pontas: com elas o leitor tinha que contar barras
 * para saber onde caia agosto. O rotulo da ponta esquerda e o unico que pode
 * cair no meio de um mes; ele sai quando o mes seguinte comeca a menos de
 * `minGap` pontos, senao os dois textos se encostam.
 */
export function monthTicks(dateKeys: readonly string[], minGap = 2): MonthTick[] {
  const ticks: MonthTick[] = [];
  let previous = -1;
  dateKeys.forEach((key, index) => {
    const month = fromDateKey(key).getMonth();
    if (month !== previous) ticks.push({ index, label: monthLabelShort(month).toLowerCase() });
    previous = month;
  });
  if (ticks.length > 1 && ticks[0].index === 0 && ticks[1].index < minGap) ticks.shift();
  return ticks;
}

/**
 * A data que decide o mes de uma semana: a quinta, o meio dela (a semana
 * comeca no domingo, ver `weekStartKey`). Uma semana de 30 ago a 5 set tem
 * mais dias em setembro, e le como setembro.
 *
 * Nunca depois de `today`: a semana em curso de 27 set a 3 out, lida numa
 * segunda 28 set, ainda e setembro — um "out" no eixo seria um mes que nao
 * comecou.
 */
export function weekMonthKey(weekStart: string, today?: string): string {
  const start = fromDateKey(weekStart);
  const middle = toDateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 4));
  return today !== undefined && today < middle ? today : middle;
}

/**
 * Multiplos que uma linha de grade pode marcar, vezes uma potencia de dez — os
 * mesmos de `niceTicks`, com o 2,5 da anilha.
 */
const FACTORS = [1, 2, 2.5, 5] as const;

/**
 * A escala de um grafico que nasce do zero (barras): o topo arredondado para
 * cima e as linhas de grade ate ele, no maximo `maxLines`.
 *
 * O topo sobe ate o proximo valor redondo, e nao para no pico: assim a linha
 * mais alta tem numero, e a barra mais alta nao encosta no teto do card.
 */
export function niceScale(peak: number, maxLines: number): { max: number; ticks: number[] } {
  if (!(peak > 0) || maxLines < 1) return { max: 1, ticks: [] };
  const exponent = Math.floor(Math.log10(peak / maxLines));
  for (let power = exponent - 1; power <= exponent + 2; power++) {
    for (const factor of FACTORS) {
      const step = factor * 10 ** power;
      const lines = Math.ceil(peak / step - 1e-9);
      if (lines <= maxLines) {
        const ticks = Array.from({ length: lines }, (_, index) => round((index + 1) * step));
        return { max: ticks[ticks.length - 1], ticks };
      }
    }
  }
  return { max: peak, ticks: [peak] };
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

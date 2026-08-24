import { fromDateKey, lastNDays, toDateKey } from './week';

/**
 * Historico de treino para o dot-matrix da home.
 *
 * O brief manda escala de cinza — ponto apagado sem treino, ponto cheio com
 * treino — e no maximo UM ponto em accent, reservado ao recorde de volume.
 * Nada de heatmap colorido tipo GitHub.
 */

export type DayDot = {
  dateKey: string;
  trained: boolean;
  /**
   * Carga do dia relativa ao dia mais pesado da janela, de 0 a 1. E o que
   * define quao claro o quadrado fica: dia leve quase some no fundo, dia
   * pesado vem branco. Sempre 0 em dia sem treino.
   */
  intensity: number;
  /** true apenas no dia de maior volume da janela — o unico ponto em accent. */
  record: boolean;
};

export function buildDotMatrix(
  volumeByDate: ReadonlyMap<string, number>,
  end: Date,
  days: number,
): DayDot[] {
  const keys = lastNDays(end, days);

  let recordKey: string | null = null;
  let recordVolume = 0;
  for (const key of keys) {
    const volume = volumeByDate.get(key) ?? 0;
    if (volume > recordVolume) {
      recordVolume = volume;
      recordKey = key;
    }
  }

  return keys.map((dateKey) => {
    const volume = volumeByDate.get(dateKey) ?? 0;
    return {
      dateKey,
      trained: volume > 0,
      // Relativo ao recorde da janela, nao a um teto absoluto: o que interessa
      // e comparar os dias entre si. Com `recordVolume` em 0 (ninguem treinou)
      // a divisao nao acontece e tudo fica em 0.
      intensity: recordVolume > 0 ? volume / recordVolume : 0,
      record: dateKey === recordKey,
    };
  });
}

const ROWS = 7;

export type DotCell = DayDot & { row: number; column: number };

export type MonthBlock = {
  /** 0-11, como em `Date.getMonth()`. */
  month: number;
  year: number;
  /** Quantas semanas este mes ocupa — largura do bloco, em celulas. */
  columns: number;
  /** `row`/`column` sao relativos ao bloco, nao a janela inteira. */
  cells: DotCell[];
};

/**
 * Quebra a janela em um bloco por mes, cada um uma grade de uma coluna por
 * semana e sete linhas por dia da semana.
 *
 * Blocos separados, e nao uma faixa continua, e o que dispensa a antiga regra
 * de colisao de rotulos: cada mes carrega o proprio titulo em cima do proprio
 * bloco, e o respiro entre blocos garante que dois rotulos nunca se encostem.
 * A versao anterior media a distancia em pixels entre rotulos e descartava os
 * que nao coubessem — precisava saber a largura da celula aqui dentro, o que
 * misturava layout visual com posicionamento de dados.
 *
 * Dentro de cada bloco a primeira coluna e alinhada pelo dia da semana do
 * primeiro dia dele, senao a grade nao bate com o calendario e os quadrados
 * "andam" a cada dia que passa.
 */
export function monthBlocks(dots: readonly DayDot[]): MonthBlock[] {
  const blocks: MonthBlock[] = [];

  for (const dot of dots) {
    const date = fromDateKey(dot.dateKey);
    const month = date.getMonth();
    const year = date.getFullYear();

    let block = blocks[blocks.length - 1];
    if (!block || block.month !== month || block.year !== year) {
      block = { month, year, columns: 0, cells: [] };
      blocks.push(block);
    }

    // O offset do primeiro dia do bloco desloca todo o resto: se o mes comeca
    // numa quarta, a coluna 0 so tem os dias de quarta em diante.
    const leading = fromDateKey(block.cells[0]?.dateKey ?? dot.dateKey).getDay();
    const slot = leading + block.cells.length;

    block.cells.push({ ...dot, row: slot % ROWS, column: Math.floor(slot / ROWS) });
    block.columns = Math.floor(slot / ROWS) + 1;
  }

  return blocks;
}

/**
 * Dias consecutivos treinando, contando de tras para frente a partir de hoje.
 * Nao treinar hoje ainda nao quebra a sequencia — o dia ainda nao acabou —
 * entao a contagem pode comecar em ontem.
 */
export function currentStreak(trainedDates: ReadonlySet<string>, today: Date): number {
  const cursor = new Date(today);
  if (!trainedDates.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!trainedDates.has(toDateKey(cursor))) return 0;
  }

  let streak = 0;
  while (trainedDates.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

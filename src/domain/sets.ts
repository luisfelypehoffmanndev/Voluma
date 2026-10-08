import type { SessionSet } from './types';

/**
 * As series de UM exercicio, editaveis serie a serie na tela de sessao.
 *
 * `id` e `null` enquanto a serie so existe no rascunho local, ainda sem linha
 * correspondente no banco — o caso de um exercicio nunca tocado nesta sessao,
 * cujas series sao sinteticas a partir do plano (ver `rowsForExercise` em
 * `app/session/[id].tsx`). Uma vez que o exercicio e marcado concluido, toda
 * serie ganha um `id` real, porque a escrita (`setSessionExerciseSets`)
 * materializa o exercicio inteiro no banco.
 */
export type SetDraft = Pick<SessionSet, 'reps' | 'weightKg'> & {
  id: string | null;
  /** 1-based — so para exibir; a ordem de verdade e a posicao no array. */
  setIndex: number;
  /**
   * Esta serie foi feita.
   *
   * E por serie, e nao por exercicio, porque e assim que se treina: marca-se
   * uma serie, descansa-se, marca-se a proxima. O `done` do exercicio virou
   * derivado disto (`allDone`) — antes era o contrario, e durante o treino nao
   * existia "proxima serie" nenhuma na tela.
   *
   * O banco ja guardava assim desde a primeira migration (`session_sets.done`);
   * quem forcava o exercicio inteiro era a tela e a escrita.
   */
  done: boolean;
};

export type SetsSummary = {
  /** true quando reps E peso sao iguais em todas as series do exercicio. */
  uniform: boolean;
  /** reps unico, ou `null` quando ele diverge entre series. */
  reps: number | null;
  /** [min, max] do peso entre as series — degenerado ([w, w]) quando uniforme. */
  weightRange: [number, number];
  /** soma de reps x peso de cada serie — bem definido mesmo com series divergentes. */
  volume: number;
};

/**
 * O que o card mostra de um exercicio de musculacao: um numero so quando as
 * series sao iguais, ou uma faixa quando alguma diverge.
 *
 * Antes de existir edicao por serie, series de um exercicio nasciam sempre
 * uniformes — `setSessionExerciseTargets` repetia o mesmo par reps/peso em
 * todas. Series divergentes so aparecem a partir de uma edicao individual, e
 * e essa a razao desta funcao existir separada de `targetsFromSets`: aquela
 * responde "que numero descreve a ULTIMA serie" (para a cascata de alvos);
 * esta responde "da para descrever as series com um numero so".
 */
export function summarizeSets(rows: readonly Pick<SetDraft, 'reps' | 'weightKg'>[]): SetsSummary {
  if (rows.length === 0) {
    return { uniform: true, reps: 0, weightRange: [0, 0], volume: 0 };
  }

  const reps = rows[0].reps;
  const repsUniform = rows.every((row) => row.reps === reps);

  let min = rows[0].weightKg;
  let max = rows[0].weightKg;
  for (const row of rows) {
    if (row.weightKg < min) min = row.weightKg;
    if (row.weightKg > max) max = row.weightKg;
  }

  const volume = rows.reduce((sum, row) => sum + row.reps * row.weightKg, 0);

  return {
    uniform: repsUniform && min === max,
    reps: repsUniform ? reps : null,
    weightRange: [min, max],
    volume,
  };
}

/**
 * Compara duas listas de `SetDraft` posicao a posicao.
 *
 * Mesma razao de `sameTargets`: `loadSession` reconstroi `rows` do zero a cada
 * recarga, entao comparar por referencia nunca bloquearia re-render nenhum.
 * Series de um exercicio sao poucas (1-6 tipicamente), entao O(n) ingenuo e
 * suficiente — nao precisa de memoizacao adicional.
 */
export function sameSetDrafts(a: readonly SetDraft[], b: readonly SetDraft[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((row, index) => {
    const other = b[index];
    return (
      row.id === other.id &&
      row.setIndex === other.setIndex &&
      row.reps === other.reps &&
      row.weightKg === other.weightKg &&
      row.done === other.done
    );
  });
}

/**
 * A proxima serie a fazer: a primeira nao marcada. `null` quando o exercicio
 * acabou.
 *
 * E o que responde "o que eu faco agora?" sem o usuario tocar em nada — a tela
 * destaca exatamente esta. Primeira NAO marcada, e nao "a de menor indice
 * pendente depois da ultima marcada": quem marcou a 3 e voltou para corrigir a
 * 1 continua vendo a 1 como a da vez, que e onde a mao dele esta.
 */
export function nextSetIndex(rows: readonly Pick<SetDraft, 'done'>[]): number | null {
  const index = rows.findIndex((row) => !row.done);
  return index === -1 ? null : index;
}

/** Exercicio concluido = toda serie marcada. Sem serie nenhuma, nao esta. */
export function allDone(rows: readonly Pick<SetDraft, 'done'>[]): boolean {
  return rows.length > 0 && rows.every((row) => row.done);
}

/**
 * O par "feitas / total" do treino, contado em SERIES.
 *
 * O cabecalho e o botao de finalizar contavam exercicios ("3 de 5"), que e uma
 * unidade grossa demais para o meio do treino: marcar a terceira serie de
 * quatro nao mexia em nada na tela. Corrida entra como uma serie so — ela nao
 * se fatia (ver `run.ts`), e some do contador se contar zero.
 */
export function countSets(
  items: readonly { rows: readonly Pick<SetDraft, 'done'>[]; done: boolean }[],
): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const item of items) {
    if (item.rows.length === 0) {
      total += 1;
      if (item.done) done += 1;
      continue;
    }
    total += item.rows.length;
    done += item.rows.filter((row) => row.done).length;
  }
  return { done, total };
}

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

import type { ExerciseRow } from './rows';

/**
 * Escolhas de "qual linha vale" que precisam ser testaveis.
 *
 * Moram fora de `repo.ts` porque ele importa o SQLite: aqui a regra e funcao
 * pura sobre linhas ja lidas, e o teste roda sem banco nenhum — o mesmo padrao
 * do resto do projeto, onde nenhum teste abre arquivo.
 */

/** O nome do exercicio fixo de corrida. */
export const RUN_EXERCISE_NAME = 'Corrida';

/**
 * A corrida entre os exercicios medidos em distancia e tempo, ou `null` quando
 * ela ainda nao existe e precisa ser criada.
 *
 * O filtro por NOME e o ponto todo: `kind = 'run'` nao e exclusivo da corrida —
 * caminhada, bicicleta e remo tambem entram, porque `kindFor` classifica assim
 * tudo que e medido em distancia e tempo (`src/movements/taxonomy.ts`). Antes
 * disto a escolha era so uma ordenacao preferindo "Corrida", e ordenacao nao
 * filtra: com caminhada no banco e sem corrida, havia um unico candidato e o
 * botao "Adicionar corrida" punha caminhada no dia.
 *
 * Duplicata acontece de verdade — dois aparelhos criando a corrida offline ao
 * mesmo tempo geram duas linhas, e o sync traz as duas. Vence a mais antiga,
 * com o id como desempate final, para que todo aparelho escolha a MESMA.
 */
export function pickCanonicalRun(rows: readonly ExerciseRow[]): ExerciseRow | null {
  const candidates = rows.filter((row) => row.name === RUN_EXERCISE_NAME);
  if (candidates.length === 0) return null;

  return candidates.reduce((winner, row) => {
    if (row.updated_at !== winner.updated_at) {
      return row.updated_at < winner.updated_at ? row : winner;
    }
    return row.id < winner.id ? row : winner;
  });
}

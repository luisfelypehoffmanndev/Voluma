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

/**
 * O que vale quando o aparelho entra numa conta que ja tem dados: a conta.
 *
 * O onboarding e obrigatorio na primeira abertura, entao todo aparelho novo
 * (ou reinstalado) chega ao login com um catalogo e, as vezes, um plano
 * proprios, criados com ids que a conta nao conhece. Sem esta escolha, o
 * catalogo ficava com cada exercicio duas vezes, e o dia com duas rotinas, das
 * quais so uma aparece (`findDayRoutine`) e a outra some com seus exercicios.
 *
 * `localOnly` sao os ids que nunca subiram (estao na outbox). Devolve, para
 * cada linha so do aparelho que cede, o id da linha da conta que fica no lugar.
 */
export function routinesYieldingToAccount(
  routines: readonly { id: string; weekday: number; position: number; updatedAt: string }[],
  localOnly: ReadonlySet<string>,
): Map<string, string> {
  // A mesma rotina que o resto do app escolhe para o dia: ORDER BY position,
  // updated_at, id (`findDayRoutine`).
  const winners = new Map<number, (typeof routines)[number]>();
  for (const routine of routines) {
    if (localOnly.has(routine.id)) continue;
    const current = winners.get(routine.weekday);
    if (!current || compareRoutines(routine, current) < 0) winners.set(routine.weekday, routine);
  }

  const yielding = new Map<string, string>();
  for (const routine of routines) {
    if (!localOnly.has(routine.id)) continue;
    const winner = winners.get(routine.weekday);
    if (winner) yielding.set(routine.id, winner.id);
  }
  return yielding;
}

function compareRoutines(
  a: { id: string; position: number; updatedAt: string },
  b: { id: string; position: number; updatedAt: string },
): number {
  if (a.position !== b.position) return a.position - b.position;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * O mesmo para os exercicios, casados pelo nome normalizado (`key`): o do
 * aparelho cede ao da conta com o mesmo nome. Entre dois da conta com o mesmo
 * nome, vence o mais antigo, com o id como desempate — a regra de
 * `pickCanonicalRun`, para todo aparelho escolher o mesmo.
 */
export function exercisesYieldingToAccount(
  exercises: readonly { id: string; key: string; updatedAt: string }[],
  localOnly: ReadonlySet<string>,
): Map<string, string> {
  const winners = new Map<string, (typeof exercises)[number]>();
  for (const exercise of exercises) {
    if (localOnly.has(exercise.id)) continue;
    const current = winners.get(exercise.key);
    const older =
      !current ||
      exercise.updatedAt < current.updatedAt ||
      (exercise.updatedAt === current.updatedAt && exercise.id < current.id);
    if (older) winners.set(exercise.key, exercise);
  }

  const yielding = new Map<string, string>();
  for (const exercise of exercises) {
    if (!localOnly.has(exercise.id)) continue;
    const winner = winners.get(exercise.key);
    if (winner) yielding.set(exercise.id, winner.id);
  }
  return yielding;
}

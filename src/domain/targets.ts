import type { Targets } from './types';

/**
 * De onde saem os numeros de um exercicio numa semana.
 *
 * A regra do produto e "os exercicios vem como semana passada, por padrao, mas
 * da para mudar em cada semana". Isso vira uma cascata de tres degraus, e o
 * ponto importante e que os dois primeiros sao dinamicos: nada fica congelado
 * esperando o usuario corrigir na mao.
 *
 * Este modulo e puro de proposito — o SQL fica no repositorio. Assim a regra de
 * qual serie ganha, que e a parte discutivel, da para testar sem banco.
 */

/** Uma serie que o usuario realmente registrou. */
export type PerformedSet = {
  /** 1-based, a ordem da serie dentro do exercicio naquela sessao. */
  setIndex: number;
  reps: number;
  weightKg: number;
};

/**
 * Os alvos derivados da ultima vez que o exercicio foi treinado.
 *
 * `sets` e quantas series foram concluidas; `reps` e `weightKg` saem da serie
 * de maior `setIndex` — a ULTIMA, nao a mais pesada.
 *
 * Por que a ultima: quem faz rampa de aquecimento sobe a carga ao longo das
 * series, entao a ultima e a serie de trabalho. E, principalmente, ela devolve
 * um par (reps, peso) que de fato aconteceu junto. Pegar `MAX(peso)` de uma
 * serie e as reps de outra inventa um alvo que ninguem executou: 12 reps a
 * 62,5 kg quando as 12 reps foram a 60 kg.
 *
 * Devolve null quando nao ha serie nenhuma — o chamador cai para o degrau
 * seguinte da cascata.
 */
export function targetsFromSets(sets: readonly PerformedSet[]): Targets | null {
  if (sets.length === 0) return null;

  let last = sets[0];
  for (const set of sets) {
    if (set.setIndex > last.setIndex) last = set;
  }

  return { sets: sets.length, reps: last.reps, weightKg: last.weightKg };
}

/**
 * A cascata, em ordem de prioridade:
 *
 * 1. `override` — o usuario mexeu no stepper nesta semana. Decisao explicita,
 *    ganha de tudo.
 * 2. `lastPerformed` — o que ele levantou da ultima vez que treinou este
 *    exercicio. E o "vem como semana passada" do brief.
 * 3. `seed` — os alvos gravados quando o exercicio entrou no dia. So aparece
 *    em exercicio que nunca foi treinado.
 *
 * O degrau 3 e a razao de `routine_exercises.target_*` continuar existindo: ele
 * deixou de ser o plano vivo e virou a semente inicial.
 */
export function resolveTargets(
  override: Targets | null,
  lastPerformed: Targets | null,
  seed: Targets,
): Targets {
  return override ?? lastPerformed ?? seed;
}

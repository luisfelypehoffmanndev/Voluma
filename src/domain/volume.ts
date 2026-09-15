import type { SessionSet } from './types';

/**
 * Volume nunca e armazenado — e sempre derivado daqui.
 *
 * volume de uma serie = reps x peso. Somar isso por exercicio da o volume do
 * movimento; somar por sessao da o volume do treino; somar as sessoes de uma
 * janela da o "Volume levantado · Ultimos 7 dias" da home.
 *
 * Series nao concluidas (`done: false`) nao contam: sao alvos, nao carga
 * levantada.
 */

export function setVolume(set: Pick<SessionSet, 'reps' | 'weightKg' | 'done'>): number {
  if (!set.done) return 0;
  return set.reps * set.weightKg;
}

/** Volume total de uma lista de series (de um exercicio, de um treino, do que for). */
export function totalVolume(sets: readonly Pick<SessionSet, 'reps' | 'weightKg' | 'done'>[]): number {
  return sets.reduce((sum, set) => sum + setVolume(set), 0);
}

/** Volume por exercicio dentro de um treino, para a lista da tela de sessao. */
export function volumeByExercise(sets: readonly SessionSet[]): Map<string, number> {
  const byExercise = new Map<string, number>();
  for (const set of sets) {
    byExercise.set(set.exerciseId, (byExercise.get(set.exerciseId) ?? 0) + setVolume(set));
  }
  return byExercise;
}

/** Volume por sessao, chave para agregar por semana / por mes. */
export function volumeBySession(sets: readonly SessionSet[]): Map<string, number> {
  const bySession = new Map<string, number>();
  for (const set of sets) {
    bySession.set(set.sessionId, (bySession.get(set.sessionId) ?? 0) + setVolume(set));
  }
  return bySession;
}

/** Numero de series concluidas — o contador de progresso do treino em andamento. */
export function completedSets(sets: readonly Pick<SessionSet, 'done'>[]): number {
  return sets.reduce((count, set) => count + (set.done ? 1 : 0), 0);
}

/** Maior carga levantada em uma unica serie concluida. `null` se nao houver nenhuma. */
export function heaviestSet(
  sets: readonly Pick<SessionSet, 'weightKg' | 'done'>[],
): number | null {
  let max: number | null = null;
  for (const set of sets) {
    if (!set.done) continue;
    if (max === null || set.weightKg > max) max = set.weightKg;
  }
  return max;
}

/**
 * Formata volume para exibicao: sempre o numero cheio, arredondado.
 *
 * Ja abreviou acima de 1000 ("3,2k", "12k") para caber no card. Nao abrevia
 * mais: o peso levantado e o numero que o usuario quer LER, e "2,6k" esconde a
 * diferenca entre 2.550 e 2.649 — justo a faixa em que uma serie a mais
 * aparece. O card comporta: cinco digitos a `numberLg` ocupam ~165dp dos
 * ~320dp uteis de um telefone estreito.
 */
export function formatVolume(kg: number): string {
  return String(Math.round(kg));
}

/** Peso de uma serie: "60" ou "62,5" — sem casa decimal inutil. */
export function formatWeight(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace('.', ',');
}

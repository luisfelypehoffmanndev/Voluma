import type { SessionSet } from './types';
import { addWeeks, fromDateKey, weekStartKey } from './week';

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

/** Um treino dentro da semana: o dia e o volume levantado nele. */
export type WeekWorkout = { date: string; volume: number };

/** Uma semana do grafico de volume: o total e os treinos que o compoem. */
export type WeekVolume = { weekStart: string; volume: number; workouts: WeekWorkout[] };

/**
 * O volume de cada uma das ultimas `weeks` semanas, da mais antiga para a
 * atual (que termina em `now` e pode estar pela metade), com os treinos de
 * cada uma em ordem de data — sao os blocos da coluna no grafico.
 *
 * Recebe o `volumeByDate` ja carregado em vez de consultar de novo: a semana e
 * so outra forma de agrupar os mesmos dias. Semana sem treino entra com zero,
 * senao a coluna dela sumiria do grafico e as outras andariam de lugar. Dia com
 * volume zero (so corrida, ou tudo por concluir) nao vira treino: um bloco de
 * altura zero seria um treino que nao aparece.
 */
export function volumeByWeek(
  volumes: ReadonlyMap<string, number>,
  now: Date,
  weeks: number,
): WeekVolume[] {
  const current = weekStartKey(now);
  const result: WeekVolume[] = Array.from({ length: weeks }, (_, index) => ({
    weekStart: addWeeks(current, index - (weeks - 1)),
    volume: 0,
    workouts: [],
  }));
  const position = new Map(result.map((week, index) => [week.weekStart, index]));
  for (const [date, volume] of volumes) {
    const index = position.get(weekStartKey(fromDateKey(date)));
    if (index === undefined || volume <= 0) continue;
    result[index].volume += volume;
    result[index].workouts.push({ date, volume });
  }
  // A ordem do `Map` e a da consulta, nao a do calendario: o bloco de baixo tem
  // de ser o primeiro treino da semana, sempre.
  for (const week of result) week.workouts.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

/**
 * A media semanal de referencia: a das semanas fechadas, todas menos a ultima
 * (a atual, que quase sempre esta pela metade — com ela, toda segunda-feira
 * derrubaria a media).
 *
 * Semana sem treino entra com zero: ela aconteceu, e uma media que a ignora
 * promete um ritmo que nao houve. `null` enquanto nao ha semana fechada.
 */
export function closedWeeksAverage(weeks: readonly number[]): number | null {
  const closed = weeks.slice(0, -1);
  if (closed.length === 0) return null;
  return closed.reduce((sum, volume) => sum + volume, 0) / closed.length;
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

/**
 * Peso de uma serie: "60", "62,5" ou "61,25" — sem casa decimal inutil.
 *
 * Ate duas casas, porque e o que o `Stepper` aceita digitado: anilha de
 * 1,25 kg existe, e mostrar "61,3" para 61,25 poria na tela um peso que
 * ninguem levantou.
 */
export function formatWeight(kg: number): string {
  return String(Math.round(kg * 100) / 100).replace('.', ',');
}

import type { BodyWeightLog } from './types';
import { toDateKey } from './week';

/**
 * O peso corporal como serie para o grafico: um ponto por dia, do mais antigo
 * para o mais novo, so a partir de `fromKey`.
 *
 * Duas pesagens no mesmo dia (de manha e de noite, ou uma correcao) viram um
 * ponto so, a ultima do dia. Dois pontos na mesma coluna desenhariam um risco
 * vertical sem significado. O dia e o LOCAL do usuario, igual ao resto do app.
 */
export function dailyBodyWeight(
  logs: readonly Pick<BodyWeightLog, 'loggedAt' | 'weightKg'>[],
  fromKey: string,
): { date: string; weightKg: number }[] {
  const byDay = new Map<string, { at: string; weightKg: number }>();
  for (const log of logs) {
    const date = toDateKey(new Date(log.loggedAt));
    if (date < fromKey) continue;
    const kept = byDay.get(date);
    if (!kept || log.loggedAt > kept.at) byDay.set(date, { at: log.loggedAt, weightKg: log.weightKg });
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, { weightKg }]) => ({ date, weightKg }));
}

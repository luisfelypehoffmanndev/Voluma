import type { SessionSet, Targets } from './types';

/**
 * Corrida: distancia e tempo.
 *
 * A corrida anda pela mesma maquinaria da musculacao — e um exercicio dentro de
 * um dia, com alvos por semana e series na sessao. O que muda e o que os
 * numeros querem dizer: `distanceKm` e `durationMin` no lugar de reps e carga.
 *
 * Carga fica zerada de proposito, e nao por descuido: e o que mantem o "Volume
 * levantado" em kg livre de corrida, ja que `setVolume` multiplica reps por
 * peso e o resultado da zero sozinho.
 */

/** Distancia de uma serie concluida. Alvo nao percorrido nao conta. */
export function setDistance(set: Pick<SessionSet, 'distanceKm' | 'done'>): number {
  return set.done ? set.distanceKm : 0;
}

/** Distancia total de uma lista de series. */
export function totalDistance(
  sets: readonly Pick<SessionSet, 'distanceKm' | 'done'>[],
): number {
  return sets.reduce((sum, set) => sum + setDistance(set), 0);
}

/** Tempo total correndo, em minutos, das series concluidas. */
export function totalDuration(
  sets: readonly Pick<SessionSet, 'durationMin' | 'done'>[],
): number {
  return sets.reduce((sum, set) => sum + (set.done ? set.durationMin : 0), 0);
}

/**
 * Ritmo em minutos por quilometro, como "5:36".
 *
 * `null` quando falta distancia ou tempo — dividir por zero daria Infinity e a
 * tela mostraria "Infinity:NaN". Sem os dois numeros nao ha pace, e a tela
 * simplesmente nao mostra a linha.
 */
export function formatPace(distanceKm: number, durationMin: number): string | null {
  if (distanceKm <= 0 || durationMin <= 0) return null;

  const minutesPerKm = durationMin / distanceKm;
  const minutes = Math.floor(minutesPerKm);
  // Arredonda os segundos antes de formatar: 5,999 min/km e 6:00, nao 5:60.
  const seconds = Math.round((minutesPerKm - minutes) * 60);
  if (seconds === 60) return `${minutes + 1}:00`;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** "5" ou "5,5" — distancia sem casa decimal inutil. */
export function formatDistance(km: number): string {
  return Number.isInteger(km) ? String(km) : km.toFixed(1).replace('.', ',');
}

/** "28 min" ou "1 h 12" — o mesmo formato de duracao usado no resto do app. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

/**
 * Os alvos de corrida da ultima vez, a partir das series concluidas.
 *
 * Soma distancia e tempo em vez de pegar a ultima serie, ao contrario da
 * musculacao: quem corre 3 km, para, e corre mais 2 km fez 5 km naquele dia —
 * o total e o que a pessoa registraria. Na musculacao somar seria errado, e por
 * isso as duas regras vivem em funcoes separadas.
 *
 * `null` quando nao ha serie concluida, para o chamador cair no proximo degrau
 * da cascata.
 */
export function runTargetsFromSets(
  sets: readonly Pick<SessionSet, 'distanceKm' | 'durationMin' | 'done'>[],
): Targets | null {
  const done = sets.filter((set) => set.done);
  if (done.length === 0) return null;

  return {
    sets: 1,
    reps: 0,
    weightKg: 0,
    // Arredonda para uma casa: somar 0,1 repetidas vezes rende 5,300000000001.
    distanceKm: Math.round(done.reduce((sum, set) => sum + set.distanceKm, 0) * 10) / 10,
    durationMin: done.reduce((sum, set) => sum + set.durationMin, 0),
  };
}

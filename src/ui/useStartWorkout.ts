import { useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';

import { getOrCreateSessionForDate, getSessionByDate, listSessionSets, startSession } from '@/db/repo';
import { toDateKey } from '@/domain/week';
import { bumpData, useQuery } from '@/store/data';

/**
 * Abre o treino de hoje — o que o botao central da barra e o botao da Hoje
 * fazem, os dois pelo mesmo caminho.
 *
 * Um treino por data: abrir de novo cai no mesmo registro, com os numeros que
 * ja foram gravados. `startSession` acerta o relogio do treino para o toque,
 * se nada foi marcado ainda (ver o comentario la).
 *
 * Dois toques rapidos nao abrem duas sessoes nem empilham a tela duas vezes: o
 * segundo e ignorado enquanto o primeiro esta a caminho.
 */
export function useStartWorkout(): () => Promise<void> {
  const router = useRouter();
  const busy = useRef(false);

  return useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const session = await getOrCreateSessionForDate(new Date());
      await startSession(session.id);
      bumpData();
      router.push(`/session/${session.id}`);
    } finally {
      busy.current = false;
    }
  }, [router]);
}

/** O que o botao central precisa saber do dia, e nada mais. */
export type TodayStatus = 'idle' | 'inProgress' | 'completed';

async function loadTodayStatus(): Promise<TodayStatus> {
  const session = await getSessionByDate(toDateKey(new Date()));
  if (!session) return 'idle';
  if (session.completedAt) return 'completed';
  const sets = await listSessionSets(session.id);
  return sets.some((set) => set.done) ? 'inProgress' : 'idle';
}

/**
 * O estado do treino de hoje para o botao central: so tres leituras, porque
 * ele nao tem texto — o rotulo com numero ("Continuar · 2 de 5") e da Hoje.
 */
export function useTodayStatus(): TodayStatus {
  const { data } = useQuery(loadTodayStatus);
  return data ?? 'idle';
}

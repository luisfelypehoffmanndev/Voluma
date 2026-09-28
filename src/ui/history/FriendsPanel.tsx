import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native';

import { distanceByDate, listRoutines, volumeByDate } from '@/db/repo';
import { friendSeries, rankWithSelf } from '@/domain/friends';
import { formatDistance } from '@/domain/run';
import { volumeByWeek } from '@/domain/volume';
import {
  fromDateKey,
  lastWeekKeys,
  monthLabel,
  monthRange,
  toDateKey,
  weekPlan,
} from '@/domain/week';
import { useQuery } from '@/store/data';
import { useProfile } from '@/store/profile';
import { useAuth } from '@/sync/auth';
import { monthlyDistance, weeklyDays } from '@/sync/friends';
import { isCloudConfigured } from '@/sync/supabase';
import { spacing } from '@/theme/tokens';
import { EmptyState } from '@/ui/EmptyState';
import { LoadError } from '@/ui/LoadError';
import { shortDate } from '@/ui/relative';
import { useTabBarClearance } from '@/ui/tabBar';
import { Meta } from '@/ui/Text';

import { ConsistencyCard } from './ConsistencyCard';
import { RankingList } from './RankingList';
import { WeeksCard, type PersonWeeks } from './WeeksCard';

/** A mesma janela do grafico de volume dos Numeros: um ciclo de treino. */
const WEEKS = 12;
const DAYS_IN_WEEK = 7;

/**
 * Amigos do historico: a sua semana ao lado da dos amigos.
 *
 * Os amigos vem ao vivo do servidor e nao passam pelo SQLite — e dado social,
 * nao tem o que fazer offline. Os seus numeros vem do SQLite, pelas mesmas
 * regras das RPCs, e entram nos cards sem ir a rede.
 *
 * Nenhum card compara carga ou volume: so dias treinados, constancia e km,
 * que sao comparaveis entre iniciante e avancado.
 */
export function FriendsPanel() {
  const status = useAuth((state) => state.status);

  if (!isCloudConfigured) {
    return <Meta style={styles.local}>Amigos precisam da nuvem: preencha o .env.</Meta>;
  }
  if (status === 'loading') return null;
  if (status !== 'signedIn') return <SignedOut />;
  return <Friends />;
}

function SignedOut() {
  const router = useRouter();
  return (
    <EmptyState
      title="Entre para ver seus amigos"
      message="Amigos e as comparações da semana precisam de uma conta."
      action={{ label: 'Entrar', onPress: () => router.push('/login') }}
      style={styles.pad}
    />
  );
}

function Friends() {
  const router = useRouter();
  const clearance = useTabBarClearance();
  const { width } = useWindowDimensions();
  const profile = useProfile((state) => state.profile);

  const { data, error, reload } = useQuery(
    useCallback(async () => {
      const now = new Date();
      const today = toDateKey(now);
      const weekKeys = lastWeekKeys(now, WEEKS);
      const month = monthRange(now);
      const [rows, distances, volumes, ownDistances, routines] = await Promise.all([
        weeklyDays(weekKeys[0], weekKeys[WEEKS - 1]),
        monthlyDistance(month.start, month.end),
        volumeByDate(weekKeys[0], today),
        distanceByDate(month.start, today),
        listRoutines(),
      ]);

      let ownKm = 0;
      for (const km of ownDistances.values()) ownKm += km;

      return {
        weekKeys,
        month: now.getMonth(),
        friends: friendSeries(rows, weekKeys),
        distances,
        self: {
          weeks: volumeByWeek(volumes, now, WEEKS).map((week) => week.workouts.length),
          plannedDays: weekPlan(routines).filter((routine) => routine !== null).length,
          // Uma casa, como o servidor: somar 0,1 dez vezes nao da 1.
          km: Math.round(ownKm * 10) / 10,
        },
      };
    }, []),
    // Dado de rede: uma serie marcada no treino nao pode refazer a chamada ao
    // servidor. O foco e o "Tentar de novo" ainda recarregam.
    { liveUpdates: false },
  );

  if (error) return <LoadError error={error} onRetry={reload} />;
  if (!data) return null;

  if (data.friends.length === 0) {
    return (
      <EmptyState
        title="Nenhum amigo ainda"
        message="Adicione alguém pelo @ para comparar quantos dias cada um treinou."
        action={{ label: 'Adicionar amigos', onPress: () => router.push('/friends') }}
        style={styles.pad}
      />
    );
  }

  // Fora da consulta: o perfil chega por outro caminho e pode chegar depois.
  const handle = profile?.handle ?? '';
  const cardWidth = width - spacing.xl * 4;
  const last = WEEKS - 1;

  const people: PersonWeeks[] = [
    { handle, isSelf: true, weeks: data.self.weeks, plannedDays: data.self.plannedDays },
    ...data.friends.map((friend) => ({ ...friend, isSelf: false })),
  ];

  const thisWeek = rankWithSelf(
    data.friends.map((friend) => ({
      handle: friend.handle,
      value: friend.weeks === null ? null : friend.weeks[last],
    })),
    { handle, value: data.self.weeks[last] },
  );

  const running = rankWithSelf(data.distances, { handle, value: data.self.km });
  // Ninguem correu no mes: um card de "0 km" para todo mundo nao diz nada.
  const anyoneRan = running.some((row) => (row.value ?? 0) > 0);
  const maxKm = Math.max(...running.map((row) => row.value ?? 0));

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
      showsVerticalScrollIndicator={false}
    >
      <RankingList
        title="Esta semana · dias treinados"
        rows={thisWeek}
        max={DAYS_IN_WEEK}
        format={formatDays}
        footer={
          profile?.sharesStats
            ? undefined
            : 'Seus amigos não veem os seus números. Para mostrar, ligue o compartilhamento no Perfil.'
        }
        width={cardWidth}
      />

      <WeeksCard
        people={people}
        start={shortDate(fromDateKey(data.weekKeys[0]))}
        end="esta semana"
        width={cardWidth}
      />

      <ConsistencyCard people={people} width={cardWidth} />

      {anyoneRan ? (
        <RankingList
          title={`Corrida · ${monthLabel(data.month).toLowerCase()}`}
          rows={running}
          max={maxKm}
          format={(km) => `${formatDistance(km)} km`}
          width={cardWidth}
        />
      ) : null}
    </ScrollView>
  );
}

function formatDays(days: number): string {
  return days === 1 ? '1 dia' : `${days} dias`;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  pad: {
    paddingHorizontal: spacing.xl,
  },
  local: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    textAlign: 'center',
  },
});

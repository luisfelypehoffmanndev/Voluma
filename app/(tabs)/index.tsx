import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import {
  getSessionByDate,
  listRoutines,
  listSessionSets,
  routineExerciseCounts,
  targetsForWeek,
  trainedDates,
  type WeekExercise,
} from '@/db/repo';
import { currentStreak } from '@/domain/streak';
import { dayTitle, workoutState, type WorkoutState } from '@/domain/today';
import type { Routine, Weekday } from '@/domain/types';
import { lastNDays, routineForWeekday, toDateKey, weekStartKey, weekdayName, weekdayOf } from '@/domain/week';
import { useQuery } from '@/store/data';
import { colors, layout, spacing } from '@/theme/tokens';
import { ChartIcon, ListIcon, PersonIcon, PlayIcon } from '@/ui/icons';
import { LoadError } from '@/ui/LoadError';
import { Screen } from '@/ui/Screen';
import { Big, Block, Pill, Small, Tile, WeekStrip } from '@/ui/simple';
import { useTabBarClearance } from '@/ui/tabBar';
import { Reveal } from '@/ui/Reveal';
import { useStartWorkout } from '@/ui/useStartWorkout';

/**
 * Hoje — tao simples que nao precisa de tutorial.
 *
 * Forma do app Stoic (plano 16, ajuste de clareza): uma saudacao em negrito, a
 * semana numa faixa, dois cards grandes lado a lado — o treino de hoje (o
 * destaque, em laranja, com o botao) e o proximo — e atalhos quadrados para o
 * resto. Quem abre o app pela primeira vez ve um botao que diz o que fazer.
 */
export default function HomeScreen() {
  const clearance = useTabBarClearance();
  const openWorkout = useStartWorkout();
  const router = useRouter();

  const { data, loading, error, reload } = useQuery(useCallback(() => loadHome(), []));

  if (error) {
    return (
      <Screen>
        <LoadError error={error} onRetry={reload} />
      </Screen>
    );
  }

  if (loading || !data) {
    return (
      <Screen>
        <ActivityIndicator color={colors.textSecondary} style={styles.loading} />
      </Screen>
    );
  }

  const { today, next, week, streak } = data;
  const hasPlan = today.exerciseCount > 0;

  return (
    <Screen>
      <Reveal style={styles.reveal}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
          showsVerticalScrollIndicator={false}
        >
          <Big center>{greeting()}</Big>

          <WeekStrip days={week} />

          <View style={styles.pair}>
            {/* O destaque: o treino de hoje, com o botao. */}
            <Block tone="accent" style={styles.bigCard}>
              <Small style={styles.onAccentSmall}>{hasPlan ? 'Treino de hoje' : 'Hoje'}</Small>
              <Big style={styles.onAccentBig}>{hasPlan ? today.name : 'Dia de descanso'}</Big>
              <Small style={styles.onAccentSmall}>{todayLine(today.state, today.sets)}</Small>
              <View style={styles.spacer} />
              <Pill
                tone="dark"
                label={actionLabel(today.state)}
                icon={<PlayIcon size={16} color={colors.textPrimary} strokeWidth={2} />}
                onPress={() => void openWorkout()}
              />
            </Block>

            <Block
              style={styles.bigCard}
              onPress={() => router.push('/plan')}
              accessibilityLabel="Ver meu plano"
            >
              <Small>{next ? `Próximo · ${next.day}` : 'Próximo'}</Small>
              <Big style={styles.sideBig}>{next ? next.name : 'Nada marcado'}</Big>
              <View style={styles.spacer} />
              <Pill label="Ver plano" onPress={() => router.push('/plan')} />
            </Block>
          </View>

          {streak > 1 ? <Small center>{`Você treinou ${streak} dias seguidos.`}</Small> : null}

          <Big style={styles.section}>Atalhos</Big>
          <View style={styles.tiles}>
            <Tile icon={<ListIcon size={28} />} label="Meu plano" onPress={() => router.push('/plan')} />
            <Tile
              icon={<ChartIcon size={28} />}
              label="Meu progresso"
              onPress={() => router.push('/history')}
            />
            <Tile
              icon={<PersonIcon size={28} />}
              label="Meu perfil"
              onPress={() => router.push('/profile')}
            />
          </View>
        </ScrollView>
      </Reveal>
    </Screen>
  );
}

/** "bom dia." / "boa tarde." / "boa noite." — minusculo e com ponto. */
function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'bom dia.';
  if (hour < 18) return 'boa tarde.';
  return 'boa noite.';
}

function actionLabel(state: WorkoutState): string {
  switch (state.kind) {
    case 'notStarted':
      return 'Começar';
    case 'inProgress':
      return 'Continuar';
    case 'completed':
      return 'Ver treino';
    case 'rest':
      return 'Treino livre';
  }
}

function todayLine(state: WorkoutState, sets: { done: number; total: number }): string {
  switch (state.kind) {
    case 'notStarted':
      return `${sets.total} séries para fazer`;
    case 'inProgress':
      return `Faltam ${Math.max(0, sets.total - sets.done)} séries`;
    case 'completed':
      return 'Feito! Bom trabalho.';
    case 'rest':
      return 'Descanse ou faça um treino livre.';
  }
}

const LETTERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

async function loadHome() {
  const now = new Date();
  const todayKey = toDateKey(now);

  // A semana de domingo a sabado, como no calendario de parede.
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  const weekKeys = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + index);
    return toDateKey(date);
  });

  const streakWindow = lastNDays(now, 400);
  const [routines, counts, session, trainedWeek, trainedAll] = await Promise.all([
    listRoutines(),
    routineExerciseCounts(),
    getSessionByDate(todayKey),
    trainedDates(weekKeys[0], weekKeys[6]),
    trainedDates(streakWindow[0], todayKey),
  ]);

  const todayRoutine = routineForWeekday(routines, weekdayOf(now));
  const [todayExercises, sessionSets] = await Promise.all([
    todayRoutine
      ? targetsForWeek(weekStartKey(now), todayRoutine.id)
      : Promise.resolve<WeekExercise[]>([]),
    session ? listSessionSets(session.id) : Promise.resolve([]),
  ]);
  const plannedSets = todayExercises.reduce((sum, item) => sum + item.targets.sets, 0);
  const sets = {
    done: sessionSets.filter((set) => set.done).length,
    total: Math.max(plannedSets, sessionSets.length),
  };

  return {
    today: {
      name: dayTitle(todayRoutine?.name ?? '', todayExercises.length),
      exerciseCount: todayExercises.length,
      sets,
      state: workoutState({
        plannedExerciseIds: todayExercises.map((item) => item.exerciseId),
        sets: sessionSets,
        skippedExerciseIds: session?.skippedExerciseIds ?? [],
        completed: session?.completedAt != null,
      }),
    },
    next: nextDay(routines, counts, now),
    week: weekKeys.map((key, index) => ({
      letter: LETTERS[index],
      trained: trainedWeek.has(key),
      today: key === todayKey,
      future: key > todayKey,
    })),
    streak: currentStreak(trainedAll, now),
  };
}

/** O proximo dia com treino, olhando ate uma semana a frente. */
function nextDay(
  routines: readonly Routine[],
  counts: ReadonlyMap<string, number>,
  from: Date,
): { day: string; name: string } | null {
  for (let ahead = 1; ahead <= 7; ahead += 1) {
    const date = new Date(from);
    date.setDate(date.getDate() + ahead);
    const weekday = weekdayOf(date) as Weekday;
    const routine = routineForWeekday(routines, weekday);
    const count = routine ? (counts.get(routine.id) ?? 0) : 0;
    if (routine && count > 0) {
      return {
        day: ahead === 1 ? 'amanhã' : weekdayName(weekday).toLowerCase(),
        name: dayTitle(routine.name, count),
      };
    }
  }
  return null;
}

const styles = StyleSheet.create({
  reveal: { flex: 1 },
  loading: { marginTop: 80 },
  content: {
    paddingHorizontal: layout.screen,
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },
  pair: {
    flexDirection: 'row',
    gap: layout.cardGap,
  },
  bigCard: {
    flex: 1,
    minHeight: 220,
    gap: spacing.xs,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.md,
  },
  onAccentSmall: {
    color: 'rgba(0,0,0,0.65)',
  },
  onAccentBig: {
    color: colors.textOnAccent,
    fontSize: 22,
    lineHeight: 27,
  },
  sideBig: {
    fontSize: 22,
    lineHeight: 27,
  },
  section: {
    fontSize: 20,
    lineHeight: 26,
    marginBottom: -spacing.sm,
  },
  tiles: {
    flexDirection: 'row',
    gap: layout.cardGap,
  },
});

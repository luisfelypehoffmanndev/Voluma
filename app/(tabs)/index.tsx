import { useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  getSessionByDate,
  listRoutines,
  listSessionSets,
  targetsForWeek,
  trainedDates,
  type WeekExercise,
} from '@/db/repo';
import { formatDistance, formatDuration } from '@/domain/run';
import { currentStreak } from '@/domain/streak';
import { dayTitle, workoutState, type WorkoutState } from '@/domain/today';
import { formatWeight } from '@/domain/volume';
import { lastNDays, routineForWeekday, toDateKey, weekStartKey, weekdayName, weekdayOf } from '@/domain/week';
import { useQuery } from '@/store/data';
import { fonts, layout, shape, spacing, theme } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { LoadError } from '@/ui/LoadError';
import { shortDate } from '@/ui/relative';
import { Header, Screen } from '@/ui/Screen';
import { useTabBarClearance } from '@/ui/tabBar';
import { Reveal } from '@/ui/Reveal';
import { Body, Label, Meta } from '@/ui/Text';
import { useStartWorkout } from '@/ui/useStartWorkout';

/**
 * Hoje (Design/design.md §7): o heroi e o treino do dia, com um botao largo que
 * diz o que fazer. Embaixo, a semana em sete circulos e os exercicios do dia.
 */
export default function HomeScreen() {
  const clearance = useTabBarClearance();
  const openWorkout = useStartWorkout();
  const { data, loading, error, reload } = useQuery(useCallback(() => loadHome(), []));

  if (error) {
    return (
      <Screen>
        <Header title="Hoje" subtitle={todaySubtitle()} />
        <LoadError error={error} onRetry={reload} />
      </Screen>
    );
  }

  if (loading || !data) {
    return (
      <Screen>
        <Header title="Hoje" subtitle={todaySubtitle()} />
        <ActivityIndicator color={theme.outline} />
      </Screen>
    );
  }

  const { today, week, streak, trainedToday } = data;
  const hasPlan = today.exercises.length > 0;
  const progress = today.sets.total > 0 ? today.sets.done / today.sets.total : 0;

  return (
    <Screen>
      <Header title="Hoje" subtitle={todaySubtitle()} />
      <Reveal style={styles.reveal}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
          showsVerticalScrollIndicator={false}
        >
          <Card>
            <Label>{hasPlan ? 'TREINO DE HOJE' : 'HOJE'}</Label>
            <Text style={styles.heroName} maxFontSizeMultiplier={1.3}>
              {hasPlan ? today.name : 'Dia de descanso'}
            </Text>
            <Meta style={styles.heroMeta}>
              {hasPlan
                ? `${today.exercises.length} ${today.exercises.length === 1 ? 'exercício' : 'exercícios'} · cerca de ${estimateMinutes(today.sets.total)} min`
                : 'Nada no seu plano para hoje. Se quiser, faça um treino livre.'}
            </Meta>

            {today.state.kind === 'inProgress' ? (
              <View style={styles.track} accessibilityLabel={`${today.sets.done} de ${today.sets.total} séries`}>
                <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
            ) : null}

            <Button
              variant={today.state.kind === 'completed' || today.state.kind === 'rest' ? 'inline' : 'primary'}
              label={actionLabel(today.state, today.sets, today.exercises.length)}
              onPress={() => void openWorkout()}
              style={styles.action}
            />
          </Card>

          {streak > 0 && !trainedToday && hasPlan ? (
            <Meta style={styles.streak}>
              {`Treine hoje para não perder a sequência de ${streak} ${streak === 1 ? 'dia' : 'dias'}.`}
            </Meta>
          ) : null}

          <Label style={styles.section}>SEMANA</Label>
          <View style={styles.week}>
            {week.map((day, index) => (
              <View key={index} style={styles.day}>
                <View
                  style={[
                    styles.circle,
                    day.trained && styles.circleDone,
                    day.today && !day.trained && styles.circleToday,
                  ]}
                />
                <Meta style={day.today ? styles.dayToday : undefined}>{day.letter}</Meta>
              </View>
            ))}
          </View>

          {hasPlan ? (
            <>
              <Label style={styles.section}>EXERCÍCIOS</Label>
              <Card style={styles.list}>
                {today.exercises.map((item, index) => (
                  <View key={item.id} style={[styles.row, index > 0 && styles.rowDivided]}>
                    <View style={styles.rowText}>
                      <Body numberOfLines={2} style={styles.rowName}>
                        {item.exerciseName}
                      </Body>
                      <Meta>{setsLabel(item)}</Meta>
                    </View>
                    <Text style={styles.rowLoad} maxFontSizeMultiplier={1.3}>
                      {loadLabel(item)}
                    </Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </ScrollView>
      </Reveal>
    </Screen>
  );
}

/** Microtexto especifico (§8): o botao diz o que acontece. */
function actionLabel(
  state: WorkoutState,
  sets: { done: number; total: number },
  exercises: number,
): string {
  switch (state.kind) {
    case 'notStarted':
      return `Começar treino (${exercises} ${exercises === 1 ? 'exercício' : 'exercícios'})`;
    case 'inProgress':
      return `Continuar treino · ${sets.done} de ${sets.total} séries`;
    case 'completed':
      return 'Ver treino de hoje';
    case 'rest':
      return 'Fazer treino livre';
  }
}

/** Uns 2 min por serie (execucao + descanso), arredondado de 5 em 5. */
function estimateMinutes(sets: number): number {
  return Math.max(5, Math.round((sets * 2) / 5) * 5);
}

function setsLabel(item: WeekExercise): string {
  if (item.exerciseKind === 'run') return 'corrida';
  return `${item.targets.sets} séries × ${item.targets.reps} reps`;
}

function loadLabel(item: WeekExercise): string {
  const { weightKg, distanceKm, durationMin } = item.targets;
  if (item.exerciseKind === 'run') {
    const km = `${formatDistance(distanceKm)} km`;
    return durationMin > 0 ? `${km} · ${formatDuration(durationMin)}` : km;
  }
  return weightKg > 0 ? `${formatWeight(weightKg)} kg` : '';
}

function todaySubtitle(now = new Date()): string {
  return `${weekdayName(weekdayOf(now))}, ${shortDate(now, now)}`;
}

const LETTERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

async function loadHome() {
  const now = new Date();
  const todayKey = toDateKey(now);

  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  const weekKeys = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + index);
    return toDateKey(date);
  });

  const streakWindow = lastNDays(now, 400);
  const [routines, session, trainedWeek, trainedAll] = await Promise.all([
    listRoutines(),
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
  const doneSets = sessionSets.filter((set) => set.done).length;

  return {
    today: {
      name: dayTitle(todayRoutine?.name ?? '', todayExercises.length),
      exercises: todayExercises,
      sets: { done: doneSets, total: Math.max(plannedSets, sessionSets.length) },
      state: workoutState({
        plannedExerciseIds: todayExercises.map((item) => item.exerciseId),
        sets: sessionSets,
        skippedExerciseIds: session?.skippedExerciseIds ?? [],
        completed: session?.completedAt != null,
      }),
    },
    week: weekKeys.map((key, index) => ({
      letter: LETTERS[index],
      // Hoje so conta com serie marcada: abrir o treino nao e ter treinado.
      trained: key === todayKey ? doneSets > 0 : trainedWeek.has(key),
      today: key === todayKey,
    })),
    streak: currentStreak(trainedAll, now),
    trainedToday: doneSets > 0,
  };
}

const styles = StyleSheet.create({
  reveal: { flex: 1 },
  content: {
    paddingHorizontal: layout.screen,
    gap: layout.cardGap,
  },
  heroName: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
    color: theme.onSurface,
    marginTop: spacing.sm,
  },
  heroMeta: {
    marginTop: spacing.xs,
  },
  track: {
    height: 6,
    borderRadius: shape.pill,
    backgroundColor: theme.surfaceContainerHighest,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: shape.pill,
    backgroundColor: theme.primaryContainer,
  },
  action: {
    marginTop: spacing.lg,
  },
  streak: {
    textAlign: 'center',
    color: theme.onSurface,
  },
  section: {
    marginTop: layout.sectionGap - layout.cardGap,
    marginLeft: spacing.xs,
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  day: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.surfaceContainerHigh,
  },
  circleDone: {
    backgroundColor: theme.primaryContainer,
  },
  circleToday: {
    borderWidth: 2,
    borderColor: theme.primaryContainer,
  },
  dayToday: {
    color: theme.onSurface,
  },
  list: {
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
  },
  rowDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.outlineVariant,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontFamily: fonts.sansSemiBold,
  },
  rowLoad: {
    fontFamily: fonts.displayBold,
    fontSize: 16,
    color: theme.onSurface,
    fontVariant: ['tabular-nums'],
  },
});

import { useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  getSessionByDate,
  listExercises,
  listRoutines,
  listSessionSets,
  targetsForWeek,
  trainedDates,
  type WeekExercise,
} from '@/db/repo';
import { currentStreak } from '@/domain/streak';
import { dayTitle, workoutState, type WorkoutState } from '@/domain/today';
import { lastNDays, routineForWeekday, toDateKey, weekStartKey, weekdayName, weekdayOf } from '@/domain/week';
import { useQuery } from '@/store/data';
import { fonts, layout, muscleColor, section, shape, spacing, theme, tint } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { LoadError } from '@/ui/LoadError';
import { shortDate } from '@/ui/relative';
import { Header, Screen } from '@/ui/Screen';
import { useTabBarClearance } from '@/ui/tabBar';
import { Reveal } from '@/ui/Reveal';
import { Body, Label, Meta } from '@/ui/Text';
import { BarbellIcon, CheckIcon, TodayIcon } from '@/ui/icons';
import { MovementFigure } from '@/ui/MovementFigure';
import { artSlugFor } from '@/movements/library';
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
        <Header title="Hoje" subtitle={todaySubtitle()} badge={{ icon: <TodayIcon size={26} color="#FFFFFF" filled />, color: section.today }} />
        <LoadError error={error} onRetry={reload} />
      </Screen>
    );
  }

  if (loading || !data) {
    return (
      <Screen>
        <Header title="Hoje" subtitle={todaySubtitle()} badge={{ icon: <TodayIcon size={26} color="#FFFFFF" filled />, color: section.today }} />
        <ActivityIndicator color={theme.outline} />
      </Screen>
    );
  }

  const { today, week, streak, trainedToday, current, groups, groupOf } = data;
  // A figura grande: o exercicio da vez durante o treino, ou o primeiro do dia.
  const featured = current ?? today.exercises[0]?.exerciseName ?? null;
  const hasPlan = today.exercises.length > 0;
  const progress = today.sets.total > 0 ? today.sets.done / today.sets.total : 0;

  return (
    <Screen>
      <Header title="Hoje" subtitle={todaySubtitle()} badge={{ icon: <TodayIcon size={26} color="#FFFFFF" filled />, color: section.today }} />
      <Reveal style={styles.reveal}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
          showsVerticalScrollIndicator={false}
        >
          <Card>
            {/* A identidade da tela: a figura do primeiro movimento do dia, grande,
                ao lado do nome do treino. Diz "e isto que voce vai fazer" sem
                precisar de texto. */}
            <View style={styles.heroHead}>
              <View style={styles.heroText}>
                <View style={styles.kicker}>
                  <BarbellIcon size={16} color={section.today} />
                  <Label>{hasPlan ? 'TREINO DE HOJE' : 'HOJE'}</Label>
                </View>
                <Text style={styles.heroName} maxFontSizeMultiplier={1.3}>
                  {hasPlan ? today.name : 'Dia de descanso'}
                </Text>
                {current ? <Meta style={styles.now}>{`Agora: ${current}`}</Meta> : null}
                {groups.length > 0 ? (
                  <View style={styles.pills}>
                    {groups.slice(0, 3).map((group) => (
                      <View key={group} style={[styles.pill, { backgroundColor: tint(muscleColor(group), 0.18) }]}>
                        <Text style={[styles.pillText, { color: muscleColor(group) }]} maxFontSizeMultiplier={1.3}>
                          {group}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
              {hasPlan ? (
                <View style={styles.heroArt}>
                  <MovementFigure
                    slug={featured ? artSlugFor(featured) : null}
                    size={88}
                    color={theme.onSurface}
                  />
                </View>
              ) : null}
            </View>
            {!hasPlan ? (
              <Meta style={styles.heroMeta}>Nada no seu plano para hoje.</Meta>
            ) : null}

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
            {/* A letra do dia DENTRO do circulo. Treinou: verde com ✓ (cor so com
                significado: feito). Hoje: contorno. O resto: cinza apagado. */}
            {week.map((day, index) => (
              <View
                key={index}
                style={[
                  styles.circle,
                  day.trained && styles.circleDone,
                  day.today && !day.trained && styles.circleToday,
                ]}
                accessibilityLabel={`${day.letter}${day.trained ? ', treinou' : ''}${day.today ? ', hoje' : ''}`}
              >
                {day.trained ? (
                  <CheckIcon size={18} color={theme.background} />
                ) : (
                  <Text style={[styles.dayLetter, day.today && styles.dayLetterToday]}>
                    {day.letter}
                  </Text>
                )}
              </View>
            ))}
          </View>

          {hasPlan ? (
            <>
              <Label style={styles.section}>EXERCÍCIOS</Label>
              <Card style={styles.list}>
                {today.exercises.map((item, index) => (
                  <View key={item.id} style={[styles.row, index > 0 && styles.rowDivided]}>
                    <View style={styles.thumb}>
                      <MovementFigure
                        slug={artSlugFor(item.exerciseName)}
                        size={36}
                        color={theme.onSurface}
                      />
                    </View>
                    <View style={styles.rowText}>
                      <Body numberOfLines={2} style={styles.rowNameText}>
                        {item.exerciseName}
                      </Body>
                      {groupOf[item.exerciseId] ? <Meta>{groupOf[item.exerciseId]}</Meta> : null}
                    </View>
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
  const [routines, session, trainedWeek, trainedAll, catalog] = await Promise.all([
    listRoutines(),
    getSessionByDate(todayKey),
    trainedDates(weekKeys[0], weekKeys[6]),
    trainedDates(streakWindow[0], todayKey),
    listExercises(),
  ]);
  const groupOf = new Map(catalog.map((exercise) => [exercise.id, exercise.muscleGroup]));

  const todayRoutine = routineForWeekday(routines, weekdayOf(now));
  const [todayExercises, sessionSets] = await Promise.all([
    todayRoutine
      ? targetsForWeek(weekStartKey(now), todayRoutine.id)
      : Promise.resolve<WeekExercise[]>([]),
    session ? listSessionSets(session.id) : Promise.resolve([]),
  ]);
  const plannedSets = todayExercises.reduce((sum, item) => sum + item.targets.sets, 0);
  const doneSets = sessionSets.filter((set) => set.done).length;

  // O exercicio da vez: o primeiro do dia que ainda tem serie por fazer. So
  // existe com o treino em andamento (alguma serie marcada).
  const recorded = new Map<string, boolean[]>();
  for (const set of sessionSets) {
    const list = recorded.get(set.exerciseId) ?? [];
    list.push(set.done);
    recorded.set(set.exerciseId, list);
  }
  const current =
    doneSets > 0
      ? (todayExercises.find((item) => {
          const done = recorded.get(item.exerciseId);
          return !done || done.some((value) => !value);
        }) ?? null)
      : null;

  // Os grupos do dia, sem repetir, na ordem dos exercicios.
  const groups = [
    ...new Set(
      todayExercises
        .map((item) => groupOf.get(item.exerciseId))
        .filter((group): group is string => Boolean(group)),
    ),
  ];

  return {
    current: current?.exerciseName ?? null,
    groups,
    groupOf: Object.fromEntries(groupOf),
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
  heroHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroText: {
    flex: 1,
  },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  now: {
    marginTop: spacing.xs,
    color: theme.onSurface,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  pill: {
    backgroundColor: theme.surfaceContainerHigh,
    borderRadius: shape.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  pillText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: theme.onSurface,
  },
  rowNameText: {
    fontFamily: fonts.sansSemiBold,
  },
  heroArt: {
    width: 104,
    height: 104,
    borderRadius: shape.card,
    backgroundColor: tint(section.today, 0.16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: shape.control,
    backgroundColor: theme.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surfaceContainerHigh,
  },
  circleDone: {
    backgroundColor: theme.success,
  },
  dayLetter: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: theme.outline,
  },
  dayLetterToday: {
    color: theme.onSurface,
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
    flex: 1,
    fontFamily: fonts.sansSemiBold,
  },
  rowLoad: {
    fontFamily: fonts.displayBold,
    fontSize: 16,
    color: theme.onSurface,
    fontVariant: ['tabular-nums'],
  },
});

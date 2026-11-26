import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { listExercises, listRoutines, targetsForWeek, type WeekExercise } from '@/db/repo';
import type { Weekday } from '@/domain/types';
import { weekPlan, weekStartKey, weekdayName, weekdayOf } from '@/domain/week';
import { artSlugFor } from '@/movements/library';
import { useQuery } from '@/store/data';
import { fonts, layout, muscleColor, section, shape, spacing, theme, tint } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { BarbellIcon, ChevronRightIcon, ListIcon, PlusIcon } from '@/ui/icons';
import { LoadError } from '@/ui/LoadError';
import { MovementFigure } from '@/ui/MovementFigure';
import { Header, Screen } from '@/ui/Screen';
import { useTabBarClearance } from '@/ui/tabBar';
import { Label, Meta } from '@/ui/Text';
import { useStartWorkout } from '@/ui/useStartWorkout';

/** Quantas miniaturas de movimento cabem no card do dia antes do "+N". */
const MAX_THUMBS = 4;

/**
 * Plano: a semana de treino, com cara de ficha de academia.
 *
 * Cada dia de treino e um card com o nome do treino, os grupos musculares em
 * pilulas e as figuras dos movimentos — da para reconhecer o dia sem ler a
 * lista. O dia de hoje tem o botao de comecar ali mesmo. Dia de descanso e uma
 * linha curta com o atalho para adicionar treino. Tocar num dia abre o editor.
 */
export default function PlanScreen() {
  const clearance = useTabBarClearance();
  const router = useRouter();
  const openWorkout = useStartWorkout();

  const { data, error, reload } = useQuery(useCallback(() => loadPlan(), []));
  const today = weekdayOf(new Date());
  const openDay = (weekday: number) =>
    router.push({ pathname: '/day/[weekday]', params: { weekday } });

  const trainingDays = data?.days.filter((day) => day.exercises.length > 0).length ?? 0;

  return (
    <Screen>
      <Header
        title="Plano"
        badge={{ icon: <ListIcon size={26} color="#FFFFFF" filled />, color: section.plan }}
        subtitle={
          data
            ? `${trainingDays} ${trainingDays === 1 ? 'dia' : 'dias'} de treino na semana`
            : undefined
        }
      />

      {error ? (
        <LoadError error={error} onRetry={reload} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
          showsVerticalScrollIndicator={false}
        >
          {(data?.days ?? []).map((day) => {
            const isToday = day.weekday === today;
            const dayName = weekdayName(day.weekday as Weekday);

            if (day.exercises.length === 0) {
              return (
                <Pressable
                  key={day.weekday}
                  onPress={() => openDay(day.weekday)}
                  accessibilityRole="button"
                  accessibilityLabel={`${dayName}, descanso. Adicionar treino`}
                  style={({ pressed }) => [styles.rest, pressed && styles.pressed]}
                >
                  <View style={styles.restText}>
                    <DayLabel name={dayName} today={isToday} />
                    <Meta>Descanso</Meta>
                  </View>
                  <View style={styles.addChip}>
                    <PlusIcon size={16} color={theme.onSurface} />
                    <Text style={styles.addText}>Adicionar treino</Text>
                  </View>
                </Pressable>
              );
            }

            const thumbs = day.exercises.slice(0, MAX_THUMBS);
            const extra = day.exercises.length - thumbs.length;

            return (
              <Card key={day.weekday} onPress={() => openDay(day.weekday)} style={isToday && styles.todayCard}>
                <View style={styles.cardHead}>
                  <DayLabel name={dayName} today={isToday} />
                  <ChevronRightIcon size={18} color={theme.outline} />
                </View>

                <Text style={styles.workout} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                  {day.name || `Treino de ${dayName.toLowerCase()}`}
                </Text>

                {day.groups.length > 0 ? (
                  <View style={styles.pills}>
                    {day.groups.slice(0, 3).map((group) => (
                      <View key={group} style={[styles.pill, { backgroundColor: tint(muscleColor(group), 0.18) }]}>
                        <Text style={[styles.pillText, { color: muscleColor(group) }]}>{group}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.thumbs}>
                  {thumbs.map((item) => (
                    <View key={item.id} style={styles.thumb}>
                      <MovementFigure slug={artSlugFor(item.exerciseName)} size={36} color={theme.onSurface} />
                    </View>
                  ))}
                  {extra > 0 ? (
                    <View style={styles.thumb}>
                      <Text style={styles.extra}>{`+${extra}`}</Text>
                    </View>
                  ) : null}
                  <Meta style={styles.count}>
                    {`${day.exercises.length} ${day.exercises.length === 1 ? 'exercício' : 'exercícios'}`}
                  </Meta>
                </View>

                {isToday ? (
                  <Button
                    variant="primary"
                    label="Começar treino"
                    onPress={() => void openWorkout()}
                    style={styles.start}
                  />
                ) : null}
              </Card>
            );
          })}

          <Label style={styles.sectionLabel}>MOVIMENTOS</Label>
          <Card onPress={() => router.push('/catalog')}>
            <View style={styles.catalog}>
              <View style={styles.catalogIcon}>
                <BarbellIcon size={26} color={theme.onSurface} />
              </View>
              <View style={styles.catalogText}>
                <Text style={styles.catalogTitle}>{`${data?.catalogSize ?? 0} no catálogo`}</Text>
                <Meta>Adicionar, apagar e organizar por grupo</Meta>
              </View>
              <ChevronRightIcon size={18} color={theme.outline} />
            </View>
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}

/** "SEGUNDA" com o selo HOJE quando for o dia. */
function DayLabel({ name, today }: { name: string; today: boolean }) {
  return (
    <View style={styles.dayLabel}>
      <Label style={today ? styles.dayLabelToday : undefined}>{name.toUpperCase()}</Label>
      {today ? (
        <View style={styles.todayBadge}>
          <Text style={styles.todayText}>HOJE</Text>
        </View>
      ) : null}
    </View>
  );
}

async function loadPlan() {
  const [routines, catalog] = await Promise.all([listRoutines(), listExercises()]);
  const groupOf = new Map(catalog.map((exercise) => [exercise.id, exercise.muscleGroup]));
  const weekStart = weekStartKey(new Date());
  const plan = weekPlan(routines);

  const days = await Promise.all(
    plan.map(async (routine, weekday) => {
      const exercises: WeekExercise[] = routine ? await targetsForWeek(weekStart, routine.id) : [];
      const groups = [
        ...new Set(
          exercises
            .map((item) => groupOf.get(item.exerciseId))
            .filter((group): group is string => Boolean(group)),
        ),
      ];
      return { weekday, name: routine?.name.trim() ?? '', exercises, groups };
    }),
  );

  return { days, catalogSize: catalog.length };
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.screen,
    gap: layout.cardGap,
  },
  todayCard: {
    borderColor: theme.primaryContainer,
    borderWidth: 1.5,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayLabelToday: {
    color: theme.onSurface,
  },
  todayBadge: {
    backgroundColor: theme.primaryContainer,
    borderRadius: shape.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  todayText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: theme.onPrimary,
  },
  workout: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: theme.onSurface,
    marginTop: spacing.sm,
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
  thumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extra: {
    fontFamily: fonts.displayBold,
    fontSize: 15,
    color: theme.onSurface,
  },
  count: {
    marginLeft: 'auto',
  },
  start: {
    marginTop: spacing.lg,
  },
  rest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: spacing.md,
    minHeight: 64,
    borderRadius: shape.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.outlineVariant,
    borderStyle: 'dashed',
  },
  pressed: {
    backgroundColor: theme.surfaceContainerLow,
  },
  restText: {
    flex: 1,
    gap: 2,
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: theme.surfaceContainerHigh,
    borderRadius: shape.pill,
    paddingHorizontal: spacing.md,
    height: 36,
  },
  addText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: theme.onSurface,
  },
  sectionLabel: {
    marginTop: layout.sectionGap - layout.cardGap,
    marginLeft: spacing.xs,
  },
  catalog: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  catalogIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogText: {
    flex: 1,
    gap: 2,
  },
  catalogTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: theme.onSurface,
  },
});

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getSession,
  listExercises,
  listSessionSets,
  previousVolumeSameWeekday,
  targetsForWeek,
} from '@/db/repo';
import { compareVolume, formatComparison } from '@/domain/compare';
import { formatDistance, totalDistance } from '@/domain/run';
import { workoutState } from '@/domain/today';
import { formatVolume, totalVolume, volumeByExercise } from '@/domain/volume';
import { fromDateKey, lastWeekday, weekStartKey, weekdayName, weekdayOf } from '@/domain/week';
import { useQuery } from '@/store/data';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { duration, shortDate } from '@/ui/relative';
import { Header, Screen } from '@/ui/Screen';
import { StatNumber } from '@/ui/StatNumber';
import { Body, Label, Meta } from '@/ui/Text';

/**
 * Duracao acima disto nao e um treino, e uma sessao aberta num dia e finalizada
 * noutro (pelo calendario, por exemplo). Mostrar "31 h 04" seria mentir com
 * precisao; a linha simplesmente some.
 */
const MAX_PLAUSIBLE_MINUTES = 6 * 60;

/**
 * O fim do treino: quanto foi levantado, e como isso se compara.
 *
 * A comparacao e contra o treino anterior do MESMO dia da semana, em texto e
 * seta ("▲ 8% vs. segunda passada"), sempre em branco. Verde para subir e
 * vermelho para cair seria a cor de estado que o brief proibe — e cair num
 * deload nao e erro.
 *
 * Sem accent: o volume em mono grande ja e o protagonista, e o unico botao da
 * tela so fecha. Nenhum numero anima (§10).
 */
export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, loading } = useQuery(useCallback(() => loadResult(id), [id]));

  // "Fechar" volta para Hoje, e nao para quem abriu o treino: o treino acabou,
  // e a proxima coisa que o usuario ve e a home dizendo isso.
  const close = () => router.dismissTo('/');

  if (loading || !data) {
    return (
      <Screen>
        <Header title="Resultado" back="modal" onBack={close} />
        <ActivityIndicator color={colors.textSecondary} />
      </Screen>
    );
  }

  const { weekday, date, volume, distance, state, minutes, comparison, byExercise } = data;
  const base = lastWeekday(weekday);

  return (
    <Screen>
      <Header
        title="Resultado"
        subtitle={`${weekdayName(weekday)} · ${shortDate(date)}`}
        back="modal"
        onBack={close}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <StatNumber value={formatVolume(volume)} unit="kg" size={fontSize.numberLg} />
          <Label>Volume levantado</Label>
          <Body style={styles.comparison}>
            {comparison
              ? `${formatComparison(comparison)} vs. ${base}`
              : `Primeira ${weekdayName(weekday).toLowerCase()} registrada`}
          </Body>
        </View>

        <Card>
          <Row label="Exercícios" value={`${state.done} de ${state.total}`} />
          {minutes != null ? <Row label="Duração" value={minutes} /> : null}
          {distance > 0 ? <Row label="Distância" value={`${formatDistance(distance)} km`} /> : null}
        </Card>

        {byExercise.length > 0 ? (
          <Card>
            <Label>Por exercício</Label>
            {byExercise.map((item) => (
              <Row key={item.name} label={item.name} value={`${formatVolume(item.volume)} kg`} />
            ))}
          </Card>
        ) : null}

        <Button label="Fechar" onPress={close} />
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Body numberOfLines={1} style={styles.rowLabel}>
        {label}
      </Body>
      <Meta>{value}</Meta>
    </View>
  );
}

async function loadResult(id: string) {
  const session = await getSession(id);
  if (!session) return null;

  const date = fromDateKey(session.date);
  const [sets, catalog, planned, previous] = await Promise.all([
    listSessionSets(id),
    listExercises(),
    session.routineId
      ? targetsForWeek(weekStartKey(date), session.routineId)
      : Promise.resolve([]),
    previousVolumeSameWeekday(session.date),
  ]);

  const volume = totalVolume(sets);
  const names = new Map(catalog.map((exercise) => [exercise.id, exercise.name]));

  const elapsed = session.completedAt
    ? (new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 60000
    : null;

  return {
    weekday: weekdayOf(date),
    date,
    volume,
    distance: totalDistance(sets),
    state: workoutState({
      plannedExerciseIds: planned.map((item) => item.exerciseId),
      sets,
      skippedExerciseIds: session.skippedExerciseIds,
      completed: true,
    }),
    minutes:
      session.completedAt && elapsed != null && elapsed >= 1 && elapsed <= MAX_PLAUSIBLE_MINUTES
        ? duration(session.startedAt, session.completedAt)
        : null,
    comparison: compareVolume(volume, previous),
    byExercise: [...volumeByExercise(sets).entries()]
      .filter(([, kg]) => kg > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([exerciseId, kg]) => ({ name: names.get(exerciseId) ?? 'Exercício', volume: kg })),
  };
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  hero: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  comparison: {
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowLabel: {
    flex: 1,
    fontSize: fontSize.body,
  },
});

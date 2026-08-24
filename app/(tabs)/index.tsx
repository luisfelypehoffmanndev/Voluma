import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { getDb } from '@/db/client';
import {
  getOpenSession,
  listBodyWeightLogs,
  listRoutineExercises,
  listRoutines,
  startSession,
  trainedDates,
  volumeByDate,
} from '@/db/repo';
import { seedIfEmpty } from '@/db/seed';
import { buildDotMatrix, currentStreak } from '@/domain/streak';
import { formatVolume, formatWeight } from '@/domain/volume';
import {
  daysSinceMonthStart,
  lastNDays,
  nextRoutine,
  routineForWeekday,
  toDateKey,
  weekdayLabel,
  weekdayOf,
} from '@/domain/week';
import { bumpData, useQuery } from '@/store/data';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { DotMatrix } from '@/ui/DotMatrix';
import { ProgressRing } from '@/ui/ProgressRing';
import { relativeTime } from '@/ui/relative';
import { Header, Screen } from '@/ui/Screen';
import { StatNumber } from '@/ui/StatNumber';
import { useTabBarClearance } from '@/ui/tabBar';
import { Body, Label, Meta } from '@/ui/Text';
import { PlusIcon } from '@/ui/icons';

/**
 * Blocos de mes no dot-matrix da home: o mes corrente e os cinco anteriores.
 *
 * Seis meses, e nao tres, por geometria. Com tres meses sao ~14 colunas, que
 * nao preenchem a largura do card sem engordar a celula: ou a grade fica
 * centralizada com margens grandes nas pontas, ou cresce para ~130px de altura.
 * Com seis meses sao ~30 colunas, e a celula pequena preenche o card
 * naturalmente numa faixa baixa — que e a proporcao da referencia.
 */
const MATRIX_MONTHS = 5;

/**
 * Home — o bento grid da referencia.
 *
 * Uma unica cor de destaque nesta tela: o card de volume de 7 dias, que inverte
 * para fundo accent solido com texto preto. Por isso o dot-matrix daqui vai com
 * `showRecord={false}` — o ponto de recorde tambem e accent, e dois accents na
 * mesma tela quebram a regra do brief.
 */
export default function HomeScreen() {
  const clearance = useTabBarClearance();
  const router = useRouter();
  const { width } = useWindowDimensions();

  // Largura util dentro do card: tela menos as margens da tela e o padding do
  // card dos dois lados.
  const matrixWidth = width - spacing.xl * 4;

  const { data, loading } = useQuery(useCallback(loadHome, []));

  const openWorkout = async () => {
    if (!data) return;

    // Um treino ja aberto tem prioridade: o usuario provavelmente saiu do app
    // no meio da serie e quer voltar exatamente para onde estava.
    const open = data.openSessionId ?? null;
    if (open) {
      router.push(`/session/${open}`);
      return;
    }

    const session = await startSession(data.today.routineId);
    bumpData();
    router.push(`/session/${session.id}`);
  };

  if (loading || !data) {
    return (
      <Screen>
        <Header title="Treinos" />
        <ActivityIndicator color={colors.textSecondary} />
      </Screen>
    );
  }

  const { today, next, weekVolume, bodyWeight, dots, streak } = data;

  return (
    <Screen>
      <Header
        title="Treinos"
        action={{
          icon: <PlusIcon size={20} />,
          onPress: () => router.push('/routine/new'),
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.row}>
          <Card style={styles.half} onPress={openWorkout}>
            <ProgressRing progress={today.progress} value={String(today.completedSets)} />
            <View style={styles.cardFoot}>
              <Body numberOfLines={1}>{today.name}</Body>
              <Meta>{today.subtitle}</Meta>
            </View>
          </Card>

          <Card style={styles.half} onPress={() => router.push('/bodyweight')}>
            <StatNumber
              value={bodyWeight ? formatWeight(bodyWeight.weightKg) : '—'}
              unit="kg"
              size={fontSize.numberMd}
            />
            <View style={styles.cardFoot}>
              <Body>Peso corporal</Body>
              <Meta>{bodyWeight ? relativeTime(bodyWeight.loggedAt) : 'sem registro'}</Meta>
            </View>
          </Card>
        </View>

        <Card>
          <DotMatrix dots={dots} width={matrixWidth} showRecord={false} />
          <View style={styles.matrixFoot}>
            <ProgressRing
              progress={next ? 1 - next.daysAhead / 7 : 0}
              value={String(streak)}
              size={40}
            />
            <View style={styles.matrixText}>
              <Body numberOfLines={1}>{next ? next.routine.name : 'Sem próximo treino'}</Body>
              <Meta>{next ? weekdayLabel(next.routine.weekday) : 'nenhuma rotina criada'}</Meta>
            </View>
          </View>
        </Card>

        {/* O unico elemento accent da tela. */}
        <Card accent style={styles.volumeCard} onPress={() => router.push('/stats')}>
          <View>
            <Body style={styles.volumeLabel}>Volume levantado</Body>
            <Label style={styles.volumeSub}>Últimos 7 dias</Label>
          </View>
          <StatNumber
            value={formatVolume(weekVolume)}
            unit="kg"
            size={fontSize.numberMd}
            color={colors.textOnAccent}
            dimUnit={false}
          />
        </Card>

        <Card style={styles.addCard} onPress={() => router.push('/routine/new')}>
          <PlusIcon size={26} color={colors.textSecondary} />
          <Label style={styles.addLabel}>Nova rotina</Label>
        </Card>
      </ScrollView>
    </Screen>
  );
}

async function loadHome() {
  await getDb();
  if (await seedIfEmpty()) bumpData();

  const now = new Date();
  const todayKey = toDateKey(now);
  // O mesmo numero alimenta a consulta e a grade: se divergirem, o dot-matrix
  // pede dias que a query nunca buscou e eles aparecem como "sem treino".
  const matrixDays = daysSinceMonthStart(now, MATRIX_MONTHS);
  const window = lastNDays(now, matrixDays);

  const [routines, volumes, trained, weights, open] = await Promise.all([
    listRoutines(),
    volumeByDate(window[0], todayKey),
    trainedDates(window[0], todayKey),
    listBodyWeightLogs(1),
    getOpenSession(),
  ]);

  const todayRoutine = routineForWeekday(routines, weekdayOf(now));
  const plannedSets = todayRoutine
    ? (await listRoutineExercises(todayRoutine.id)).reduce(
        (sum, item) => sum + item.targetSets,
        0,
      )
    : 0;

  const weekKeys = lastNDays(now, 7);
  const weekVolume = weekKeys.reduce((sum, key) => sum + (volumes.get(key) ?? 0), 0);

  const doneToday = trained.has(todayKey);

  return {
    openSessionId: open?.id ?? null,
    today: {
      routineId: todayRoutine?.id ?? null,
      name: todayRoutine?.name ?? 'Treino livre',
      subtitle: todayRoutine ? weekdayLabel(todayRoutine.weekday) : 'sem plano hoje',
      completedSets: plannedSets,
      progress: doneToday ? 1 : 0,
    },
    next: nextRoutine(routines, now),
    weekVolume,
    bodyWeight: weights[0] ?? null,
    dots: buildDotMatrix(volumes, now, matrixDays),
    streak: currentStreak(trained, now),
  };
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
    minHeight: 150,
    justifyContent: 'space-between',
  },
  cardFoot: {
    marginTop: spacing.lg,
    gap: 2,
  },
  matrixFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  matrixText: {
    flex: 1,
    gap: 2,
  },
  volumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  volumeLabel: {
    color: colors.textOnAccent,
  },
  volumeSub: {
    // Sem opacidade: a hierarquia aqui e de tamanho (12 contra 16), nao de
    // esmaecimento. Preto a 70% sobre o accent lia como cinza, nao como preto fraco.
    color: colors.textOnAccent,
  },
  addCard: {
    minHeight: 110,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  addLabel: {
    marginTop: spacing.md,
  },
});

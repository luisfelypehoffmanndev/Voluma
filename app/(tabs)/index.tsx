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
  targetsForWeek,
  trainedDates,
  volumeByDate,
  type WeekExercise,
} from '@/db/repo';
import { seedIfEmpty } from '@/db/seed';
import { buildDotMatrix, currentStreak } from '@/domain/streak';
import { formatVolume, formatWeight } from '@/domain/volume';
import type { Routine, Weekday } from '@/domain/types';
import {
  daysSinceMonthStart,
  lastNDays,
  routineForWeekday,
  toDateKey,
  weekStartKey,
  weekdayName,
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
import { Body, Label, Meta, Mono } from '@/ui/Text';

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

  const { today, upcoming, weekVolume, bodyWeight, dots, streak } = data;

  return (
    <Screen>
      <Header title="Treinos" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
        showsVerticalScrollIndicator={false}
      >
        {/* O card mais importante da tela. Ganha destaque por tamanho e posicao,
            nao por cor: o accent da tela ja esta gasto no card de volume, e
            inverter uma LISTA para laranja solido daria um bloco de texto
            colorido — o oposto do que o brief pede para o card invertido, que e
            reservado a um NUMERO. */}
        <Card onPress={openWorkout}>
          <View style={styles.todayHead}>
            <View style={styles.todayText}>
              <Label>{`HOJE · ${weekdayName(today.weekday).toUpperCase()}`}</Label>
              <Body numberOfLines={1} style={styles.todayName}>
                {today.name}
              </Body>
            </View>
            <ProgressRing progress={today.progress} value={String(today.plannedSets)} />
          </View>

          {today.exercises.slice(0, MAX_TODAY_ROWS).map((item) => (
            <View key={item.id} style={styles.exerciseRow}>
              <Body numberOfLines={1} style={styles.exerciseName}>
                {item.exerciseName}
              </Body>
              <Mono style={styles.exerciseTargets}>{targetsLabel(item)}</Mono>
            </View>
          ))}

          {today.exercises.length > MAX_TODAY_ROWS ? (
            <Meta style={styles.moreRow}>
              {`+${today.exercises.length - MAX_TODAY_ROWS} exercícios`}
            </Meta>
          ) : null}

          {today.exercises.length === 0 ? (
            <Meta style={styles.moreRow}>Sem exercícios hoje — toque para treino livre.</Meta>
          ) : null}
        </Card>

        <Card style={styles.weightCard} onPress={() => router.push('/bodyweight')}>
          <View>
            <Body>Peso corporal</Body>
            <Meta>{bodyWeight ? relativeTime(bodyWeight.loggedAt) : 'sem registro'}</Meta>
          </View>
          <StatNumber
            value={bodyWeight ? formatWeight(bodyWeight.weightKg) : '—'}
            unit="kg"
            size={fontSize.numberMd}
          />
        </Card>

        <Card>
          <DotMatrix dots={dots} width={matrixWidth} showRecord={false} />
          <View style={styles.matrixFoot}>
            <ProgressRing progress={streak > 0 ? 1 : 0} value={String(streak)} size={40} />
            <View style={styles.matrixText}>
              <Body numberOfLines={1}>{streak === 1 ? 'dia seguido' : 'dias seguidos'}</Body>
              <Meta>{`últimos ${MATRIX_MONTHS} meses`}</Meta>
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

        <Card>
          <Label>Próximos</Label>
          {upcoming.map((day) => (
            <View key={day.weekday} style={styles.upcomingRow}>
              <Body numberOfLines={1} style={styles.exerciseName}>
                {day.name}
              </Body>
              <Meta>{weekdayName(day.weekday)}</Meta>
            </View>
          ))}
          {upcoming.length === 0 ? (
            <Meta style={styles.moreRow}>Nenhum treino nos próximos dias.</Meta>
          ) : null}
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

  const weekStart = weekStartKey(now);
  const todayRoutine = routineForWeekday(routines, weekdayOf(now));
  // Os numeros da semana, ja resolvidos: e o que o card de hoje mostra e o que
  // a sessao vai materializar quando o usuario tocar em treinar.
  const todayExercises = todayRoutine ? await targetsForWeek(weekStart, todayRoutine.id) : [];
  const plannedSets = todayExercises.reduce((sum, item) => sum + item.targets.sets, 0);

  const upcoming = await nextDays(routines, now, 3);

  const weekKeys = lastNDays(now, 7);
  const weekVolume = weekKeys.reduce((sum, key) => sum + (volumes.get(key) ?? 0), 0);

  const doneToday = trained.has(todayKey);

  return {
    openSessionId: open?.id ?? null,
    today: {
      routineId: todayRoutine?.id ?? null,
      weekday: weekdayOf(now),
      name: dayTitle(todayRoutine?.name ?? '', todayExercises.length),
      exercises: todayExercises,
      plannedSets,
      progress: doneToday ? 1 : 0,
    },
    upcoming,
    weekVolume,
    bodyWeight: weights[0] ?? null,
    dots: buildDotMatrix(volumes, now, matrixDays),
    streak: currentStreak(trained, now),
  };
}

/**
 * Quantos exercicios cabem no card de hoje antes de virar rolagem disfarcada.
 *
 * Cinco linhas mais o cabecalho ja empurram os outros cards para fora da
 * dobra num telefone comum. O resto vira uma linha de "+N", e a lista inteira
 * esta a um toque de distancia na tela do dia.
 */
const MAX_TODAY_ROWS = 5;

/** "3 × 10 · 62,5 kg" — o alvo da semana, em mono, como todo numero do app. */
function targetsLabel(item: WeekExercise): string {
  const { sets, reps, weightKg } = item.targets;
  if (weightKg === 0) return `${sets} × ${reps}`;
  return `${sets} × ${reps} · ${formatWeight(weightKg)} kg`;
}

/**
 * Como o dia se chama na tela: o rotulo que o usuario deu, ou o estado do dia
 * quando ele nao deu nenhum.
 */
function dayTitle(name: string, exerciseCount: number): string {
  const label = name.trim();
  if (label) return label;
  return exerciseCount === 0 ? 'Descanso' : 'Sem nome';
}

/**
 * Os proximos dias com treino, olhando ate uma semana a frente.
 *
 * Nunca conta hoje — hoje ja tem o card grande. E pula dia sem exercicio: com
 * os sete dias sempre existindo, "tem rotina" deixou de significar "treina
 * nesse dia", e so a contagem de exercicios distingue treino de descanso.
 */
async function nextDays(
  routines: readonly Routine[],
  from: Date,
  count: number,
): Promise<{ weekday: Weekday; name: string; exerciseCount: number }[]> {
  const found: { weekday: Weekday; name: string; exerciseCount: number }[] = [];

  for (let daysAhead = 1; daysAhead <= 7 && found.length < count; daysAhead += 1) {
    const date = new Date(from);
    date.setDate(date.getDate() + daysAhead);
    const weekday = weekdayOf(date);

    const routine = routineForWeekday(routines, weekday);
    if (!routine) continue;

    const items = await listRoutineExercises(routine.id);
    if (items.length === 0) continue;

    found.push({
      weekday,
      name: dayTitle(routine.name, items.length),
      exerciseCount: items.length,
    });
  }

  return found;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  todayHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  todayText: {
    flex: 1,
  },
  todayName: {
    marginTop: spacing.xs,
    fontSize: fontSize.bodyLg,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  exerciseName: {
    flex: 1,
  },
  exerciseTargets: {
    fontSize: fontSize.label,
    color: colors.textSecondary,
  },
  moreRow: {
    paddingTop: spacing.md,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  weightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
});

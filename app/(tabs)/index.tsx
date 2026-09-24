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
  getOrCreateSessionForDate,
  getSessionByDate,
  listBodyWeightLogs,
  listRoutineExercises,
  listRoutines,
  listSessionSets,
  targetsForWeek,
  trainedDates,
  volumeByDate,
  type WeekExercise,
} from '@/db/repo';
import { applyOrder } from '@/domain/order';
import { buildDotMatrix, currentStreak } from '@/domain/streak';
import { formatDistance, formatDuration } from '@/domain/run';
import { workoutState, type WorkoutState } from '@/domain/today';
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
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { DotMatrix } from '@/ui/DotMatrix';
import { ProgressRing } from '@/ui/ProgressRing';
import { relativeTime, shortDate } from '@/ui/relative';
import { LoadError } from '@/ui/LoadError';
import { Header, Screen } from '@/ui/Screen';
import { StatNumber } from '@/ui/StatNumber';
import { useTabBarClearance } from '@/ui/tabBar';
import { Reveal } from '@/ui/Reveal';
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
 * Home — "Foco Unico": um trabalho so, te colocar no treino de hoje em um toque.
 *
 * O treino abria ao tocar no card "HOJE", que nao tinha cara de botao, no meio
 * de cinco cards disputando atencao. Agora a acao principal e um botao de
 * verdade, logo abaixo do card do dia, com o dado no rotulo ("Começar treino ·
 * 5 exercícios").
 *
 * Uma unica cor de destaque nesta tela: esse botao, quando ele e a acao
 * principal (comecar ou continuar). O card de volume de 7 dias, que era o card
 * accent solido, virou vidro normal — dois laranjas brigariam, e o que o
 * usuario precisa achar de relance e o botao, nao o numero. Treino ja
 * finalizado ou dia de descanso: o botao vira vidro e a tela fica sem accent.
 *
 * O dot-matrix continua com `showRecord={false}`: o ponto de recorde tambem e
 * accent.
 */
export default function HomeScreen() {
  const clearance = useTabBarClearance();
  const router = useRouter();
  const { width } = useWindowDimensions();

  // Largura util dentro do card: tela menos as margens da tela e o padding do
  // card dos dois lados.
  const matrixWidth = width - spacing.xl * 4;

  const { data, loading, error, reload } = useQuery(useCallback(loadHome, []));

  // Um treino por data: abrir de novo cai no mesmo registro, com os numeros que
  // ja foram gravados. "Comecar" e "continuar" abrem a mesma sessao; o que muda
  // e so o rotulo, que diz em que pe o dia esta.
  const openWorkout = async () => {
    const session = await getOrCreateSessionForDate(new Date());
    bumpData();
    router.push(`/session/${session.id}`);
  };

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
        <ActivityIndicator color={colors.textSecondary} />
      </Screen>
    );
  }

  const { today, upcoming, weekVolume, bodyWeight, dots, streak } = data;

  return (
    <Screen>
      <Header title="Hoje" subtitle={todaySubtitle()} />

      {/* O `Header` fica FORA do fade: ele ja estava na tela durante o
          carregamento, e faze-lo acender de novo seria animar uma troca que
          nao aconteceu. So o conteudo, que ate agora era um spinner, entra. */}
      <Reveal style={styles.reveal}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
        showsVerticalScrollIndicator={false}
      >
        {/* O card do dia deixou de ser tocavel: quem abre o treino e o botao
            logo abaixo. Um card que as vezes e botao ensina a tocar em todo
            card, e os outros daqui levam a outras telas. */}
        <Card>
          <View style={styles.todayHead}>
            <View style={styles.todayText}>
              <Label>{weekdayName(today.weekday).toUpperCase()}</Label>
              <Body numberOfLines={1} style={styles.todayName}>
                {today.name}
              </Body>
            </View>
            <ProgressRing progress={today.state.progress} value={String(today.plannedSets)} />
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

          {today.state.kind === 'rest' ? (
            <Meta style={styles.moreRow}>Hoje é descanso no seu plano.</Meta>
          ) : null}
        </Card>

        <TodayAction state={today.state} onPress={openWorkout} />

        <View style={styles.row}>
          <Card style={styles.half} onPress={() => router.push('/bodyweight')}>
            <StatNumber
              value={bodyWeight ? formatWeight(bodyWeight.weightKg) : '—'}
              unit="kg"
              size={fontSize.numberSm}
            />
            <View style={styles.cardFoot}>
              <Body>Peso corporal</Body>
              <Meta>{bodyWeight ? relativeTime(bodyWeight.loggedAt) : 'sem registro'}</Meta>
            </View>
          </Card>

          {/* Vidro normal: o accent da tela e do botao de treino. */}
          <Card style={styles.half} onPress={() => router.push('/history?view=numbers')}>
            <StatNumber value={formatVolume(weekVolume)} unit="kg" size={fontSize.numberSm} />
            <View style={styles.cardFoot}>
              <Body>Volume</Body>
              <Meta>últimos 7 dias</Meta>
            </View>
          </Card>
        </View>

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
      </Reveal>
    </Screen>
  );
}

/**
 * O botao principal da home, com o estado do dia no rotulo.
 *
 * Primario (accent) so quando ele e o proximo passo — comecar ou continuar.
 * Treino finalizado e dia de descanso ainda podem abrir a sessao, mas ai e
 * consulta ou extra, nao a acao do dia: nivel 2, sem cor.
 *
 * Nivel 2 e nao vidro porque este botao mora no `ScrollView` da home e rola com
 * ele — ver a nota de posicao em `Button.tsx`.
 */
function TodayAction({ state, onPress }: { state: WorkoutState; onPress: () => void }) {
  switch (state.kind) {
    case 'notStarted':
      return (
        <Button
          variant="primary"
          label={`Começar treino · ${state.total} ${state.total === 1 ? 'exercício' : 'exercícios'}`}
          onPress={onPress}
        />
      );
    case 'inProgress':
      return (
        <Button
          variant="primary"
          label={`Continuar treino · ${state.done} de ${state.total}`}
          onPress={onPress}
        />
      );
    case 'completed':
      return <Button variant="inline" label="Ver treino de hoje" onPress={onPress} />;
    case 'rest':
      return <Button variant="inline" label="Treino livre" onPress={onPress} />;
  }
}

/** "Segunda · 14 set" — o dado no lugar do "Bem-vindo de volta" (§7). */
function todaySubtitle(now = new Date()): string {
  return `${weekdayName(weekdayOf(now))} · ${shortDate(now, now)}`;
}

async function loadHome() {
  await getDb();

  const now = new Date();
  const todayKey = toDateKey(now);
  // O mesmo numero alimenta a consulta e a grade: se divergirem, o dot-matrix
  // pede dias que a query nunca buscou e eles aparecem como "sem treino".
  const matrixDays = daysSinceMonthStart(now, MATRIX_MONTHS);
  const window = lastNDays(now, matrixDays);

  const [routines, volumes, trained, weights, session] = await Promise.all([
    listRoutines(),
    volumeByDate(window[0], todayKey),
    trainedDates(window[0], todayKey),
    listBodyWeightLogs(1),
    getSessionByDate(todayKey),
  ]);

  const weekStart = weekStartKey(now);
  const todayRoutine = routineForWeekday(routines, weekdayOf(now));
  // Os numeros da semana, ja resolvidos: e o que o card de hoje mostra e o que
  // a sessao vai materializar quando o usuario tocar em treinar.
  const todayExercises = todayRoutine ? await targetsForWeek(weekStart, todayRoutine.id) : [];
  const plannedSets = todayExercises.reduce((sum, item) => sum + item.targets.sets, 0);

  const [upcoming, sessionSets] = await Promise.all([
    nextDays(routines, now, 3),
    session ? listSessionSets(session.id) : Promise.resolve([]),
  ]);

  const weekKeys = lastNDays(now, 7);
  const weekVolume = weekKeys.reduce((sum, key) => sum + (volumes.get(key) ?? 0), 0);

  return {
    today: {
      routineId: todayRoutine?.id ?? null,
      weekday: weekdayOf(now),
      name: dayTitle(todayRoutine?.name ?? '', todayExercises.length),
      // Na ordem que o usuario arrastou no treino de hoje, se arrastou.
      exercises: applyOrder(todayExercises, session?.exerciseOrder ?? [], (item) => item.exerciseId),
      plannedSets,
      state: workoutState({
        plannedExerciseIds: todayExercises.map((item) => item.exerciseId),
        sets: sessionSets,
        skippedExerciseIds: session?.skippedExerciseIds ?? [],
        completed: session?.completedAt != null,
      }),
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


/** "3 × 10 · 62,5 kg" ou "5 km · 28 min" — o alvo da semana, em mono. */
function targetsLabel(item: WeekExercise): string {
  const { sets, reps, weightKg, distanceKm, durationMin } = item.targets;

  if (item.exerciseKind === 'run') {
    const km = `${formatDistance(distanceKm)} km`;
    return durationMin > 0 ? `${km} · ${formatDuration(durationMin)}` : km;
  }

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
  const candidates: { weekday: Weekday; routine: Routine }[] = [];

  for (let daysAhead = 1; daysAhead <= 7; daysAhead += 1) {
    const date = new Date(from);
    date.setDate(date.getDate() + daysAhead);
    const weekday = weekdayOf(date);

    const routine = routineForWeekday(routines, weekday);
    if (routine) candidates.push({ weekday, routine });
  }

  // As consultas rodam em paralelo, nao uma atras da outra: o card de
  // "Proximos" nao precisa esperar ate sete idas e voltas ao SQLite em serie
  // so para descobrir quais dias tem exercicio — o tempo total vira o da mais
  // lenta, nao a soma de todas.
  const itemsByCandidate = await Promise.all(
    candidates.map((candidate) => listRoutineExercises(candidate.routine.id)),
  );

  const found: { weekday: Weekday; name: string; exerciseCount: number }[] = [];

  for (let i = 0; i < candidates.length && found.length < count; i += 1) {
    const items = itemsByCandidate[i];
    if (items.length === 0) continue;

    found.push({
      weekday: candidates[i].weekday,
      name: dayTitle(candidates[i].routine.name, items.length),
      exerciseCount: items.length,
    });
  }

  return found;
}

const styles = StyleSheet.create({
  // O `Reveal` entra entre o `Screen` e o `ScrollView`, entao precisa esticar
  // igual ao que ele substitui no fluxo — sem isto o scroll fica sem altura.
  reveal: { flex: 1 },
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
    borderTopColor: colors.divider,
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
    borderTopColor: colors.divider,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardFoot: {
    marginTop: spacing.lg,
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
});

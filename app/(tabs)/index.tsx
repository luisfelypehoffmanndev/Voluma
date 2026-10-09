import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  getOrCreateSessionForDate,
  getSessionByDate,
  listBodyWeightLogs,
  listRoutines,
  listSessionSets,
  routineExerciseCounts,
  targetsForWeek,
  volumeByDate,
  type WeekExercise,
} from '@/db/repo';
import { applyOrder } from '@/domain/order';
import { buildDotMatrix, currentStreak } from '@/domain/streak';
import { formatDistance, formatDuration } from '@/domain/run';
import { dayTitle, workoutState, type WorkoutState } from '@/domain/today';
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
import { colors, fontSize, radius, spacing } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { DotMatrix } from '@/ui/DotMatrix';
import { PressableSurface } from '@/ui/PressableSurface';
import { ProgressRing } from '@/ui/ProgressRing';
import { shortDate } from '@/ui/relative';
import { LoadError } from '@/ui/LoadError';
import { Header, Screen } from '@/ui/Screen';
import { Tour } from '@/ui/tour/Tour';
import { TourTarget } from '@/ui/tour/TourTarget';
import { StatNumber } from '@/ui/StatNumber';
import { useTabBarClearance } from '@/ui/tabBar';
import { Reveal } from '@/ui/Reveal';
import { Body, Label, Meta, Mono, Section } from '@/ui/Text';

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

  const { data, loading, error, reload } = useQuery(useCallback(() => loadHome(), []));

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
    <Screen
      overlay={
        /* No `overlay` do `Screen`, e nao entre os filhos: ali a camada e irma
           do conteudo e cobre a tela inteira, nas mesmas coordenadas de janela
           em que o alvo foi medido. Dentro do conteudo ela comecaria abaixo da
           area segura e o recorte sairia deslocado. */
        <Tour
          id="home"
          active
          steps={[
            {
              target: 'home.action',
              // Uma frase que vale em todo estado do dia: em dia de descanso
              // nao ha numero nenhum no botao, e falar dele seria mentira.
              text: 'O treino de hoje começa aqui.',
            },
          ]}
        />
      }
    >
      <Header title="Hoje" subtitle={todaySubtitle()} />

      {/* O `Header` fica FORA do fade: ele ja estava na tela durante o
          carregamento, e faze-lo acender de novo seria animar uma troca que
          nao aconteceu. So o conteudo, que ate agora era um spinner, entra. */}
      <Reveal style={styles.reveal}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
        showsVerticalScrollIndicator={false}
      >
        {/* O HEROI da tela: o treino de hoje, e so ele, com o nome em titulo de
            secao e as series em mono grande. Tudo aqui era corpo de 16 no meio
            de cinco cards do mesmo tamanho, e nada dizia por onde comecar.

            O card nao e tocavel: quem abre o treino e o botao logo abaixo. Um
            card que as vezes e botao ensina a tocar em todo card, e os outros
            daqui levam a outras telas. */}
        <Card>
          <View style={styles.todayHead}>
            <View style={styles.todayText}>
              <Label>{weekdayName(today.weekday).toUpperCase()}</Label>
              <Section numberOfLines={1} style={styles.todayName}>
                {today.name}
              </Section>
              {/* A orientacao da tela, em UMA linha: o que falta fazer hoje.
                  Mais que isso vira parede de texto na tela que a pessoa abre
                  dez vezes por semana. */}
              <Meta numberOfLines={1}>{todayHint(today.state, today.sets)}</Meta>
            </View>
            {/* O anel mostra as series do dia: o numero e o total, e o arco, o
                quanto ja foi marcado. Antes o arco so conhecia dois estados
                (0 ou 1), entao ficava vazio durante o treino inteiro. */}
            <ProgressRing
              progress={today.sets.total > 0 ? today.sets.done / today.sets.total : 0}
              value={String(today.sets.total)}
            />
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
        </Card>

        <TourTarget id="home.action">
          <TodayAction state={today.state} sets={today.sets} onPress={openWorkout} />
        </TourTarget>

        {/* Daqui para baixo e consulta, nao acao: um titulo de secao separa, e
            os numeros encolhem. Antes peso, volume e sequencia ocupavam tres
            cards do mesmo tamanho do treino de hoje. */}
        <Label style={styles.sectionLabel}>PROGRESSO</Label>

        <Card>
          <View style={styles.stats}>
            <PressableSurface
              feedback="raised"
              borderRadius={radius.inner}
              style={styles.stat}
              onPress={() => router.push('/bodyweight')}
              accessibilityLabel="Peso corporal"
            >
              <StatNumber
                value={bodyWeight ? formatWeight(bodyWeight.weightKg) : '—'}
                unit="kg"
                size={fontSize.numberSm}
              />
              <Meta numberOfLines={1}>Peso</Meta>
            </PressableSurface>

            <View style={styles.statDivider} />

            <PressableSurface
              feedback="raised"
              borderRadius={radius.inner}
              style={styles.stat}
              onPress={() => router.push('/history?view=numbers')}
              accessibilityLabel="Volume dos últimos 7 dias"
            >
              <StatNumber value={formatVolume(weekVolume)} unit="kg" size={fontSize.numberSm} />
              <Meta numberOfLines={1}>7 dias</Meta>
            </PressableSurface>

            <View style={styles.statDivider} />

            <View style={styles.stat}>
              <StatNumber value={String(streak)} size={fontSize.numberSm} />
              <Meta numberOfLines={1}>{streak === 1 ? 'dia seguido' : 'dias seguidos'}</Meta>
            </View>
          </View>

          <View style={styles.matrix}>
            <DotMatrix dots={dots} width={matrixWidth} showRecord={false} />
          </View>
        </Card>

        {upcoming.length > 0 ? (
          <>
            <Label style={styles.sectionLabel}>PRÓXIMOS</Label>
            <Card>
              {upcoming.map((day, index) => (
                <View
                  key={day.weekday}
                  style={[styles.upcomingRow, index > 0 && styles.upcomingDivided]}
                >
                  <Body numberOfLines={1} style={styles.exerciseName}>
                    {day.name}
                  </Body>
                  <Meta>{weekdayName(day.weekday)}</Meta>
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
function TodayAction({
  state,
  sets,
  onPress,
}: {
  state: WorkoutState;
  /** O dia em series — a mesma unidade que a tela de treino conta. */
  sets: { done: number; total: number };
  onPress: () => void;
}) {
  switch (state.kind) {
    case 'notStarted':
      return (
        <Button
          variant="primary"
          label={`Começar treino · ${sets.total} ${sets.total === 1 ? 'série' : 'séries'}`}
          onPress={onPress}
        />
      );
    case 'inProgress':
      return (
        <Button
          variant="primary"
          label={`Continuar treino · ${sets.done} de ${sets.total}`}
          onPress={onPress}
        />
      );
    case 'completed':
      return <Button variant="inline" label="Ver treino de hoje" onPress={onPress} />;
    case 'rest':
      return <Button variant="inline" label="Treino livre" onPress={onPress} />;
  }
}

/**
 * A orientacao da home, em UMA linha.
 *
 * Nao e frase motivacional (§7 proibe) nem tutorial: e o que falta fazer hoje,
 * dito com o dado que a tela ja tem. Uma linha, e no mesmo lugar sempre — a
 * pessoa abre esta tela dez vezes por semana e nao vai ler um paragrafo.
 */
function todayHint(state: WorkoutState, sets: { done: number; total: number }): string {
  switch (state.kind) {
    case 'notStarted':
      return `${sets.total} ${sets.total === 1 ? 'série' : 'séries'} para hoje`;
    case 'inProgress': {
      const left = Math.max(0, sets.total - sets.done);
      return `faltam ${left} ${left === 1 ? 'série' : 'séries'}`;
    }
    case 'completed':
      return 'treino de hoje finalizado';
    case 'rest':
      return 'descanso no seu plano';
  }
}

/** "Segunda · 14 set" — o dado no lugar do "Bem-vindo de volta" (§7). */
function todaySubtitle(now = new Date()): string {
  return `${weekdayName(weekdayOf(now))} · ${shortDate(now, now)}`;
}

async function loadHome() {
  const now = new Date();
  const todayKey = toDateKey(now);
  // O mesmo numero alimenta a consulta e a grade: se divergirem, o dot-matrix
  // pede dias que a query nunca buscou e eles aparecem como "sem treino".
  const matrixDays = daysSinceMonthStart(now, MATRIX_MONTHS);
  const window = lastNDays(now, matrixDays);

  const [routines, volumes, counts, weights, session] = await Promise.all([
    listRoutines(),
    volumeByDate(window[0], todayKey),
    routineExerciseCounts(),
    listBodyWeightLogs(1),
    getSessionByDate(todayKey),
  ]);

  const weekStart = weekStartKey(now);
  const todayRoutine = routineForWeekday(routines, weekdayOf(now));
  // Os numeros da semana, ja resolvidos: e o que o card de hoje mostra e o que
  // a sessao vai materializar quando o usuario tocar em treinar. So depende das
  // rotinas e da sessao, entao roda junto com as series de hoje.
  const [todayExercises, sessionSets] = await Promise.all([
    todayRoutine ? targetsForWeek(weekStart, todayRoutine.id) : Promise.resolve<WeekExercise[]>([]),
    session ? listSessionSets(session.id) : Promise.resolve([]),
  ]);
  const plannedSets = todayExercises.reduce((sum, item) => sum + item.targets.sets, 0);

  /**
   * O dia contado em SERIES, a mesma unidade da tela de treino.
   *
   * O botao dizia "Começar treino · 5 exercícios" e a sessao, depois de aberta,
   * dizia "0 de 18 séries": dois numeros para o mesmo treino. Aqui o total e o
   * do plano, com o que foi gravado por cima — series adicionadas a mais no dia
   * entram, e um dia de treino livre (sem plano) conta as do que foi registrado.
   */
  const doneSets = sessionSets.filter((set) => set.done).length;
  const todaySets = {
    done: doneSets,
    total: Math.max(plannedSets, sessionSets.length),
  };

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
      sets: todaySets,
      state: workoutState({
        plannedExerciseIds: todayExercises.map((item) => item.exerciseId),
        sets: sessionSets,
        skippedExerciseIds: session?.skippedExerciseIds ?? [],
        completed: session?.completedAt != null,
      }),
    },
    upcoming: nextDays(routines, counts, now, 3),
    weekVolume,
    bodyWeight: weights[0] ?? null,
    dots: buildDotMatrix(volumes, now, matrixDays),
    // `volumeByDate` ja devolve toda data com sessao (o LEFT JOIN mantem as de
    // volume zero), que e exatamente o conjunto de dias treinados.
    streak: currentStreak(new Set(volumes.keys()), now),
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
 * Os proximos dias com treino, olhando ate uma semana a frente.
 *
 * Nunca conta hoje — hoje ja tem o card grande. E pula dia sem exercicio: com
 * os sete dias sempre existindo, "tem rotina" deixou de significar "treina
 * nesse dia", e so a contagem de exercicios distingue treino de descanso.
 */
function nextDays(
  routines: readonly Routine[],
  counts: ReadonlyMap<string, number>,
  from: Date,
  count: number,
): { weekday: Weekday; name: string }[] {
  const found: { weekday: Weekday; name: string }[] = [];

  for (let daysAhead = 1; daysAhead <= 7 && found.length < count; daysAhead += 1) {
    const date = new Date(from);
    date.setDate(date.getDate() + daysAhead);
    const weekday = weekdayOf(date);

    const routine = routineForWeekday(routines, weekday);
    const exerciseCount = routine ? (counts.get(routine.id) ?? 0) : 0;
    if (!routine || exerciseCount === 0) continue;

    found.push({ weekday, name: dayTitle(routine.name, exerciseCount) });
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
    marginBottom: 2,
  },
  /** Titulo de secao fora do card: e ele que separa acao de consulta. */
  sectionLabel: {
    marginTop: spacing.lg,
    marginLeft: spacing.xs,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: spacing.xs,
    backgroundColor: colors.divider,
  },
  matrix: {
    marginTop: spacing.xl,
  },
  upcomingDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
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

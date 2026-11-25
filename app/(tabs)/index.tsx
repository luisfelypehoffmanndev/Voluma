import { useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import {
  getSessionByDate,
  listRoutines,
  listSessionSets,
  routineExerciseCounts,
  targetsForWeek,
  type WeekExercise,
} from '@/db/repo';
import { applyOrder } from '@/domain/order';
import { formatDistance, formatDuration } from '@/domain/run';
import { dayTitle, workoutState, type WorkoutState } from '@/domain/today';
import { formatWeight } from '@/domain/volume';
import type { Routine, Weekday } from '@/domain/types';
import { routineForWeekday, toDateKey, weekStartKey, weekdayName, weekdayOf } from '@/domain/week';
import { useQuery } from '@/store/data';
import { colors, fontSize, layout, spacing } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { shortDate } from '@/ui/relative';
import { LoadError } from '@/ui/LoadError';
import { Header, Screen } from '@/ui/Screen';
import { SetMeter } from '@/ui/SetMeter';
import { Tour } from '@/ui/tour/Tour';
import { TourTarget } from '@/ui/tour/TourTarget';
import { useTabBarClearance } from '@/ui/tabBar';
import { Reveal } from '@/ui/Reveal';
import { Body, Label, Meta, Mono, Section } from '@/ui/Text';
import { useStartWorkout } from '@/ui/useStartWorkout';

/**
 * Hoje — um trabalho so: dizer qual e o treino do dia, em que pe ele esta, e
 * levar ate ele em um toque.
 *
 * **O que saiu** (plano 16, Onda 0): o card PROGRESSO, com peso, volume de 7
 * dias, sequencia e o dot-matrix. Cada um desses dados ja morava em outro lugar
 * (peso no Perfil, volume nos Numeros, a grade no Calendario), e a Hoje era a
 * segunda casa de todos. Dado em dois lugares e o mesmo numero para manter
 * sincronizado e uma tela a mais disputando o olho. A sequencia foi para o
 * Calendario, que e onde dias seguidos se leem.
 *
 * **O accent desta tela e o botao central da barra**, nao o botao daqui. Os
 * dois fazem a mesma coisa (`useStartWorkout`); este existe porque carrega o
 * estado do dia no rotulo ("Continuar treino · 2 de 16"), que o circulo da
 * barra nao tem espaco para dizer. Por isso ele e vidro.
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
        <ActivityIndicator color={colors.textSecondary} />
      </Screen>
    );
  }

  const { today, upcoming } = data;
  const hasPlan = today.exercises.length > 0;

  return (
    <Screen
      overlay={
        /* No `overlay` do `Screen`, e nao entre os filhos: ali a camada e irma
           do conteudo e cobre a tela inteira, nas mesmas coordenadas de janela
           em que o alvo foi medido. */
        <Tour
          id="home"
          active
          steps={[
            {
              target: 'home.action',
              // Uma frase que vale em todo estado do dia: em dia de descanso
              // nao ha numero nenhum no botao, e falar dele seria mentira.
              text: 'O treino de hoje começa aqui, ou no botão do meio da barra.',
            },
          ]}
        />
      }
    >
      <Header title="Hoje" subtitle={todaySubtitle()} />

      <Reveal style={styles.reveal}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
          showsVerticalScrollIndicator={false}
        >
          {/* O HEROI da tela: o treino de hoje. Tres andares, do mais para o
              menos importante: o nome, em que pe o dia esta (o numero e o
              medidor), e a lista do que tem. O card nao e tocavel — quem abre o
              treino e o botao logo abaixo. */}
          <Card>
            <Label>{dayLabel(today.weekday, today.exercises.length)}</Label>
            <Section numberOfLines={2} style={styles.todayName}>
              {today.name}
            </Section>

            {hasPlan || today.sets.total > 0 ? (
              <View style={styles.readout}>
                <View style={styles.readoutNumber}>
                  <Mono style={styles.readoutDone}>{String(today.sets.done)}</Mono>
                  <Mono style={styles.readoutTotal}>{`/${today.sets.total}`}</Mono>
                  <Meta style={styles.readoutUnit}>séries</Meta>
                </View>
                <Meta numberOfLines={1}>{todayHint(today.state, today.sets)}</Meta>
              </View>
            ) : (
              <Meta style={styles.restHint}>{todayHint(today.state, today.sets)}</Meta>
            )}

            <SetMeter done={today.sets.done} total={today.sets.total} />

            {hasPlan ? (
              <View style={styles.list}>
                {today.exercises.slice(0, MAX_TODAY_ROWS).map((item) => {
                  const finished = today.finishedIds.has(item.exerciseId);
                  return (
                    <View key={item.id} style={styles.exerciseRow}>
                      {/* Duas linhas: com fonte grande o nome quebra em vez de
                          virar "Su…" ao lado do alvo. */}
                      <Body
                        numberOfLines={2}
                        style={[styles.exerciseName, finished && styles.finished]}
                      >
                        {item.exerciseName}
                      </Body>
                      <Mono style={styles.exerciseTargets}>
                        {finished ? 'feito' : targetsLabel(item)}
                      </Mono>
                    </View>
                  );
                })}

                {today.exercises.length > MAX_TODAY_ROWS ? (
                  <Meta style={styles.moreRow}>
                    {`+${today.exercises.length - MAX_TODAY_ROWS} exercícios`}
                  </Meta>
                ) : null}
              </View>
            ) : null}
          </Card>

          <TourTarget id="home.action">
            <TodayAction state={today.state} sets={today.sets} onPress={() => void openWorkout()} />
          </TourTarget>

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
 * O botao da Hoje, com o estado do dia no rotulo.
 *
 * Nivel 2 (`inline`) em todos os estados: ele rola com a pagina (ver a nota de
 * posicao em `Button.tsx`), e o accent da tela e do botao central da barra.
 * O que muda entre os estados e so o texto.
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
  const label = (() => {
    switch (state.kind) {
      case 'notStarted':
        return `Começar treino · ${sets.total} ${sets.total === 1 ? 'série' : 'séries'}`;
      case 'inProgress':
        return `Continuar treino · ${sets.done} de ${sets.total}`;
      case 'completed':
        return 'Ver treino de hoje';
      case 'rest':
        return 'Treino livre';
    }
  })();
  return <Button variant="inline" label={label} onPress={onPress} />;
}

/** "QUARTA · 5 EXERCÍCIOS" — o rotulo do card do dia. */
function dayLabel(weekday: Weekday, exercises: number): string {
  const day = weekdayName(weekday).toUpperCase();
  if (exercises === 0) return day;
  return `${day} · ${exercises} ${exercises === 1 ? 'EXERCÍCIO' : 'EXERCÍCIOS'}`;
}

/**
 * A orientacao da home, em UMA linha.
 *
 * Nao e frase motivacional (§7 proibe) nem tutorial: e o que falta fazer hoje,
 * dito com o dado que a tela ja tem.
 */
function todayHint(state: WorkoutState, sets: { done: number; total: number }): string {
  switch (state.kind) {
    case 'notStarted':
      return 'nada marcado ainda';
    case 'inProgress': {
      const left = Math.max(0, sets.total - sets.done);
      return `faltam ${left}`;
    }
    case 'completed':
      return 'treino finalizado';
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

  const [routines, counts, session] = await Promise.all([
    listRoutines(),
    routineExerciseCounts(),
    getSessionByDate(todayKey),
  ]);

  const weekStart = weekStartKey(now);
  const todayRoutine = routineForWeekday(routines, weekdayOf(now));
  // Os numeros da semana, ja resolvidos: e o que o card de hoje mostra e o que
  // a sessao vai materializar quando o usuario tocar em treinar.
  const [todayExercises, sessionSets] = await Promise.all([
    todayRoutine ? targetsForWeek(weekStart, todayRoutine.id) : Promise.resolve<WeekExercise[]>([]),
    session ? listSessionSets(session.id) : Promise.resolve([]),
  ]);
  const plannedSets = todayExercises.reduce((sum, item) => sum + item.targets.sets, 0);

  /**
   * O dia contado em SERIES, a mesma unidade da tela de treino: o total e o do
   * plano, com o que foi gravado por cima — series adicionadas a mais no dia
   * entram, e um dia de treino livre (sem plano) conta as do que foi registrado.
   */
  const doneSets = sessionSets.filter((set) => set.done).length;
  const todaySets = {
    done: doneSets,
    total: Math.max(plannedSets, sessionSets.length),
  };

  // Exercicio terminado = toda serie gravada dele marcada. So os que tem serie
  // gravada entram: o que nunca foi tocado hoje nao terminou.
  const byExercise = new Map<string, boolean[]>();
  for (const set of sessionSets) {
    const list = byExercise.get(set.exerciseId) ?? [];
    list.push(set.done);
    byExercise.set(set.exerciseId, list);
  }
  const finishedIds = new Set(
    [...byExercise].filter(([, done]) => done.every(Boolean)).map(([id]) => id),
  );

  return {
    today: {
      weekday: weekdayOf(now),
      name: dayTitle(todayRoutine?.name ?? '', todayExercises.length),
      // Na ordem que o usuario arrastou no treino de hoje, se arrastou.
      exercises: applyOrder(todayExercises, session?.exerciseOrder ?? [], (item) => item.exerciseId),
      sets: todaySets,
      finishedIds,
      state: workoutState({
        plannedExerciseIds: todayExercises.map((item) => item.exerciseId),
        sets: sessionSets,
        skippedExerciseIds: session?.skippedExerciseIds ?? [],
        completed: session?.completedAt != null,
      }),
    },
    upcoming: nextDays(routines, counts, now, 3),
  };
}

/**
 * Quantos exercicios cabem no card de hoje antes de virar rolagem disfarcada.
 * O resto vira uma linha de "+N", e a lista inteira esta no treino.
 */
const MAX_TODAY_ROWS = 6;

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
    paddingHorizontal: layout.screen,
    gap: layout.cardGap,
  },
  todayName: {
    marginTop: spacing.xs,
  },
  /** A leitura do dia: o numero feito em mono grande, o total colado nele. */
  readout: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  readoutNumber: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  readoutDone: {
    fontSize: fontSize.numberDisplay,
    lineHeight: fontSize.numberDisplay + 4,
  },
  readoutTotal: {
    fontSize: fontSize.numberLine,
    color: colors.textAux,
  },
  readoutUnit: {
    marginLeft: spacing.sm,
  },
  restHint: {
    marginTop: spacing.xs,
  },
  list: {
    marginTop: spacing.lg,
  },
  /** Titulo de secao fora do card: e ele que separa acao de consulta. */
  sectionLabel: {
    marginTop: layout.sectionGap - layout.cardGap,
    marginLeft: spacing.xs,
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
    minHeight: layout.touch,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  exerciseName: {
    flex: 1,
  },
  /** Exercicio terminado: apaga, nao some — continua na lista, no lugar dele. */
  finished: {
    color: colors.textAux,
  },
  exerciseTargets: {
    fontSize: fontSize.aux,
    color: colors.textAux,
  },
  moreRow: {
    paddingTop: spacing.md,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    minHeight: layout.touch,
  },
});

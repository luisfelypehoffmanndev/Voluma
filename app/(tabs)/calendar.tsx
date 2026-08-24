import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  getSessionByDate,
  listExercises,
  listRoutines,
  listSessionSets,
  startSession,
  targetsForWeek,
  trainedDates,
  volumeByDate,
  type WeekExercise,
} from '@/db/repo';
import type { Routine } from '@/domain/types';
import { formatDistance, formatDuration } from '@/domain/run';
import { formatVolume, formatWeight, totalVolume, volumeByExercise } from '@/domain/volume';
import {
  fromDateKey,
  monthGrid,
  monthLabel,
  routineForWeekday,
  toDateKey,
  weekStartKey,
  weekdayInitials,
  weekdayOf,
} from '@/domain/week';
import { bumpData, useQuery } from '@/store/data';
import { colors, fontSize, fonts, radius, spacing, surfaces } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { duration, shortDate } from '@/ui/relative';
import { Header, RoundButton, Screen } from '@/ui/Screen';
import { useTabBarClearance } from '@/ui/tabBar';
import { Body, Label, Meta, Mono } from '@/ui/Text';
import { ChevronLeftIcon, ChevronRightIcon } from '@/ui/icons';

/**
 * Calendario do app.
 *
 * Dias com treino ficam com o numero em branco cheio e um ponto abaixo; dias
 * sem treino ficam em secondary. Nao ha heatmap nem cor por intensidade — a
 * intensidade aparece no detalhe do dia, em numero.
 *
 * Highlight: uma forma so para todos os estados — o mesmo quadrado de cantos
 * arredondados, sempre do mesmo tamanho. O que muda entre hoje, selecionado e
 * os dois juntos e o preenchimento e a forca da borda, nunca a forma. Antes
 * eram tres linguagens brigando na mesma grade (circulo no selecionado,
 * sublinhado no hoje, nada nos demais), e a grade lia como quebrada.
 */
export default function CalendarScreen() {
  const clearance = useTabBarClearance();
  const router = useRouter();
  const today = new Date();

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(toDateKey(today));

  const monthKeys = monthGrid(cursor.getFullYear(), cursor.getMonth());
  const firstKey = toDateKey(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  const lastKey = toDateKey(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));

  const month = useQuery(
    useCallback(async () => {
      const [trained, volumes] = await Promise.all([
        trainedDates(firstKey, lastKey),
        volumeByDate(firstKey, lastKey),
      ]);
      return { trained, volumes };
    }, [firstKey, lastKey]),
  );

  const day = useQuery(
    useCallback(async () => {
      const [session, routines, exercises] = await Promise.all([
        getSessionByDate(selected),
        listRoutines(),
        listExercises(),
      ]);
      const routine = routineForWeekday(routines, weekdayOf(fromDateKey(selected)));
      // Os alvos da SEMANA daquela data, nao os de hoje: abrir uma segunda de
      // tres semanas atras tem que mostrar o que estava valendo naquela semana.
      const plannedItems = routine
        ? await targetsForWeek(weekStartKey(fromDateKey(selected)), routine.id)
        : [];
      const planned = routine ? { ...routine, items: plannedItems } : null;
      if (!session) return { session: null, planned, sets: [], names: new Map<string, string>() };

      const sets = await listSessionSets(session.id);
      return {
        session,
        planned,
        sets,
        names: new Map(exercises.map((e) => [e.id, e.name])),
      };
    }, [selected]),
  );

  const shiftMonth = (delta: number) =>
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  const todayKey = toDateKey(today);

  return (
    <Screen>
      <Header title="Calendário" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.monthBar}>
          <RoundButton
            icon={<ChevronLeftIcon size={18} />}
            onPress={() => shiftMonth(-1)}
          />
          <View style={styles.monthTitle}>
            <Body>{monthLabel(cursor.getMonth())}</Body>
            <Meta>{cursor.getFullYear()}</Meta>
          </View>
          <RoundButton
            icon={<ChevronRightIcon size={18} />}
            onPress={() => shiftMonth(1)}
          />
        </View>

        <Card>
          <View style={styles.weekdays}>
            {weekdayInitials().map((initial, index) => (
              <Label key={index} style={styles.weekday}>
                {initial}
              </Label>
            ))}
          </View>

          {monthKeys.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.week}>
              {week.map((dateKey, dayIndex) => {
                if (!dateKey) return <View key={dayIndex} style={styles.dayCell} />;

                const trained = month.data?.trained.has(dateKey) ?? false;
                const isSelected = dateKey === selected;
                const isToday = dateKey === todayKey;

                return (
                  <Pressable
                    key={dateKey}
                    style={styles.dayCell}
                    onPress={() => setSelected(dateKey)}
                  >
                    <View
                      style={[
                        styles.dayInner,
                        isToday && styles.dayToday,
                        isSelected && styles.daySelected,
                        isSelected && isToday && styles.daySelectedToday,
                      ]}
                    >
                      <Mono style={[styles.dayNumber, !trained && styles.dayNumberIdle]}>
                        {fromDateKey(dateKey).getDate()}
                      </Mono>
                    </View>
                    <View style={[styles.dayDot, trained && styles.dayDotFilled]} />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Card>

        <DayDetail
          dateKey={selected}
          detail={day.data}
          onStart={async (routineId) => {
            const session = await startSession(routineId, fromDateKey(selected));
            bumpData();
            router.push(`/session/${session.id}`);
          }}
          onOpen={(sessionId) => router.push(`/session/${sessionId}`)}
        />
      </ScrollView>
    </Screen>
  );
}

type DayDetailData = {
  session: Awaited<ReturnType<typeof getSessionByDate>>;
  /** A rotina do dia com os exercicios ja resolvidos para a semana daquela data. */
  planned: (Routine & { items: WeekExercise[] }) | null;
  sets: Awaited<ReturnType<typeof listSessionSets>>;
  names: Map<string, string>;
};

function DayDetail({
  dateKey,
  detail,
  onStart,
  onOpen,
}: {
  dateKey: string;
  detail: DayDetailData | null;
  onStart: (routineId: string | null) => void;
  onOpen: (sessionId: string) => void;
}) {
  const date = fromDateKey(dateKey);
  const isFuture = date > new Date();

  if (!detail) return null;

  const { session, planned, sets, names } = detail;

  if (session) {
    const byExercise = volumeByExercise(sets);
    return (
      <Card onPress={() => onOpen(session.id)}>
        <Label>{shortDate(date)}</Label>
        <View style={styles.detailHead}>
          <Body>{dayTitle(planned?.name ?? '', planned?.items.length ?? 0, 'Treino livre')}</Body>
          <Meta>
            {formatVolume(totalVolume(sets))} kg
            {session.finishedAt
              ? ` · ${duration(session.startedAt, session.finishedAt)}`
              : ' · em andamento'}
          </Meta>
        </View>

        {[...byExercise.entries()].map(([exerciseId, volume]) => (
          <View key={exerciseId} style={styles.detailRow}>
            <Body numberOfLines={1} style={styles.detailName}>
              {names.get(exerciseId) ?? 'Exercício'}
            </Body>
            <Meta>{formatVolume(volume)} kg</Meta>
          </View>
        ))}
      </Card>
    );
  }

  const items = planned?.items ?? [];
  const trains = items.length > 0;

  return (
    <Card onPress={isFuture ? undefined : () => onStart(planned?.id ?? null)}>
      <Label>{shortDate(date)}</Label>
      <View style={styles.detailHead}>
        <Body>{dayTitle(planned?.name ?? '', items.length, 'Descanso')}</Body>
        <Meta>
          {trains ? (isFuture ? 'planejado' : 'toque para registrar') : 'sem exercícios neste dia'}
        </Meta>
      </View>

      {items.map((item) => (
        <View key={item.id} style={styles.detailRow}>
          <Body numberOfLines={1} style={styles.detailName}>
            {item.exerciseName}
          </Body>
          <Meta>
            {item.exerciseKind === 'run'
              ? `${formatDistance(item.targets.distanceKm)} km · ${formatDuration(item.targets.durationMin)}`
              : `${item.targets.sets} × ${item.targets.reps} · ${formatWeight(item.targets.weightKg)} kg`}
          </Meta>
        </View>
      ))}
    </Card>
  );
}

/** O nome do dia na tela; `fallback` cobre o dia sem rotulo e sem exercicio. */
function dayTitle(name: string, exerciseCount: number, fallback: string): string {
  const label = name.trim();
  if (label) return label;
  return exerciseCount === 0 ? fallback : 'Sem nome';
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
  },
  monthTitle: {
    alignItems: 'center',
  },
  weekdays: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
  },
  week: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInner: {
    width: 34,
    height: 34,
    borderRadius: radius.square,
    alignItems: 'center',
    justifyContent: 'center',
    // A borda existe em todo dia, transparente por padrao: se so aparecesse nos
    // estados marcados, o numero andaria 1px ao entrar e sair deles.
    borderWidth: 1,
    borderColor: 'transparent',
  },
  /** Hoje: so o contorno. Marca o dia sem competir com a selecao. */
  dayToday: {
    borderColor: colors.border,
  },
  /** Selecionado: preenchido. E o estado que o dedo acabou de causar. */
  daySelected: {
    backgroundColor: surfaces.raised,
    borderColor: colors.border,
  },
  /** Os dois ao mesmo tempo: preenchido, com a borda um passo mais visivel. */
  daySelectedToday: {
    borderColor: colors.borderStrong,
  },
  dayNumber: {
    fontFamily: fonts.monoLight,
    fontSize: fontSize.labelLg,
    color: colors.textPrimary,
    textAlign: 'center',
    // O Android reserva um respiro extra em volta da linha a partir das metricas
    // da fonte, e ele nao e simetrico — sozinho ja empurra o numero para baixo
    // dentro do quadrado. A JetBrains Mono e das piores nisso.
    includeFontPadding: false,
  },
  dayNumberIdle: {
    color: colors.textSecondary,
  },
  /**
   * Fica fora do quadrado, nao dentro: como filho do highlight ele entrava na
   * conta da centralizacao vertical e empurrava o numero uns 3px para cima —
   * o quadrado parecia desalinhado com o proprio numero que envolve.
   */
  dayDot: {
    width: 3,
    height: 3,
    borderRadius: radius.pill,
    marginTop: 4,
    backgroundColor: 'transparent',
  },
  dayDotFilled: {
    backgroundColor: colors.dotFilled,
  },
  detailHead: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  detailName: {
    flex: 1,
    fontSize: fontSize.body,
    marginRight: spacing.md,
  },
});

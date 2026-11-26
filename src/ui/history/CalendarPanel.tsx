import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  getOrCreateSessionForDate,
  getSessionByDate,
  listExercises,
  listRoutines,
  listSessionSets,
  targetsForWeek,
  trainedDates,
  type WeekExercise,
} from '@/db/repo';
import { currentStreak } from '@/domain/streak';
import { dayTitle } from '@/domain/today';
import type { Routine } from '@/domain/types';
import { formatDistance, formatDuration } from '@/domain/run';
import { formatVolume, formatWeight, totalVolume, volumeByExercise } from '@/domain/volume';
import {
  fromDateKey,
  lastNDays,
  monthGrid,
  monthLabel,
  routineForWeekday,
  toDateKey,
  weekStartKey,
  weekdayInitials,
  weekdayOf,
} from '@/domain/week';
import { bumpData, useQuery } from '@/store/data';
import { colors, fontSize, fonts, layout, radius, section, shape, spacing, theme, tint } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { LoadError } from '@/ui/LoadError';
import { shortDate } from '@/ui/relative';
import { RoundButton } from '@/ui/Screen';
import { useTabBarClearance } from '@/ui/tabBar';
import { Body, Label, Meta, Mono } from '@/ui/Text';
import { BarbellIcon, ChevronLeftIcon, ChevronRightIcon, FlameIcon } from '@/ui/icons';
import { MovementFigure } from '@/ui/MovementFigure';
import { artSlugFor } from '@/movements/library';

/**
 * Calendario do app — o painel "Calendário" da aba Histórico.
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
/** Quanto para tras a sequencia olha. Mais de um ano seguido e caso de comemorar a parte. */
const STREAK_WINDOW_DAYS = 400;

export function CalendarPanel() {
  const clearance = useTabBarClearance();
  const router = useRouter();
  const today = new Date();

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(toDateKey(today));

  const monthKeys = monthGrid(cursor.getFullYear(), cursor.getMonth());
  const firstKey = toDateKey(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  const lastKey = toDateKey(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));

  const month = useQuery(
    useCallback(async () => ({ trained: await trainedDates(firstKey, lastKey) }), [firstKey, lastKey]),
  );

  /**
   * A sequencia de dias seguidos. Morava na Hoje, no card de progresso que saiu
   * no plano 16; veio para ca porque e aqui que dias seguidos se leem — o mesmo
   * calendario mostra quais sao.
   */
  const streak = useQuery(
    useCallback(async () => {
      const now = new Date();
      const window = lastNDays(now, STREAK_WINDOW_DAYS);
      return currentStreak(await trainedDates(window[0], toDateKey(now)), now);
    }, []),
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

  const failed = month.error ?? day.error;
  if (failed) {
    return (
      <LoadError
        error={failed}
        onRetry={() => {
          month.reload();
          day.reload();
        }}
      />
    );
  }

  return (
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
      {/* O resumo do mes em dois blocos, com icone: quantos treinos e a
          sequencia atual. Le-se antes do calendario, de relance. */}
      <View style={styles.stats}>
        <StatTile
          icon={<BarbellIcon size={22} color={section.history} />}
          value={String(month.data?.trained.size ?? 0)}
          label={`treinos em ${monthLabel(cursor.getMonth()).toLowerCase()}`}
        />
        <StatTile
          icon={<FlameIcon size={22} color={section.today} />}
          value={String(streak.data ?? 0)}
          label={(streak.data ?? 0) === 1 ? 'dia seguido' : 'dias seguidos'}
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
                      trained && styles.dayTrained,
                      isToday && styles.dayToday,
                      isSelected && styles.daySelected,
                      isSelected && isToday && styles.daySelectedToday,
                    ]}
                  >
                    <Mono
                      style={[
                        styles.dayNumber,
                        !trained && styles.dayNumberIdle,
                        trained && styles.dayNumberTrained,
                      ]}
                    >
                      {fromDateKey(dateKey).getDate()}
                    </Mono>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>

      <DayDetail
        dateKey={selected}
        detail={day.data}
        onStart={async () => {
          const session = await getOrCreateSessionForDate(fromDateKey(selected));
          bumpData();
          router.push(`/session/${session.id}`);
        }}
        onOpen={(sessionId) => router.push(`/session/${sessionId}`)}
      />
    </ScrollView>
  );
}

/** Bloco de resumo: icone, numero grande e o que ele conta. */
function StatTile({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statValue} maxFontSizeMultiplier={1.2}>
        {value}
      </Text>
      <Meta numberOfLines={2}>{label}</Meta>
    </View>
  );
}

/** A miniatura do movimento ao lado do nome do exercicio. */
function Thumb({ name }: { name: string }) {
  return (
    <View style={styles.thumb}>
      <MovementFigure slug={artSlugFor(name)} size={28} color={theme.onSurface} />
    </View>
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
  onStart: () => void;
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
          <Text style={styles.detailTitle}>
            {dayTitle(planned?.name ?? '', planned?.items.length ?? 0, 'Treino livre')}
          </Text>
          {/* So o volume: nao ha mais treino em andamento nem cronometro — o
              registro nasce pronto e a duracao seria sempre zero. */}
          <Meta>{formatVolume(totalVolume(sets))} kg</Meta>
        </View>

        {[...byExercise.entries()].map(([exerciseId, volume]) => (
          <View key={exerciseId} style={styles.detailRow}>
            <Thumb name={names.get(exerciseId) ?? ''} />
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
    <Card onPress={isFuture ? undefined : onStart}>
      <Label>{shortDate(date)}</Label>
      <View style={styles.detailHead}>
        <Text style={styles.detailTitle}>{dayTitle(planned?.name ?? '', items.length, 'Descanso')}</Text>
        <Meta>
          {trains ? (isFuture ? 'planejado' : 'toque para registrar') : 'sem exercícios neste dia'}
        </Meta>
      </View>

      {items.map((item) => (
        <View key={item.id} style={styles.detailRow}>
          <Thumb name={item.exerciseName} />
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

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    gap: layout.cardGap,
  },
  statTile: {
    flex: 1,
    backgroundColor: theme.surfaceContainer,
    borderRadius: shape.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: tint(section.history, 0.16),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: theme.onSurface,
    fontVariant: ['tabular-nums'],
  },
  detailTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 26,
    color: theme.onSurface,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  streak: {
    textAlign: 'center',
    paddingBottom: spacing.sm,
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
  /** Dia treinado: quadradinho cheio, como num mapa de atividade. */
  dayTrained: {
    backgroundColor: theme.primaryContainer,
  },
  dayNumberTrained: {
    color: theme.onPrimary,
  },
  dayToday: {
    borderColor: section.history,
  },
  /** Selecionado: preenchido. E o estado que o dedo acabou de causar. */
  daySelected: {
    borderColor: theme.onSurface,
    borderWidth: 2,
  },
  /** Os dois ao mesmo tempo: preenchido, com a borda um passo mais visivel. */
  daySelectedToday: {
    borderColor: colors.borderStrong,
  },
  dayNumber: {
    fontFamily: fonts.monoLight,
    fontSize: fontSize.aux,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 56,
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

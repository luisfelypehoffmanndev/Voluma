import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { closedWeeks, firstName } from '@/domain/friends';
import { formatDistance } from '@/domain/run';
import { closedWeeksAverage } from '@/domain/volume';
import { monthLabel, toDateKey } from '@/domain/week';
import { chart, colors, fontSize, spacing } from '@/theme/tokens';
import { Avatar } from '@/ui/Avatar';
import { Card } from '@/ui/Card';
import { monthTicks, weekMonthKey } from '@/ui/charts/axis';
import { BarChart } from '@/ui/charts/BarChart';
import { MonthAxis } from '@/ui/charts/Frame';
import { GlowCanvas } from '@/ui/charts/GlowCanvas';
import { barLayout, goalSquareShapes, goalSquareSize } from '@/ui/charts/shapes';
import { LoadError } from '@/ui/LoadError';
import { Header, Screen } from '@/ui/Screen';
import { StatNumber } from '@/ui/StatNumber';
import { Body, Label, Meta, Title } from '@/ui/Text';
import { useFriendsData, type FriendPerson } from '@/ui/history/useFriendsData';

const DAYS_IN_WEEK = 7;
const BARS_HEIGHT = 72;
const SQUARE = 18;
/** A coluna do nome, a esquerda das fileiras da meta. */
const GOAL_NAME = 56;

/**
 * Um amigo, de perto: a semana dele ao lado da sua, as ultimas 12 semanas, a
 * meta e a corrida.
 *
 * Sempre comparado a VOCE, e nao a todos: o ranking ja compara o grupo; aqui a
 * pergunta e "como eu estou em relacao a essa pessoa". Cada um na sua cor, a
 * mesma do ranking, na mesma escala.
 */
export default function FriendScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { data, error, reload } = useFriendsData();

  const person = data?.people.find((candidate) => candidate.id === id) ?? null;
  const me = data?.people[0] ?? null;
  const title = person ? (firstName(person.displayName) ?? `@${person.handle}`) : '';

  if (error) {
    return (
      <Screen>
        <Header title="" back />
        <LoadError error={error} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={title} back />
      {data && person && me ? (
        <Detail
          person={person}
          me={me}
          weekKeys={data.weekKeys}
          month={data.month}
          width={width - spacing.xl * 4}
        />
      ) : data ? (
        <Meta style={styles.gone}>Essa pessoa não está mais na sua lista de amigos.</Meta>
      ) : null}
    </Screen>
  );
}

function Detail({
  person,
  me,
  weekKeys,
  month,
  width,
}: {
  person: FriendPerson;
  me: FriendPerson;
  weekKeys: string[];
  month: number;
  width: number;
}) {
  const first = firstName(person.displayName) ?? `@${person.handle}`;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Card>
        <View style={styles.hero}>
          <Avatar
            handle={person.handle}
            uri={person.avatarUri}
            path={person.avatarPath}
            color={person.color}
            size={72}
          />
          <View style={styles.heroText}>
            <Title numberOfLines={2}>{person.displayName ?? `@${person.handle}`}</Title>
            {person.displayName ? <Meta>@{person.handle}</Meta> : null}
          </View>
        </View>

        {person.weeks === null ? (
          <Meta style={styles.section}>{first} não compartilha os números.</Meta>
        ) : (
          <View style={[styles.section, styles.versus]}>
            <Versus label={`${first} esta semana`} value={lastOf(person.weeks)} unit="dias" strong />
            <Versus label="você" value={lastOf(me.weeks)} unit="dias" />
          </View>
        )}
      </Card>

      {person.weeks === null ? null : (
        <>
          <WeeksCard person={person} me={me} weekKeys={weekKeys} width={width} />
          <GoalCard person={person} me={me} weekKeys={weekKeys} width={width} />
          <RunCard person={person} me={me} month={month} />
        </>
      )}
    </ScrollView>
  );
}

/**
 * As 12 semanas dele em cima e as suas embaixo, cada fileira na cor da pessoa,
 * as duas na mesma escala de 0 a 7 dias — o "7" marcado, o teto de uma semana.
 * A semana atual tem glow forte e o numero em cima. Os meses aparecem uma vez,
 * embaixo da ultima fileira: as duas dividem o mesmo tempo.
 */
function WeeksCard({
  person,
  me,
  weekKeys,
  width,
}: {
  person: FriendPerson;
  me: FriendPerson;
  weekKeys: string[];
  width: number;
}) {
  const months = useMemo(() => {
    const today = toDateKey(new Date());
    return monthTicks(weekKeys.map((key) => weekMonthKey(key, today)));
  }, [weekKeys]);
  const people = [person, me];

  return (
    <Card>
      <Label>Últimas 12 semanas</Label>
      {people.map((who, index) => {
        const weeks = who.weeks ?? [];
        const name = who.isSelf ? 'Você' : (firstName(who.displayName) ?? `@${who.handle}`);
        return (
          <View key={who.id} style={styles.section}>
            <View style={styles.seriesHead}>
              <Body style={who.isSelf ? styles.dim : null}>{name}</Body>
              <Meta>{averageLabel(who.weeks)}</Meta>
            </View>
            <BarChart
              values={weeks}
              width={width}
              height={BARS_HEIGHT}
              color={who.color}
              max={DAYS_IN_WEEK}
              highlight={weeks.length - 1}
              topLabel={
                // Sem barra, um "0" solto parece rotulo perdido: o numero ja esta
                // no cabecalho da tela.
                (weeks[weeks.length - 1] ?? 0) > 0
                  ? { index: weeks.length - 1, text: String(weeks[weeks.length - 1]) }
                  : null
              }
              months={index === people.length - 1 ? months : []}
              accessibilityLabel={`${name}: dias por semana, da mais antiga à atual: ${weeks.join(', ')}`}
            />
          </View>
        );
      })}
    </Card>
  );
}

/**
 * A meta de cada semana, ele e voce em fileiras de celulas: cheia na cor da
 * pessoa quando a semana bateu os dias do Plano, so contorno quando nao bateu,
 * tracejada na semana em curso. Os meses repetem embaixo, cada um sob a
 * primeira semana dele.
 */
function GoalCard({
  person,
  me,
  weekKeys,
  width,
}: {
  person: FriendPerson;
  me: FriendPerson;
  weekKeys: string[];
  width: number;
}) {
  const goal = person.weeks === null ? null : closedWeeks(person.weeks, person.plannedDays);
  const mine = me.weeks === null ? null : closedWeeks(me.weeks, me.plannedDays);
  const rowWidth = width - GOAL_NAME;
  const months = useMemo(() => {
    const today = toDateKey(new Date());
    return monthTicks(weekKeys.map((key) => weekMonthKey(key, today)));
  }, [weekKeys]);
  const { center } = barLayout(weekKeys.length, rowWidth);

  return (
    <Card>
      <Label>Meta semanal</Label>
      {goal === null ? (
        <Meta style={styles.section}>Sem treinos no Plano, sem meta.</Meta>
      ) : (
        <>
          <View style={[styles.section, styles.goalHead]}>
            <StatNumber value={String(goal.count)} unit={`de ${goal.of}`} size={fontSize.numberMd} />
            <Meta>semanas com os {person.plannedDays} dias do Plano</Meta>
          </View>
          <View style={styles.section}>
            <GoalRow
              name={firstName(person.displayName) ?? `@${person.handle}`}
              goals={goal.weeks}
              color={person.color}
              width={rowWidth}
            />
            {mine ? (
              <GoalRow name="Você" goals={mine.weeks} color={me.color} width={rowWidth} dim />
            ) : null}
            <View style={styles.goalAxis}>
              <MonthAxis
                width={rowWidth}
                months={months.map((month) => ({ x: center(month.index), label: month.label }))}
              />
            </View>
          </View>
          {mine ? (
            <Meta style={styles.section}>
              você: {mine.count} de {mine.of}
            </Meta>
          ) : null}
        </>
      )}
    </Card>
  );
}

function GoalRow({
  name,
  goals,
  color,
  width,
  dim = false,
}: {
  name: string;
  goals: readonly ('closed' | 'missed' | 'open')[];
  color: string;
  width: number;
  dim?: boolean;
}) {
  const shapes = useMemo(
    () =>
      goalSquareShapes({
        goals,
        width,
        color,
        muted: chart.tick,
        open: colors.textSecondary,
        maxSize: SQUARE,
      }),
    [goals, width, color],
  );
  const size = goalSquareSize(width, goals.length, SQUARE);

  return (
    <View style={styles.goalRow}>
      <Meta numberOfLines={1} style={[styles.goalName, !dim && styles.goalNameStrong]}>
        {name}
      </Meta>
      <GlowCanvas shapes={shapes} width={width} height={size} />
    </View>
  );
}

function RunCard({ person, me, month }: { person: FriendPerson; me: FriendPerson; month: number }) {
  // Ninguem correu: um card de "0 km" contra "0 km" nao diz nada.
  if ((person.km ?? 0) <= 0 && (me.km ?? 0) <= 0) return null;
  const first = firstName(person.displayName) ?? `@${person.handle}`;

  return (
    <Card>
      <Label>{`Corrida em ${monthLabel(month).toLowerCase()}`}</Label>
      <View style={[styles.section, styles.versus]}>
        <Versus label={first} value={formatDistance(person.km ?? 0)} unit="km" strong />
        <Versus label="você" value={formatDistance(me.km ?? 0)} unit="km" />
      </View>
    </Card>
  );
}

/** Um numero grande com o dono embaixo — o par "ele x voce". */
function Versus({
  label,
  value,
  unit,
  strong = false,
}: {
  label: string;
  value: number | string;
  unit: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.versusItem}>
      <StatNumber
        value={String(value)}
        unit={unit}
        size={strong ? fontSize.numberMd : fontSize.numberSm}
        color={strong ? colors.textPrimary : colors.textSecondary}
      />
      <Meta>{label}</Meta>
    </View>
  );
}

function lastOf(weeks: number[] | null): number {
  return weeks === null ? 0 : (weeks[weeks.length - 1] ?? 0);
}

/** "média 2,7 por semana" — das semanas fechadas, sem a atual pela metade. */
function averageLabel(weeks: number[] | null): string {
  const mean = weeks === null ? null : closedWeeksAverage(weeks);
  if (mean === null) return '';
  return `média ${(Math.round(mean * 10) / 10).toFixed(1).replace('.', ',')} por semana`;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  gone: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  section: {
    marginTop: spacing.lg,
  },
  versus: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xl,
  },
  versusItem: {
    gap: 2,
  },
  seriesHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  dim: {
    color: colors.textSecondary,
  },
  goalHead: {
    gap: 2,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  goalName: {
    width: GOAL_NAME,
  },
  goalNameStrong: {
    color: colors.textPrimary,
  },
  goalAxis: {
    marginLeft: GOAL_NAME,
  },
});

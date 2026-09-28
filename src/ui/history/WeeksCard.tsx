import { StyleSheet, View } from 'react-native';

import { rankByValue } from '@/domain/friends';
import { closedWeeksAverage } from '@/domain/volume';
import { chart, colors, spacing } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { MiniBars } from '@/ui/charts/MiniBars';
import { Label, Meta, Mono } from '@/ui/Text';

import { NAME_WIDTH, PersonName, VALUE_WIDTH, describePerson } from './RankingList';

/** Dias treinados por semana de uma pessoa; `weeks` nulo sem o toggle. */
export type PersonWeeks = {
  handle: string;
  isSelf: boolean;
  weeks: number[] | null;
  plannedDays: number | null;
};

type Props = {
  people: readonly PersonWeeks[];
  /** Rotulos das pontas, uma vez so para todas as fileiras. */
  start: string;
  end: string;
  width: number;
};

const DAYS_IN_WEEK = 7;
/**
 * Alto o bastante para 2 e 3 dias se distinguirem (11 contra 17dp): a 28dp
 * a diferenca era de 4dp e as fileiras pareciam iguais.
 */
const BARS_HEIGHT = 40;

/**
 * As ultimas semanas de cada pessoa, uma fileira de barras por pessoa, todas na
 * mesma escala de 0 a 7 dias — e o que deixa a fileira de um comparavel a do
 * outro sem cor nenhuma.
 *
 * A media a direita e a das semanas FECHADAS (`closedWeeksAverage`): a atual,
 * pela metade, derrubaria todo mundo na segunda-feira.
 */
export function WeeksCard({ people, start, end, width }: Props) {
  const barsWidth = Math.max(0, width - NAME_WIDTH - VALUE_WIDTH - spacing.sm * 2);
  const ranked = rankByValue(people, (person) => average(person.weeks));

  return (
    <Card>
      <Label>{`Últimas ${people[0]?.weeks?.length ?? 12} semanas · dias treinados`}</Label>
      {ranked.map((person) => {
        const mean = average(person.weeks);
        return (
          <View key={person.isSelf ? 'self' : person.handle} style={styles.row}>
            <PersonName handle={person.handle} isSelf={person.isSelf} />
            {person.weeks === null ? (
              <Meta style={{ width: barsWidth + spacing.sm + VALUE_WIDTH }}>não compartilha</Meta>
            ) : (
              <>
                <MiniBars
                  values={person.weeks}
                  max={DAYS_IN_WEEK}
                  width={barsWidth}
                  height={BARS_HEIGHT}
                  color={person.isSelf ? colors.textPrimary : chart.line}
                  accessibilityLabel={describeWeeks(person, mean)}
                />
                <Mono style={[styles.value, person.isSelf ? styles.self : styles.other]}>
                  {mean === null ? '–' : formatMean(mean)}
                </Mono>
              </>
            )}
          </View>
        );
      })}
      <View style={[styles.ends, { marginLeft: NAME_WIDTH + spacing.sm, width: barsWidth }]}>
        <Meta>{start}</Meta>
        <Meta>{end}</Meta>
      </View>
      <Meta style={styles.foot}>À direita, a média de dias por semana, sem contar a atual.</Meta>
    </Card>
  );
}

function average(weeks: number[] | null): number | null {
  return weeks === null ? null : closedWeeksAverage(weeks);
}

/** "3,2" — uma casa, virgula. */
function formatMean(mean: number): string {
  return (Math.round(mean * 10) / 10).toFixed(1).replace('.', ',');
}

function describeWeeks(person: PersonWeeks, mean: number | null): string {
  const weeks = person.weeks ?? [];
  const media = mean === null ? '' : `, média de ${formatMean(mean)} dias por semana`;
  return `${describePerson(person.handle, person.isSelf)}${media}. Dias por semana, da mais antiga à atual: ${weeks.join(', ')}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  value: {
    width: VALUE_WIDTH,
    textAlign: 'right',
  },
  self: {
    color: colors.textPrimary,
  },
  other: {
    color: colors.textSecondary,
  },
  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  foot: {
    marginTop: spacing.lg,
  },
});

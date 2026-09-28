import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { closedWeeks, rankByValue, type Consistency, type WeekGoal } from '@/domain/friends';
import { chart, colors, spacing } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { Label, Meta, Mono } from '@/ui/Text';

import { NAME_WIDTH, PersonName, VALUE_WIDTH, describePerson } from './RankingList';
import type { PersonWeeks } from './WeeksCard';

type Props = {
  people: readonly PersonWeeks[];
  width: number;
};

const SQUARE_MAX = 12;
const GAP = 3;

/**
 * Semanas em que cada um bateu a propria meta — a meta sao os dias com treino
 * no Plano. Compara constancia, nao quantidade: quem planeja 2 dias e cumpre
 * fica igual a quem planeja 5 e cumpre.
 *
 * Um quadrado por semana, e o estado vai na FORMA, nao so no tom: cheio fechou,
 * contorno nao fechou, tracejado e a semana atual em andamento. O numero a
 * direita repete a contagem em texto.
 */
export function ConsistencyCard({ people, width }: Props) {
  const squaresWidth = Math.max(0, width - NAME_WIDTH - VALUE_WIDTH - spacing.sm * 2);
  const rows = rankByValue(
    people.map((person) => ({
      ...person,
      consistency: person.weeks === null ? null : closedWeeks(person.weeks, person.plannedDays),
    })),
    (row) => row.consistency?.count ?? null,
  );

  return (
    <Card>
      <Label>Semanas com a meta</Label>
      {rows.map((row) => (
        <View
          key={row.isSelf ? 'self' : row.handle}
          style={styles.row}
          accessible
          accessibilityLabel={describe(row, row.consistency)}
        >
          <PersonName handle={row.handle} isSelf={row.isSelf} />
          {row.consistency === null ? (
            <Meta style={{ width: squaresWidth + spacing.sm + VALUE_WIDTH }}>
              {row.weeks === null ? 'não compartilha' : 'sem plano'}
            </Meta>
          ) : (
            <>
              <Squares goals={row.consistency.weeks} width={squaresWidth} isSelf={row.isSelf} />
              <Mono style={[styles.value, row.isSelf ? styles.self : styles.other]}>
                {`${row.consistency.count}/${row.consistency.of}`}
              </Mono>
            </>
          )}
        </View>
      ))}
      <Meta style={styles.foot}>
        A meta de cada um são os dias com treino no Plano. A semana atual só conta quando fecha.
      </Meta>
    </Card>
  );
}

function Squares({ goals, width, isSelf }: { goals: WeekGoal[]; width: number; isSelf: boolean }) {
  const count = goals.length;
  const size = count > 0 ? Math.min(SQUARE_MAX, (width - GAP * (count - 1)) / count) : 0;
  const filled = isSelf ? colors.textPrimary : chart.line;

  return (
    <View style={{ width }}>
      <Svg width={width} height={size}>
        {goals.map((goal, index) => {
          const x = index * (size + GAP);
          // O contorno e desenhado por dentro: meia linha para dentro da caixa,
          // senao o quadrado vazado pareceria maior que o cheio.
          const inset = goal === 'closed' ? 0 : 0.5;
          return (
            <Rect
              key={index}
              x={x + inset}
              y={inset}
              width={size - inset * 2}
              height={size - inset * 2}
              rx={2}
              fill={goal === 'closed' ? filled : 'none'}
              stroke={goal === 'closed' ? 'none' : goal === 'open' ? colors.textSecondary : chart.tick}
              strokeWidth={1}
              strokeDasharray={goal === 'open' ? '2 2' : undefined}
            />
          );
        })}
      </Svg>
    </View>
  );
}

function describe(person: PersonWeeks, consistency: Consistency | null): string {
  const who = describePerson(person.handle, person.isSelf);
  if (person.weeks === null) return `${who}, não compartilha`;
  if (consistency === null) return `${who}, sem plano`;
  return `${who}, ${consistency.count} de ${consistency.of} semanas com a meta de ${person.plannedDays} dias`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
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
  foot: {
    marginTop: spacing.lg,
  },
});

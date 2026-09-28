import { StyleSheet, View } from 'react-native';

import type { RankingRow } from '@/domain/friends';
import { colors, fontSize, fonts, spacing } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { DashedBar } from '@/ui/DashedBar';
import { Body, Label, Meta, Mono } from '@/ui/Text';

type Props = {
  title: string;
  /** Ja ordenadas (`rankWithSelf`). */
  rows: readonly RankingRow[];
  /** Topo da barra: 7 para dias, o maior valor para km. */
  max: number;
  format: (value: number) => string;
  footer?: string;
  width: number;
};

const POSITION_WIDTH = 16;
/** Largura dos rotulos das fileiras da aba Amigos — compartilhada entre os cards. */
export const NAME_WIDTH = 120;
export const VALUE_WIDTH = 64;
const LABELS_WIDTH = POSITION_WIDTH + NAME_WIDTH + VALUE_WIDTH + spacing.sm * 3;

/**
 * Um ranking de pessoas por uma medida, voce incluido.
 *
 * Sem accent: a sua linha se separa das outras so pelo tom do texto. Quem nao
 * compartilha fica sem barra e com "nao compartilha" no lugar do numero —
 * nunca zero, que diria que a pessoa ficou parada.
 */
export function RankingList({ title, rows, max, format, footer, width }: Props) {
  const barWidth = Math.max(0, width - LABELS_WIDTH);

  return (
    <Card>
      <Label>{title}</Label>
      {rows.map((row, index) => {
        const tone = row.isSelf ? styles.self : styles.other;
        return (
          <View
            key={row.isSelf ? 'self' : row.handle}
            style={styles.row}
            accessible
            accessibilityLabel={describeRow(row, index + 1, format)}
          >
            <Mono style={[styles.position, tone]}>{String(index + 1)}</Mono>
            <PersonName handle={row.handle} isSelf={row.isSelf} />
            {row.value === null ? (
              <Meta style={{ width: barWidth + spacing.sm + VALUE_WIDTH }}>não compartilha</Meta>
            ) : (
              <>
                <DashedBar
                  progress={max > 0 ? row.value / max : 0}
                  width={barWidth}
                  fill={row.isSelf ? colors.textPrimary : colors.textSecondary}
                />
                <Mono style={[styles.value, tone]}>{format(row.value)}</Mono>
              </>
            )}
          </View>
        );
      })}
      {footer ? <Meta style={styles.foot}>{footer}</Meta> : null}
    </Card>
  );
}

/**
 * O nome de uma fileira: "Você" na sua, o @ nas outras. Corta no meio quando
 * nao cabe — o comeco e o fim do @ sao o que distingue "teste_bruno" de
 * "teste_bruna".
 */
export function PersonName({ handle, isSelf }: { handle: string; isSelf: boolean }) {
  return (
    <Body
      numberOfLines={1}
      ellipsizeMode="middle"
      style={[styles.name, isSelf ? [styles.self, styles.selfName] : styles.other]}
    >
      {isSelf ? 'Você' : `@${handle}`}
    </Body>
  );
}

/** "Você, @luis" na sua linha, "@ana" nas outras — o comeco do rotulo de acessibilidade. */
export function describePerson(handle: string, isSelf: boolean): string {
  return isSelf ? `Você, @${handle}` : `@${handle}`;
}

function describeRow(row: RankingRow, position: number, format: (value: number) => string): string {
  const value = row.value === null ? 'não compartilha' : format(row.value);
  return `${describePerson(row.handle, row.isSelf)}, ${position}º lugar, ${value}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  position: {
    width: POSITION_WIDTH,
  },
  name: {
    width: NAME_WIDTH,
    fontSize: fontSize.body,
  },
  value: {
    width: VALUE_WIDTH,
    textAlign: 'right',
  },
  self: {
    color: colors.textPrimary,
  },
  selfName: {
    fontFamily: fonts.sansMedium,
  },
  other: {
    color: colors.textSecondary,
  },
  foot: {
    marginTop: spacing.lg,
  },
});

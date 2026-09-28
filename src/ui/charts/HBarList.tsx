import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { chart, colors, fontSize, people, spacing } from '@/theme/tokens';
import { Body, Mono } from '@/ui/Text';

import { GlowCanvas } from './GlowCanvas';
import { hBarShapes } from './shapes';

export type HBarRow = {
  key: string;
  label: string;
  value: number;
  /** O valor escrito, no formato da unidade ("12,3 t", "840"). */
  text: string;
};

/**
 * Partes de um todo, lado a lado — o volume de cada grupo muscular.
 *
 * Barra horizontal porque o nome cabe inteiro em cima dela e o olho compara as
 * pontas de uma fileira para a outra. Cada uma sobre um trilho que vai ate a
 * maior, que por isso enche o trilho e leva o glow forte: e o grupo que o mes
 * mais treinou.
 */
export function HBarList({
  rows,
  width,
  color = people.self,
}: {
  rows: readonly HBarRow[];
  width: number;
  color?: string;
}) {
  const peak = Math.max(0, ...rows.map((row) => row.value));

  return (
    <View style={styles.list}>
      {rows.map((row, index) => (
        <View
          key={row.key}
          accessible
          accessibilityLabel={`${row.label}, ${row.text}`}
          style={styles.row}
        >
          <View style={styles.head}>
            <Body numberOfLines={1} style={styles.label}>
              {row.label}
            </Body>
            <Mono style={styles.value}>{row.text}</Mono>
          </View>
          <Bar
            progress={peak > 0 ? row.value / peak : 0}
            width={width}
            color={color}
            strong={index === 0 && row.value === peak}
          />
        </View>
      ))}
    </View>
  );
}

const BAR_HEIGHT = 8;

function Bar({
  progress,
  width,
  color,
  strong,
}: {
  progress: number;
  width: number;
  color: string;
  strong: boolean;
}) {
  const shapes = useMemo(
    () =>
      hBarShapes({
        progress,
        width,
        height: BAR_HEIGHT,
        color,
        track: chart.track,
        glow: strong ? 'strong' : 'soft',
      }),
    [progress, width, color, strong],
  );
  return <GlowCanvas shapes={shapes} width={width} height={BAR_HEIGHT} />;
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  row: {
    gap: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  label: {
    flex: 1,
    fontSize: fontSize.body,
  },
  value: {
    color: colors.textSecondary,
  },
});

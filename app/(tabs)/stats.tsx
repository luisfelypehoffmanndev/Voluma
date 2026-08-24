import { useCallback } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { listBodyWeightLogs, listExerciseRecords, volumeByDate } from '@/db/repo';
import { formatVolume, formatWeight } from '@/domain/volume';
import { lastNDays, toDateKey } from '@/domain/week';
import { useQuery } from '@/store/data';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { shortDate } from '@/ui/relative';
import { Header, Screen } from '@/ui/Screen';
import { StatNumber } from '@/ui/StatNumber';
import { useTabBarClearance } from '@/ui/tabBar';
import { Body, Label, Meta } from '@/ui/Text';

const WEEKS = 8;

/**
 * Numeros do historico.
 *
 * O accent desta tela e a barra da semana atual no grafico de volume — o unico
 * elemento colorido. Os recordes ficam em branco: destaque demais dilui o
 * proprio destaque.
 */
export default function StatsScreen() {
  const clearance = useTabBarClearance();
  const { width } = useWindowDimensions();

  const { data } = useQuery(
    useCallback(async () => {
      const now = new Date();
      const window = lastNDays(now, WEEKS * 7);
      const [volumes, records, weights] = await Promise.all([
        volumeByDate(window[0], toDateKey(now)),
        listExerciseRecords(),
        listBodyWeightLogs(12),
      ]);
      return { weeks: bucketByWeek(volumes, now), records, weights };
    }, []),
  );

  const weeks = data?.weeks ?? [];
  const peak = Math.max(1, ...weeks.map((week) => week.volume));
  const chartWidth = width - spacing.xl * 4;
  const barWidth = Math.floor(chartWidth / (WEEKS * 2));

  const thisWeek = weeks[weeks.length - 1]?.volume ?? 0;

  return (
    <Screen>
      <Header title="Números" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <Label>Volume por semana</Label>
          <View style={styles.chartHead}>
            <StatNumber
              value={formatVolume(thisWeek)}
              unit="kg"
              size={fontSize.numberMd}
            />
            <Meta>esta semana</Meta>
          </View>

          <View style={[styles.chart, { height: 96 }]}>
            {weeks.map((week, index) => {
              const isCurrent = index === weeks.length - 1;
              return (
                <View
                  key={week.startKey}
                  style={[
                    styles.bar,
                    {
                      width: barWidth,
                      height: Math.max(2, (week.volume / peak) * 96),
                      backgroundColor: isCurrent ? colors.accent : colors.dotEmpty,
                    },
                  ]}
                />
              );
            })}
          </View>

          <View style={styles.chartFoot}>
            <Meta>{weeks[0] ? shortDate(new Date(weeks[0].startKey)) : ''}</Meta>
            <Meta>agora</Meta>
          </View>
        </Card>

        <Card>
          <Label>Recordes por movimento</Label>
          {(data?.records ?? []).slice(0, 10).map((record) => (
            <View key={record.exerciseId} style={styles.row}>
              <Body numberOfLines={1} style={styles.rowName}>
                {record.exerciseName}
              </Body>
              <Meta>
                {formatWeight(record.heaviestKg)} kg · {formatVolume(record.bestVolume)} kg
              </Meta>
            </View>
          ))}
          {(data?.records.length ?? 0) === 0 ? (
            <Meta style={styles.empty}>Nenhuma série registrada ainda.</Meta>
          ) : null}
        </Card>

        <Card>
          <Label>Peso corporal</Label>
          {(data?.weights ?? []).map((log) => (
            <View key={log.id} style={styles.row}>
              <Body style={styles.rowName}>{formatWeight(log.weightKg)} kg</Body>
              <Meta>{shortDate(new Date(log.loggedAt))}</Meta>
            </View>
          ))}
          {(data?.weights.length ?? 0) === 0 ? (
            <Meta style={styles.empty}>Nenhum registro de peso.</Meta>
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

type WeekBucket = { startKey: string; volume: number };

/** Agrupa o volume diario em semanas de 7 dias terminando hoje. */
function bucketByWeek(volumes: ReadonlyMap<string, number>, now: Date): WeekBucket[] {
  const days = lastNDays(now, WEEKS * 7);
  const buckets: WeekBucket[] = [];

  for (let index = 0; index < days.length; index += 7) {
    const slice = days.slice(index, index + 7);
    buckets.push({
      startKey: slice[0],
      volume: slice.reduce((sum, key) => sum + (volumes.get(key) ?? 0), 0),
    });
  }

  return buckets;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  chartHead: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  bar: {
    borderRadius: 2,
  },
  chartFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  rowName: {
    flex: 1,
    fontSize: fontSize.body,
    marginRight: spacing.md,
  },
  empty: {
    paddingTop: spacing.lg,
  },
});

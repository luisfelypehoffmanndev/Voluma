import { useCallback } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { distanceByDate, listBodyWeightLogs, listExerciseRecords, volumeByDate } from '@/db/repo';
import { formatDistance } from '@/domain/run';
import { formatVolume, formatWeight } from '@/domain/volume';
import { fromDateKey, lastNDays, toDateKey } from '@/domain/week';
import { useQuery } from '@/store/data';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { shortDate } from '@/ui/relative';
import { StatNumber } from '@/ui/StatNumber';
import { useTabBarClearance } from '@/ui/tabBar';
import { Body, Label, Meta } from '@/ui/Text';

/**
 * Dias no grafico de volume.
 *
 * Duas semanas, e nao mais: a comparacao que interessa e "hoje contra os
 * ultimos dias", e cada barra precisa de largura para ser lida uma a uma. Num
 * telefone comum, 14 barras ficam com ~10px cada; 30 virariam uma serra.
 */
const DAYS = 14;

/**
 * Numeros do historico — o painel "Números" da aba Histórico.
 *
 * O accent desta tela e a barra de hoje no grafico de volume — o unico elemento
 * colorido. Os recordes ficam em branco: destaque demais dilui o proprio
 * destaque. O seletor segmentado acima do painel e sem cor por isso.
 *
 * A distancia dos ultimos 7 dias veio da home, que passou a ter um trabalho so
 * (comecar o treino de hoje).
 */
export function StatsPanel() {
  const clearance = useTabBarClearance();
  const { width } = useWindowDimensions();

  const { data } = useQuery(
    useCallback(async () => {
      const now = new Date();
      const window = lastNDays(now, DAYS);
      const weekKeys = lastNDays(now, 7);
      const [volumes, records, weights, distances] = await Promise.all([
        volumeByDate(window[0], toDateKey(now)),
        listExerciseRecords(),
        listBodyWeightLogs(12),
        distanceByDate(weekKeys[0], toDateKey(now)),
      ]);
      // Arredonda a uma casa: somar 0,1 sete vezes rende 0,7000000000000001.
      const weekDistance =
        Math.round(weekKeys.reduce((sum, key) => sum + (distances.get(key) ?? 0), 0) * 10) / 10;
      // Dia sem treino nao some do grafico: vira uma barra no piso, e e o vazio
      // entre os treinos que da sentido a comparacao.
      const days = window.map((key) => ({ key, volume: volumes.get(key) ?? 0 }));
      return { days, records, weights, weekDistance };
    }, []),
  );

  const days = data?.days ?? [];
  const peak = Math.max(1, ...days.map((day) => day.volume));
  const chartWidth = width - spacing.xl * 4;
  const barWidth = Math.floor(chartWidth / (DAYS * 2));

  const today = days[days.length - 1]?.volume ?? 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
      showsVerticalScrollIndicator={false}
    >
      <Card>
        <Label>Volume por dia</Label>
        <View style={styles.chartHead}>
          <StatNumber
            value={formatVolume(today)}
            unit="kg"
            size={fontSize.numberMd}
          />
          <Meta>hoje</Meta>
        </View>

        <View style={[styles.chart, { height: 96 }]}>
          {days.map((day, index) => {
            const isToday = index === days.length - 1;
            return (
              <View
                key={day.key}
                style={[
                  styles.bar,
                  {
                    width: barWidth,
                    height: Math.max(2, (day.volume / peak) * 96),
                    backgroundColor: isToday ? colors.accent : colors.dotEmpty,
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={styles.chartFoot}>
          <Meta>{days[0] ? shortDate(fromDateKey(days[0].key)) : ''}</Meta>
          <Meta>hoje</Meta>
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

      {/* Km e kg nao somam: distancia tem card proprio, nunca um total misturado. */}
      <Card>
        <Label>Distância</Label>
        <View style={styles.chartHead}>
          <StatNumber
            value={formatDistance(data?.weekDistance ?? 0)}
            unit="km"
            size={fontSize.numberMd}
          />
          <Meta>últimos 7 dias</Meta>
        </View>
      </Card>
    </ScrollView>
  );
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
    borderTopColor: colors.divider,
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

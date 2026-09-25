import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  distanceByDate,
  exerciseProgress,
  getOrCreateSessionForDate,
  listBodyWeightLogs,
  listExerciseRecords,
  progressCandidates,
  volumeByDate,
  volumeByMuscleGroup,
  type ProgressCandidate,
} from '@/db/repo';
import { dailyBodyWeight } from '@/domain/bodyweight';
import { formatDistance } from '@/domain/run';
import { formatVolume, formatWeight, volumeByWeek } from '@/domain/volume';
import { addWeeks, fromDateKey, lastNDays, toDateKey, weekStartKey } from '@/domain/week';
import { bumpData, useQuery } from '@/store/data';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { BarStrip } from '@/ui/charts/BarStrip';
import { DotLine } from '@/ui/charts/DotLine';
import { signedDelta } from '@/ui/charts/scale';
import { Chip } from '@/ui/Chip';
import { DashedBar } from '@/ui/DashedBar';
import { EmptyState } from '@/ui/EmptyState';
import { LoadError } from '@/ui/LoadError';
import { shortDate } from '@/ui/relative';
import { StatNumber } from '@/ui/StatNumber';
import { useTabBarClearance } from '@/ui/tabBar';
import { Body, Label, Meta, Mono } from '@/ui/Text';

/**
 * Dias no grafico de volume.
 *
 * Duas semanas, e nao mais: a comparacao que interessa e "hoje contra os
 * ultimos dias", e cada barra precisa de largura para ser lida uma a uma. Num
 * telefone comum, 14 barras ficam com ~10px cada; 30 virariam uma serra.
 */
const DAYS = 14;

/**
 * A janela dos graficos de evolucao (volume por semana, progressao, peso).
 *
 * Doze semanas e o horizonte de um ciclo de treino: longo o bastante para uma
 * progressao de carga aparecer, curto o bastante para cada ponto ter espaco.
 */
const WEEKS = 12;

/** A janela dos grupos musculares: o "mes" de treino, contado a partir de hoje. */
const GROUP_DAYS = 30;

/**
 * Numeros do historico — o painel "Números" da aba Histórico.
 *
 * O accent desta tela e a barra de hoje no grafico de volume — o unico elemento
 * colorido. Os graficos de evolucao, os recordes e os grupos ficam em cinza e
 * branco: destaque demais dilui o proprio destaque. O seletor segmentado acima
 * do painel e sem cor por isso.
 *
 * A distancia dos ultimos 7 dias veio da home, que passou a ter um trabalho so
 * (comecar o treino de hoje).
 */
export function StatsPanel() {
  const clearance = useTabBarClearance();
  const { width } = useWindowDimensions();

  const router = useRouter();
  const { data, error, reload } = useQuery(
    useCallback(async () => {
      const now = new Date();
      const todayKey = toDateKey(now);
      const window = lastNDays(now, DAYS);
      const weekKeys = lastNDays(now, 7);
      // Uma consulta de volume so para os dois graficos: as 12 semanas sempre
      // contem os 14 dias.
      const since = addWeeks(weekStartKey(now), -(WEEKS - 1));
      const [volumes, records, logs, distances, groups, candidates] = await Promise.all([
        volumeByDate(since, todayKey),
        listExerciseRecords(),
        listBodyWeightLogs(WEEKS * 7),
        distanceByDate(weekKeys[0], todayKey),
        volumeByMuscleGroup(lastNDays(now, GROUP_DAYS)[0], todayKey),
        progressCandidates(since),
      ]);
      // Arredonda a uma casa: somar 0,1 sete vezes rende 0,7000000000000001.
      const weekDistance =
        Math.round(weekKeys.reduce((sum, key) => sum + (distances.get(key) ?? 0), 0) * 10) / 10;
      // Dia sem treino nao some do grafico: vira uma barra no piso, e e o vazio
      // entre os treinos que da sentido a comparacao.
      const days = window.map((key) => ({ key, volume: volumes.get(key) ?? 0 }));
      return {
        days,
        weeks: volumeByWeek(volumes, now, WEEKS),
        records,
        weights: dailyBodyWeight(logs, since),
        weekDistance,
        groups,
        candidates,
        since,
      };
    }, []),
  );

  const days = data?.days ?? [];
  const weeks = data?.weeks ?? [];
  const chartWidth = width - spacing.xl * 4;

  const today = days[days.length - 1]?.volume ?? 0;
  const thisWeek = weeks[weeks.length - 1]?.volume ?? 0;
  // A semana atual quase sempre esta pela metade: compara-la com as outras em
  // porcentagem diria "caiu 60%" toda segunda. A media das semanas fechadas e o
  // numero de referencia, sem delta.
  const closed = weeks.slice(0, -1);
  const weeklyAverage =
    closed.length > 0 ? closed.reduce((sum, week) => sum + week.volume, 0) / closed.length : 0;

  const weights = data?.weights ?? [];
  const latestWeight = weights[weights.length - 1];
  const groups = data?.groups ?? [];
  const heaviestGroup = groups[0]?.volume ?? 0;

  if (error) return <LoadError error={error} onRetry={reload} />;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
      showsVerticalScrollIndicator={false}
    >
      <Card>
        <Label>Volume por dia</Label>
        <View style={styles.chartHead}>
          <StatNumber value={formatVolume(today)} unit="kg" size={fontSize.numberMd} />
          <Meta>hoje</Meta>
        </View>

        <BarStrip
          values={days.map((day) => day.volume)}
          width={chartWidth}
          highlight={days.length - 1}
          highlightColor={colors.accent}
        />

        <View style={styles.chartFoot}>
          <Meta>{days[0] ? shortDate(fromDateKey(days[0].key)) : ''}</Meta>
          <Meta>hoje</Meta>
        </View>
      </Card>

      <Card>
        <Label>Volume por semana</Label>
        <View style={styles.chartHead}>
          <StatNumber value={formatVolume(thisWeek)} unit="kg" size={fontSize.numberMd} />
          <Meta>{`esta semana · média ${formatVolume(weeklyAverage)} kg`}</Meta>
        </View>

        <BarStrip
          values={weeks.map((week) => week.volume)}
          width={chartWidth}
          highlight={weeks.length - 1}
          highlightColor={colors.textPrimary}
        />

        <View style={styles.chartFoot}>
          <Meta>{weeks[0] ? shortDate(fromDateKey(weeks[0].weekStart)) : ''}</Meta>
          <Meta>esta semana</Meta>
        </View>
      </Card>

      {data ? (
        <ProgressCard candidates={data.candidates} since={data.since} width={chartWidth} />
      ) : null}

      <Card>
        <Label>{`Grupos · últimos ${GROUP_DAYS} dias`}</Label>
        {groups.map((group) => (
          <View key={group.group} style={styles.groupRow}>
            <Body numberOfLines={1} style={styles.groupName}>
              {group.group}
            </Body>
            <DashedBar
              progress={heaviestGroup > 0 ? group.volume / heaviestGroup : 0}
              width={Math.max(0, chartWidth - GROUP_LABELS_WIDTH)}
            />
            <Mono style={styles.groupValue}>{formatVolume(group.volume)}</Mono>
          </View>
        ))}
        {groups.length === 0 ? (
          <Meta style={styles.empty}>{`Nenhum treino com carga nos últimos ${GROUP_DAYS} dias.`}</Meta>
        ) : null}
      </Card>

      <Card>
        <Label>Peso corporal</Label>
        {latestWeight ? (
          <View style={styles.chartHead}>
            <StatNumber value={formatWeight(latestWeight.weightKg)} unit="kg" size={fontSize.numberMd} />
            <Meta>
              {weights.length > 1
                ? `${signedDelta(latestWeight.weightKg - weights[0].weightKg, formatWeight)} kg em ${WEEKS} sem`
                : shortDate(fromDateKey(latestWeight.date))}
            </Meta>
          </View>
        ) : null}
        {weights.length > 1 ? (
          <>
            <DotLine values={weights.map((point) => point.weightKg)} width={chartWidth} />
            <View style={styles.chartFoot}>
              <Meta>{shortDate(fromDateKey(weights[0].date))}</Meta>
              <Meta>{shortDate(fromDateKey(latestWeight!.date))}</Meta>
            </View>
          </>
        ) : null}
        {weights.length === 0 ? (
          <Meta style={styles.empty}>{`Nenhuma pesagem nas últimas ${WEEKS} semanas.`}</Meta>
        ) : null}
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
          <EmptyState
            title="Nenhum recorde ainda"
            message="Seus recordes aparecem aqui depois do primeiro treino."
            action={{
              label: 'Começar treino',
              onPress: async () => {
                const session = await getOrCreateSessionForDate(new Date());
                bumpData();
                router.push(`/session/${session.id}`);
              },
            }}
          />
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

/** Largura do nome do grupo e do numero, somadas, ao lado da barra de tracinhos. */
const GROUP_NAME_WIDTH = 72;
const GROUP_VALUE_WIDTH = 64;
const GROUP_LABELS_WIDTH = GROUP_NAME_WIDTH + GROUP_VALUE_WIDTH + spacing.sm * 2;

/**
 * A carga mais pesada de um exercicio, treino a treino, nas ultimas semanas.
 *
 * Tem consulta propria, com o exercicio nas deps: trocar de exercicio busca so
 * esta serie, sem recarregar a aba. Abre no exercicio mais treinado da janela.
 * A troca e uma fileira de chips que rola de lado, e nao uma folha de opcoes:
 * com uma dezena de exercicios a folha passaria da altura da tela, e ela nao
 * rola.
 */
function ProgressCard({
  candidates,
  since,
  width,
}: {
  candidates: readonly ProgressCandidate[];
  since: string;
  width: number;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  // O escolhido pode ter saido da lista (apagado, ou a janela andou): volta ao
  // primeiro em vez de mostrar um grafico vazio.
  const selected =
    candidates.find((candidate) => candidate.exerciseId === chosen) ?? candidates[0] ?? null;
  const exerciseId = selected?.exerciseId ?? null;

  const { data } = useQuery(
    useCallback(
      () => (exerciseId ? exerciseProgress(exerciseId, since) : Promise.resolve([])),
      [exerciseId, since],
    ),
  );
  const points = data ?? [];
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <Card>
      {/* O nome do exercicio nao entra no titulo: o chip aceso ja diz qual e. */}
      <Label>Progressão</Label>

      {candidates.length === 0 ? (
        <Meta style={styles.empty}>
          {`Nenhum exercício com carga em 2 treinos nas últimas ${WEEKS} semanas.`}
        </Meta>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chips}
          >
            {candidates.map((candidate) => (
              <Chip
                key={candidate.exerciseId}
                label={candidate.exerciseName}
                selected={candidate.exerciseId === exerciseId}
                onPress={() => setChosen(candidate.exerciseId)}
              />
            ))}
          </ScrollView>

          {first && last ? (
            <>
              <View style={styles.chartHead}>
                <StatNumber value={formatWeight(last.weightKg)} unit="kg" size={fontSize.numberMd} />
                <Meta>
                  {`${signedDelta(last.weightKg - first.weightKg, formatWeight)} kg em ${WEEKS} sem · ${points.length} treinos`}
                </Meta>
              </View>
              <DotLine values={points.map((point) => point.weightKg)} width={width} />
              <View style={styles.chartFoot}>
                <Meta>{shortDate(fromDateKey(first.date))}</Meta>
                <Meta>{shortDate(fromDateKey(last.date))}</Meta>
              </View>
            </>
          ) : null}
        </>
      )}
    </Card>
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
  // Sangra ate a borda do card para os chips rolarem por baixo do padding, sem
  // cortar o primeiro no meio.
  chipsScroll: {
    marginTop: spacing.md,
    marginHorizontal: -spacing.xl,
  },
  chips: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  groupName: {
    width: GROUP_NAME_WIDTH,
    fontSize: fontSize.body,
  },
  groupValue: {
    width: GROUP_VALUE_WIDTH,
    textAlign: 'right',
    color: colors.textSecondary,
  },
});

import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  distanceByDate,
  exerciseProgress,
  getOrCreateSessionForDate,
  listBodyWeightLogs,
  listExerciseRecords,
  progressCandidates,
  volumeByDate,
  volumeByMuscleGroup,
  type ExerciseRecord,
  type ProgressCandidate,
} from '@/db/repo';
import { dailyBodyWeight } from '@/domain/bodyweight';
import { formatDistance } from '@/domain/run';
import {
  closedWeeksAverage,
  formatVolume,
  formatWeight,
  volumeByWeek,
  type WeekVolume,
} from '@/domain/volume';
import { addWeeks, fromDateKey, lastNDays, toDateKey, weekStartKey } from '@/domain/week';
import { bumpData, useQuery } from '@/store/data';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { DotLine } from '@/ui/charts/DotLine';
import { signedDelta } from '@/ui/charts/scale';
import { StackedBars } from '@/ui/charts/StackedBars';
import { Chip } from '@/ui/Chip';
import { DashedBar } from '@/ui/DashedBar';
import { EmptyState } from '@/ui/EmptyState';
import { ChevronRightIcon } from '@/ui/icons';
import { LoadError } from '@/ui/LoadError';
import { useListMotion } from '@/ui/motion';
import { PressableSurface } from '@/ui/PressableSurface';
import { shortDate } from '@/ui/relative';
import { StatNumber } from '@/ui/StatNumber';
import { useTabBarClearance } from '@/ui/tabBar';
import { Body, Label, Meta, Mono } from '@/ui/Text';

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
 * O accent desta tela e o bloco do treino de hoje no volume — o unico elemento
 * colorido, e so em dia de treino. Os graficos de evolucao, os recordes e os
 * grupos ficam em cinza e branco: destaque demais dilui o proprio destaque. O
 * seletor segmentado acima do painel e sem cor por isso.
 *
 * Todos os graficos tem a mesma anatomia (base, regua, escala, datas nas
 * pontas — ver `StackedBars` e `DotLine`), para a tela ler como um instrumento
 * so e nao como uma colecao de widgets.
 *
 * A distancia dos ultimos 7 dias veio da home, que passou a ter um trabalho so
 * (comecar o treino de hoje).
 */
export function StatsPanel() {
  const clearance = useTabBarClearance();
  const { width } = useWindowDimensions();

  const router = useRouter();
  // O periodo em leitura no grafico de peso (ver `useScrub`); null e o padrao,
  // a pesagem mais recente. Cada card com grafico guarda a sua.
  const [weightSelected, setWeightSelected] = useState<number | null>(null);
  const { data, error, reload } = useQuery(
    useCallback(async () => {
      const now = new Date();
      const todayKey = toDateKey(now);
      const weekKeys = new Set(lastNDays(now, 7));
      const since = addWeeks(weekStartKey(now), -(WEEKS - 1));
      const [volumes, records, logs, distances, groups, candidates] = await Promise.all([
        volumeByDate(since, todayKey),
        listExerciseRecords(),
        listBodyWeightLogs(WEEKS * 7),
        distanceByDate(since, todayKey),
        volumeByMuscleGroup(lastNDays(now, GROUP_DAYS)[0], todayKey),
        progressCandidates(since),
      ]);
      // Arredonda a uma casa: somar 0,1 sete vezes rende 0,7000000000000001.
      let weekDistance = 0;
      for (const [key, km] of distances) if (weekKeys.has(key)) weekDistance += km;
      weekDistance = Math.round(weekDistance * 10) / 10;
      // Quem nao corre nao precisa de um card dizendo "0 km" toda semana: ele so
      // aparece se houve distancia em algum treino da janela.
      const runs = [...distances.values()].some((km) => km > 0);
      return {
        today: todayKey,
        weeks: volumeByWeek(volumes, now, WEEKS),
        records,
        weights: dailyBodyWeight(logs, since),
        weekDistance,
        runs,
        groups,
        candidates,
        since,
      };
    }, []),
  );

  if (error) return <LoadError error={error} onRetry={reload} />;
  // Nada ate a primeira consulta voltar, que no SQLite e questao de
  // milissegundos. Desenhar os cards com listas vazias enquanto isso piscava
  // os "Nenhum treino..." e um "0 kg" antes dos numeros de verdade. Nas
  // recargas o dado anterior fica na tela (ver `useQuery`).
  if (!data) return null;

  const chartWidth = width - spacing.xl * 4;
  const { weights, groups } = data;
  const latestWeight = weights[weights.length - 1];
  const weightIndex = inRange(weightSelected, weights.length);
  const shownWeight = weights[weightIndex ?? weights.length - 1];
  const heaviestGroup = groups[0]?.volume ?? 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
      showsVerticalScrollIndicator={false}
    >
      <VolumeCard weeks={data.weeks} today={data.today} width={chartWidth} />

      <ProgressCard candidates={data.candidates} since={data.since} width={chartWidth} />

      <Card>
        <Label>{`Volume por grupo · últimos ${GROUP_DAYS} dias`}</Label>
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
        {shownWeight ? (
          <View style={styles.chartHead}>
            <StatNumber
              value={formatWeight(shownWeight.weightKg)}
              unit="kg"
              size={fontSize.numberMd}
            />
            <Meta>
              {weights.length > 1 && weightIndex === null
                ? `${signedDelta(shownWeight.weightKg - weights[0].weightKg, formatWeight)} kg em ${WEEKS} sem`
                : shortDate(fromDateKey(shownWeight.date))}
            </Meta>
          </View>
        ) : null}
        {weights.length > 1 ? (
          <DotLine
            values={weights.map((point) => point.weightKg)}
            width={chartWidth}
            selected={weightIndex}
            onSelect={setWeightSelected}
            formatTick={formatWeight}
            start={shortDate(fromDateKey(weights[0].date))}
            end={shortDate(fromDateKey(latestWeight.date))}
            accessibilityLabel="Peso corporal"
            describe={(index) =>
              `${shortDate(fromDateKey(weights[index].date))}, ${formatWeight(weights[index].weightKg)} kg`
            }
          />
        ) : null}
        {weights.length === 0 ? (
          <Meta style={styles.empty}>{`Nenhuma pesagem nas últimas ${WEEKS} semanas.`}</Meta>
        ) : null}
      </Card>

      <RecordsCard
        records={data.records}
        onStart={async () => {
          const session = await getOrCreateSessionForDate(new Date());
          bumpData();
          router.push(`/session/${session.id}`);
        }}
      />

      {/* Km e kg nao somam: distancia tem card proprio, nunca um total misturado. */}
      {/* `resizes` tambem anima a posicao: quando os recordes abrem, este card
          desce junto, em vez de pular. */}
      {data.runs ? (
        <Card resizes>
          <Label>Distância</Label>
          <View style={styles.chartHead}>
            <StatNumber
              value={formatDistance(data.weekDistance)}
              unit="km"
              size={fontSize.numberMd}
            />
            <Meta>últimos 7 dias</Meta>
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

/** A leitura so vale enquanto aponta para um periodo que ainda existe. */
function inRange(index: number | null, length: number): number | null {
  return index !== null && index < length ? index : null;
}

/** "esta semana" ou "semana de 8 set". */
function weekName(weekStart: string, isCurrent: boolean): string {
  return isCurrent ? 'esta semana' : `semana de ${shortDate(fromDateKey(weekStart))}`;
}

/** Largura do nome do grupo e do numero, somadas, ao lado da barra de tracinhos. */
const GROUP_NAME_WIDTH = 72;
const GROUP_VALUE_WIDTH = 64;
const GROUP_LABELS_WIDTH = GROUP_NAME_WIDTH + GROUP_VALUE_WIDTH + spacing.sm * 2;
/** Cabe "167,5" e "2010" em mono com folga. */
const RECORD_COLUMN_WIDTH = 60;
/**
 * O grafico do card de abertura e mais alto que os outros: e o numero e o
 * grafico que a tela existe para mostrar (§4, tamanho conforme a importancia).
 */
const HERO_CHART_HEIGHT = 120;

/**
 * O volume das ultimas semanas, com os treinos dentro — o card que abre o
 * painel.
 *
 * Uma coluna por semana, um bloco por treino (ver `StackedBars`). Antes eram
 * dois graficos, por dia e por semana, e depois um so com seletor entre os
 * dois; os blocos dizem as duas coisas de uma vez, sem esconder nenhuma atras
 * de um toque: a coluna e a semana, o bloco e o dia de treino, e quantos blocos
 * ha e a frequencia.
 *
 * O numero grande e a media por semana, a mesma da linha tracejada. Mostrar a
 * semana atual abria o painel num "0 kg" gigante sempre que ela ainda nao tinha
 * treino. A semana atual, e qualquer outra, fica a um toque: tocar numa coluna
 * poe o total dela no lugar da media (ver `useScrub`).
 */
function VolumeCard({
  weeks,
  today,
  width,
}: {
  weeks: readonly WeekVolume[];
  today: string;
  width: number;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  const totals = weeks.map((week) => week.volume);
  const average = closedWeeksAverage(totals);
  const index = inRange(selected, weeks.length);
  const name = (at: number) => weekName(weeks[at].weekStart, at === weeks.length - 1);
  const readout = volumeReadout(weeks, average, index, name);

  // O treino de hoje, se houver, e o unico bloco no accent: ele esta sempre na
  // ultima coluna, e e sempre o ultimo bloco dela.
  const current = weeks.length - 1;
  const todayBlock = weeks[current]?.workouts.findIndex((workout) => workout.date === today) ?? -1;

  return (
    <Card>
      <Label>Volume</Label>

      <View style={styles.chartHead}>
        <StatNumber value={formatVolume(readout.value)} unit="kg" size={fontSize.numberLg} />
        <Meta>{readout.meta}</Meta>
      </View>

      <StackedBars
        columns={weeks.map((week) => week.workouts.map((workout) => workout.volume))}
        width={width}
        height={HERO_CHART_HEIGHT}
        selected={index}
        onSelect={setSelected}
        accent={todayBlock >= 0 ? { column: current, block: todayBlock } : null}
        reference={average ?? undefined}
        referenceLabel="média"
        major={(at) => startsMonth(weeks[at].weekStart)}
        start={weeks[0] && shortDate(fromDateKey(weeks[0].weekStart))}
        end="esta semana"
        accessibilityLabel="Volume por semana"
        describe={(at) =>
          `${name(at)}, ${formatVolume(totals[at])} kg, ${workoutCount(weeks[at].workouts.length)}`
        }
      />

      {/* Uma linha so, porque a leitura nao e obvia na primeira vez: sem ela, os
          blocos podiam passar por series, ou por exercicios. */}
      <Meta style={styles.legend}>cada bloco é um treino</Meta>
    </Card>
  );
}

/**
 * O que o cabecalho do volume mostra: a semana em leitura, se houver; senao a
 * media; e, sem semana fechada para fazer media (conta nova), a atual.
 */
function volumeReadout(
  weeks: readonly WeekVolume[],
  average: number | null,
  index: number | null,
  name: (at: number) => string,
): { value: number; meta: string } {
  if (index !== null) {
    const week = weeks[index];
    return { value: week.volume, meta: `${name(index)} · ${workoutCount(week.workouts.length)}` };
  }
  if (average !== null) return { value: average, meta: 'média por semana' };
  const current = weeks[weeks.length - 1];
  if (!current) return { value: 0, meta: '' };
  return {
    value: current.volume,
    meta: `${name(weeks.length - 1)} · ${workoutCount(current.workouts.length)}`,
  };
}

/** "1 treino", "4 treinos", "nenhum treino". */
function workoutCount(count: number): string {
  if (count === 0) return 'nenhum treino';
  return count === 1 ? '1 treino' : `${count} treinos`;
}

/** A semana que contem o dia 1 de um mes: ganha o tracinho longo da regua. */
function startsMonth(weekStart: string): boolean {
  const start = fromDateKey(weekStart);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return start.getDate() === 1 || end.getMonth() !== start.getMonth();
}

/** Quantos recordes o card mostra fechado. */
const RECORDS_COLLAPSED = 5;

/**
 * O recorde de cada movimento: a maior carga e a melhor serie (repeticoes x
 * carga), em colunas nomeadas — dois numeros lado a lado sem nome eram uma
 * adivinhacao.
 *
 * Fechado, mostra os cinco mais pesados; o resto abre ali mesmo. Antes eram dez
 * fixos, cortados sem aviso: longo demais para ler de relance (a tela virava
 * planilha, §4) e curto demais para achar o decimo primeiro.
 */
function RecordsCard({
  records,
  onStart,
}: {
  records: readonly ExerciseRecord[];
  onStart: () => void;
}) {
  const [open, setOpen] = useState(false);
  const listMotion = useListMotion();
  const extra = records.length - RECORDS_COLLAPSED;

  return (
    <Card resizes>
      <View style={styles.recordsHead}>
        <Label style={styles.recordsTitle}>Recordes por movimento</Label>
        {records.length > 0 ? (
          <>
            <Label style={styles.recordColumn}>carga</Label>
            <Label style={styles.recordColumn}>série</Label>
          </>
        ) : null}
      </View>

      {records.slice(0, RECORDS_COLLAPSED).map((record) => (
        <RecordRow key={record.exerciseId} record={record} />
      ))}
      {open ? (
        <Animated.View {...listMotion}>
          {records.slice(RECORDS_COLLAPSED).map((record) => (
            <RecordRow key={record.exerciseId} record={record} />
          ))}
        </Animated.View>
      ) : null}

      {extra > 0 ? (
        <PressableSurface
          feedback="solid"
          onPress={() => setOpen((value) => !value)}
          style={[styles.row, styles.moreRow]}
          accessibilityLabel={open ? 'Mostrar menos recordes' : 'Mostrar todos os recordes'}
        >
          <Meta>{open ? 'Mostrar menos' : `Todos os ${records.length} movimentos`}</Meta>
          {/* A mesma seta do resto do app, girada: para baixo abre, para cima fecha. */}
          <View style={open ? styles.chevronUp : styles.chevronDown}>
            <ChevronRightIcon size={14} color={colors.textSecondary} />
          </View>
        </PressableSurface>
      ) : null}

      {records.length === 0 ? (
        <EmptyState
          title="Nenhum recorde ainda"
          message="Seus recordes aparecem aqui depois do primeiro treino."
          action={{ label: 'Começar treino', onPress: onStart }}
        />
      ) : null}
    </Card>
  );
}

function RecordRow({ record }: { record: ExerciseRecord }) {
  return (
    <View style={styles.row}>
      <Body numberOfLines={1} style={styles.rowName}>
        {record.exerciseName}
      </Body>
      <Mono style={styles.recordColumn}>{formatWeight(record.heaviestKg)}</Mono>
      <Mono style={[styles.recordColumn, styles.recordSecondary]}>
        {formatVolume(record.bestVolume)}
      </Mono>
    </View>
  );
}

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
  const [pointSelected, setPointSelected] = useState<number | null>(null);
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
  const pointIndex = inRange(pointSelected, points.length);
  const shown = points[pointIndex ?? points.length - 1];

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
                onPress={() => {
                  setChosen(candidate.exerciseId);
                  setPointSelected(null);
                }}
              />
            ))}
          </ScrollView>

          {first && last && shown ? (
            <>
              <View style={styles.chartHead}>
                <StatNumber
                  value={formatWeight(shown.weightKg)}
                  unit="kg"
                  size={fontSize.numberMd}
                />
                <Meta>
                  {pointIndex === null
                    ? `${signedDelta(last.weightKg - first.weightKg, formatWeight)} kg em ${WEEKS} sem · ${points.length} treinos`
                    : shortDate(fromDateKey(shown.date))}
                </Meta>
              </View>
              <DotLine
                values={points.map((point) => point.weightKg)}
                width={width}
                selected={pointIndex}
                onSelect={setPointSelected}
                formatTick={formatWeight}
                start={shortDate(fromDateKey(first.date))}
                end={shortDate(fromDateKey(last.date))}
                accessibilityLabel="Progressão de carga"
                describe={(index) =>
                  `${shortDate(fromDateKey(points[index].date))}, ${formatWeight(points[index].weightKg)} kg`
                }
              />
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
  legend: {
    marginTop: spacing.md,
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
  recordsHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  recordsTitle: {
    flex: 1,
  },
  // Largura fixa para as colunas alinharem de uma linha para a outra.
  recordColumn: {
    width: RECORD_COLUMN_WIDTH,
    textAlign: 'right',
  },
  recordSecondary: {
    color: colors.textSecondary,
  },
  moreRow: {
    alignItems: 'center',
  },
  chevronDown: {
    transform: [{ rotate: '90deg' }],
  },
  chevronUp: {
    transform: [{ rotate: '-90deg' }],
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

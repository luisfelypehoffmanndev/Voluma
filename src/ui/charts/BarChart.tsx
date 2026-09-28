import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { chart, colors, fontSize, people } from '@/theme/tokens';
import { Mono } from '@/ui/Text';

import { niceScale, type MonthTick } from './axis';
import { MonthAxis, SCALE_WIDTH, ScaleLabels } from './Frame';
import { GlowCanvas } from './GlowCanvas';
import { barIndexAt } from './scale';
import { barLayout, barShapes, hLineShapes, type GlowShape } from './shapes';
import { useScrub } from './useScrub';

/**
 * Barras de uma cor so, crescendo do zero, uma por periodo — o volume por
 * semana, e os dias por semana de cada pessoa na aba Amigos.
 *
 * A forma mais facil de ler uma quantidade: a altura e o numero. A escala
 * fica do lado, com numeros redondos; os meses embaixo; a media, se houver,
 * tracejada. O periodo atual (`highlight`) tem glow forte — e o "agora".
 *
 * Com `onSelect`, o dedo le as barras (ver `useScrub`): a lida acende, as
 * outras apagam, e a data dela aparece no eixo, embaixo.
 */
type Props = {
  values: readonly number[];
  /** Largura total, com a coluna da escala. */
  width: number;
  /** Altura da area das barras, sem o eixo dos meses. */
  height?: number;
  color?: string;
  /** Topo fixo da escala, para duas fileiras lidas uma contra a outra. */
  max?: number;
  /** As linhas de grade; sem isso, ate 3 valores redondos. */
  ticks?: readonly number[];
  formatTick?: (value: number) => string;
  /** Um valor de referencia (a media), em linha tracejada. */
  reference?: number | null;
  referenceLabel?: string;
  /** O periodo atual: glow forte. */
  highlight?: number | null;
  /** Um numero em cima de uma barra — so uma, a que a historia pede. */
  topLabel?: { index: number; text: string } | null;
  months?: readonly MonthTick[];
  selected?: number | null;
  onSelect?: (index: number | null) => void;
  describe?: (index: number) => string;
  /** O rotulo do periodo lido, no eixo embaixo. */
  cursorLabel?: (index: number) => string;
  accessibilityLabel?: string;
};

const SCALE_LINES = 3;
/** Espaco em cima das barras para o `topLabel`. */
const TOP_LABEL = 18;

export function BarChart({
  values,
  width,
  height = 140,
  color = people.self,
  max,
  ticks,
  formatTick = String,
  reference = null,
  referenceLabel,
  highlight = null,
  topLabel = null,
  months = [],
  selected = null,
  onSelect,
  describe = () => '',
  cursorLabel,
  accessibilityLabel,
}: Props) {
  const plotWidth = Math.max(0, width - SCALE_WIDTH);
  const count = values.length;

  const scale = useMemo(() => {
    if (max !== undefined) return { max, ticks: ticks ?? [max] };
    const peak = Math.max(0, ...values, reference ?? 0);
    const nice = niceScale(peak, SCALE_LINES);
    return { max: nice.max, ticks: ticks ?? nice.ticks };
  }, [max, ticks, values, reference]);

  const y = (value: number) => valueY(value, scale.max, height);
  const referenceY = reference !== null && reference > 0 ? y(reference) : null;

  const shapes = useMemo<GlowShape[]>(
    () => [
      ...hLineShapes({
        ys: scale.ticks.map((value) => valueY(value, scale.max, height)),
        width: plotWidth,
        color: chart.grid,
      }),
      ...hLineShapes({ ys: [height - 0.5], width: plotWidth, color: chart.baseline }),
      ...(referenceY !== null
        ? hLineShapes({
            ys: [referenceY],
            width: plotWidth,
            color: colors.textSecondary,
            dash: [3, 3],
          })
        : []),
      ...barShapes({
        values,
        max: scale.max,
        width: plotWidth,
        height,
        color,
        highlight,
        selected,
      }),
    ],
    [scale, plotWidth, height, referenceY, values, color, highlight, selected],
  );

  const scrub = useScrub({
    count,
    indexAt: (x) => barIndexAt(x, plotWidth, count),
    selected,
    onSelect,
    describe,
  });

  const { center } = barLayout(count, plotWidth);
  const scaleTicks = [
    // A media primeiro: se encostar num numero da grade, e ela que fica.
    ...(referenceY !== null && referenceLabel ? [{ y: referenceY, label: referenceLabel }] : []),
    ...scale.ticks.map((value) => ({ y: y(value), label: formatTick(value) })),
  ];

  return (
    <View style={{ width }}>
      {topLabel ? <View style={{ height: TOP_LABEL }} /> : null}
      <View style={styles.row}>
        <View {...scrub} accessibilityLabel={accessibilityLabel} style={{ width: plotWidth, height }}>
          <GlowCanvas shapes={shapes} width={plotWidth} height={height} />
          {topLabel && selected === null ? (
            <Mono
              numberOfLines={1}
              style={[
                styles.topLabel,
                {
                  left: center(topLabel.index) - TOP_LABEL_WIDTH / 2,
                  // Logo acima da barra; a barra cheia empurra o numero para o
                  // espaco reservado em cima do grafico.
                  top: y(values[topLabel.index] ?? 0) - TOP_LABEL,
                },
              ]}
            >
              {topLabel.text}
            </Mono>
          ) : null}
        </View>
        <ScaleLabels ticks={scaleTicks} height={height} />
      </View>

      {months.length > 0 || cursorLabel ? (
        <MonthAxis
          width={plotWidth}
          months={months.map((month) => ({ x: center(month.index), label: month.label }))}
          cursor={
            selected !== null && cursorLabel
              ? { x: center(selected), label: cursorLabel(selected) }
              : null
          }
        />
      ) : null}
    </View>
  );
}

const TOP_LABEL_WIDTH = 32;

/** O `y` de tela de um valor, numa escala que nasce do zero. */
function valueY(value: number, max: number, height: number): number {
  return height - (value / max) * height;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  topLabel: {
    position: 'absolute',
    width: TOP_LABEL_WIDTH,
    textAlign: 'center',
    fontSize: fontSize.label,
    lineHeight: TOP_LABEL,
    color: colors.textPrimary,
  },
});

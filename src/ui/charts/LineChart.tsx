import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { chart, people } from '@/theme/tokens';

import type { MonthTick } from './axis';
import { MonthAxis, SCALE_WIDTH, ScaleLabels } from './Frame';
import { GlowCanvas } from './GlowCanvas';
import { lineDomain, niceTicks, plotPoints, pointIndexAt, valueY } from './scale';
import { hLineShapes, lineShapes, type GlowShape } from './shapes';
import { useScrub } from './useScrub';

/**
 * A evolucao de uma serie — a carga de um exercicio, o peso corporal.
 *
 * Linha de 2dp com glow na cor da pessoa e uma area em degrade embaixo, que da
 * corpo a curva sem virar bloco. Um ponto so: o ultimo (o "agora" do numero
 * grande do card) ou o lido pelo dedo, com um fio vertical ate ele.
 *
 * O eixo nao comeca no zero (ver `lineDomain`), e e por isso que a escala do
 * lado importa: sem ela, um degrau de 2,5 kg e um de 25 kg teriam a mesma
 * altura. As linhas de grade caem em valores redondos, pelo mesmo `valueY` dos
 * pontos.
 *
 * Sem animacao de entrada (§10): o grafico aparece pronto.
 */
type Props = {
  values: readonly number[];
  /** Largura total, com a coluna da escala. */
  width: number;
  height?: number;
  color?: string;
  formatTick?: (value: number) => string;
  months?: readonly MonthTick[];
  selected?: number | null;
  onSelect?: (index: number | null) => void;
  describe?: (index: number) => string;
  /** O rotulo do ponto lido, no eixo embaixo. */
  cursorLabel?: (index: number) => string;
  accessibilityLabel?: string;
};

/** Da borda ao centro dos pontos das pontas: o ponto com anel tem 12dp. */
const INSET = 8;
/** No maximo tres linhas: mais que isso e pauta, nao escala. */
const SCALE_LINES = 3;

export function LineChart({
  values,
  width,
  height = 140,
  color = people.self,
  formatTick = String,
  months = [],
  selected = null,
  onSelect,
  describe = () => '',
  cursorLabel,
  accessibilityLabel,
}: Props) {
  const plotWidth = Math.max(0, width - SCALE_WIDTH);
  const points = useMemo(
    () => plotPoints(values, plotWidth, height, INSET),
    [values, plotWidth, height],
  );
  const domain = useMemo(() => lineDomain(values), [values]);

  // Serie constante nao tem intervalo para repartir: a unica linha e a do
  // proprio valor, passando pelos pontos.
  const ticks = useMemo(() => {
    if (!domain) return [];
    const tickValues =
      domain.high > domain.low ? niceTicks(domain.low, domain.high, SCALE_LINES) : [domain.low];
    return tickValues.map((value) => ({ value, y: valueY(value, domain, height, INSET) }));
  }, [domain, height]);

  const shapes = useMemo<GlowShape[]>(() => {
    const cursor = selected !== null ? points[selected] : null;
    return [
      ...hLineShapes({ ys: ticks.map((tick) => tick.y), width: plotWidth, color: chart.grid }),
      ...(cursor
        ? [
            {
              kind: 'path' as const,
              d: `M${cursor.x},0 V${height}`,
              color: chart.cursor,
              style: 'stroke' as const,
              strokeWidth: 1,
              glow: 'none' as const,
            },
          ]
        : []),
      ...lineShapes({
        points,
        height,
        color,
        area: chart.area,
        fade: chart.fade,
        ring: chart.ring,
        lit: selected,
      }),
    ];
  }, [ticks, plotWidth, height, points, color, selected]);

  const scrub = useScrub({
    count: points.length,
    indexAt: (x) => pointIndexAt(x, plotWidth, points.length, INSET),
    selected,
    onSelect,
    describe,
  });
  if (points.length === 0) return null;

  return (
    <View style={{ width }}>
      <View style={styles.row}>
        <View {...scrub} accessibilityLabel={accessibilityLabel} style={{ width: plotWidth, height }}>
          <GlowCanvas shapes={shapes} width={plotWidth} height={height} />
        </View>
        <ScaleLabels
          ticks={ticks.map((tick) => ({ y: tick.y, label: formatTick(tick.value) }))}
          height={height}
        />
      </View>

      <MonthAxis
        width={plotWidth}
        months={months.map((month) => ({ x: points[month.index]?.x ?? 0, label: month.label }))}
        cursor={
          selected !== null && cursorLabel && points[selected]
            ? { x: points[selected].x, label: cursorLabel(selected) }
            : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
});

import { View } from 'react-native';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';

import { chart, colors } from '@/theme/tokens';

import { ChartFoot, SCALE_WIDTH, ScaleLabels } from './Frame';
import { lineDomain, niceTicks, plotPoints, pointIndexAt, valueY } from './scale';
import { useScrub } from './useScrub';

/**
 * Pontos ligados por uma linha fina: a progressao de uma carga ou do peso.
 *
 * O ponto e a mesma celula do dot-matrix (quadrado de quina arredondada) e nao
 * um circulo, pela regra de uma forma so do brief (§6). Tudo em cinza: o accent
 * da aba e a marca do dia no grafico de volume. O ponto em leitura e o unico
 * cheio — por padrao o ultimo, o "agora" que o numero do cabecalho repete.
 *
 * O eixo nao comeca no zero (ver `lineDomain`), e e por isso que este grafico
 * precisa de escala mais que o de barras: sem ela, um degrau de 2,5 kg e um de
 * 25 kg teriam a mesma altura. As linhas de grade caem em valores redondos,
 * pelo mesmo `valueY` dos pontos — o ponto de 25 kg senta na linha dos 25.
 *
 * Com `onSelect`, o dedo percorre os pontos (ver `useScrub`) e um fio vertical
 * marca o ponto lido, como o cursor de um osciloscopio. O fio so aparece
 * quando alguem esta lendo: no padrao, o ponto cheio ja diz qual e.
 *
 * Sem animacao de entrada (§10): o grafico aparece pronto.
 */
const SQUARE = 6;
const SQUARE_RADIUS = 1.5;
/** Espaco da borda ate o centro dos pontos das pontas, para nao serem cortados. */
const INSET = SQUARE;
/** No maximo tres linhas: mais que isso e pauta, nao escala. */
const SCALE_LINES = 3;

type Props = {
  values: readonly number[];
  /** Largura total, com a coluna da escala. */
  width: number;
  height?: number;
  /** Ponto em leitura pelo dedo; sem leitura, o ultimo. */
  selected?: number | null;
  onSelect?: (index: number | null) => void;
  describe?: (index: number) => string;
  /** Como a escala escreve um valor. */
  formatTick?: (value: number) => string;
  /** As datas das pontas, embaixo do primeiro e do ultimo ponto. */
  start?: string;
  end?: string;
  accessibilityLabel?: string;
};

export function DotLine({
  values,
  width,
  height = 88,
  selected = null,
  onSelect,
  describe = () => '',
  formatTick = String,
  start,
  end,
  accessibilityLabel,
}: Props) {
  const plotWidth = Math.max(0, width - SCALE_WIDTH);
  const points = plotPoints(values, plotWidth, height, INSET);
  const domain = lineDomain(values);
  const scrub = useScrub({
    count: points.length,
    indexAt: (x) => pointIndexAt(x, plotWidth, points.length, INSET),
    selected,
    onSelect,
    describe,
  });
  if (points.length === 0 || !domain) return null;

  // Serie constante nao tem intervalo para repartir: a unica linha e a do
  // proprio valor, passando pelos pontos.
  const tickValues =
    domain.high > domain.low ? niceTicks(domain.low, domain.high, SCALE_LINES) : [domain.low];
  const ticks = tickValues.map((value) => ({ value, y: valueY(value, domain, height, INSET) }));

  const lit = selected ?? points.length - 1;
  const cursor = selected !== null ? points[selected] : null;

  return (
    <View style={{ width }}>
      <View style={{ flexDirection: 'row' }}>
        <View
          {...scrub}
          accessibilityLabel={accessibilityLabel}
          style={{ width: plotWidth, height }}
        >
          <Svg width={plotWidth} height={height} pointerEvents="none">
            {ticks.map((tick) => (
              <Line
                key={tick.value}
                x1={0}
                x2={plotWidth}
                y1={tick.y}
                y2={tick.y}
                stroke={chart.grid}
                strokeWidth={1}
              />
            ))}
            {cursor ? (
              <Line
                x1={cursor.x}
                x2={cursor.x}
                y1={0}
                y2={height}
                stroke={chart.cursor}
                strokeWidth={1}
              />
            ) : null}
            {points.length > 1 ? (
              <Polyline
                points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="none"
                stroke={chart.line}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {points.map((point, index) => (
              <Rect
                key={index}
                x={point.x - SQUARE / 2}
                y={point.y - SQUARE / 2}
                width={SQUARE}
                height={SQUARE}
                rx={SQUARE_RADIUS}
                fill={index === lit ? colors.dotFilled : colors.textSecondary}
              />
            ))}
          </Svg>
        </View>
        <ScaleLabels
          ticks={ticks.map((tick) => ({ y: tick.y, label: formatTick(tick.value) }))}
          height={height}
        />
      </View>

      <ChartFoot start={start} end={end} width={plotWidth} />
    </View>
  );
}

import { View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { chart, colors } from '@/theme/tokens';

import { ChartFoot, SCALE_WIDTH, ScaleLabels } from './Frame';
import { barIndexAt, stackBlocks } from './scale';
import { useScrub } from './useScrub';

/**
 * Colunas empilhadas: uma coluna por periodo, um bloco por parcela — no volume,
 * uma coluna por semana e um bloco por treino.
 *
 * A mesma coluna responde a tres perguntas sem seletor nenhum: a altura e o
 * volume da semana, cada bloco e um treino (o de baixo e o primeiro), e a
 * contagem de blocos e a frequencia. Le como um equalizador, que e a imagem do
 * §1 do brief.
 *
 * A anatomia e a mesma dos outros graficos:
 *
 * - Os blocos separam-se por uma fresta de 2dp, a cor do proprio card
 *   atravessando, e nao por contorno: contorno seria tinta que nao e dado. As
 *   frestas saem de dentro da coluna (ver `stackBlocks`), que mede o total.
 * - Cada bloco tem as quinas levemente arredondadas, como a celula do
 *   dot-matrix (§6): um bloco e uma unidade, um treino, e nao um pedaco de barra.
 * - Embaixo da base, um tracinho por periodo; os de `major` (comeco de mes) sao
 *   mais longos, e dao a escala do tempo sem escrever datas. E o tracinho que
 *   marca uma semana sem treino.
 * - Nao ha grade: as colunas nascem do zero, entao a altura ja compara uma com
 *   a outra. A unica linha horizontal e a referencia (`reference`, a media),
 *   tracejada e com nome na coluna da escala.
 *
 * Com `onSelect`, o dedo le as colunas (ver `useScrub`): a coluna em leitura
 * acende em branco, e o cabecalho do card mostra o valor dela.
 */
type Props = {
  /** Uma coluna por periodo; em cada uma, os blocos de baixo para cima. */
  columns: readonly (readonly number[])[];
  /** Largura total, com a coluna da escala. */
  width: number;
  /** Altura da area das colunas, sem a regua e as datas. */
  height?: number;
  /** Coluna em leitura pelo dedo. Acende em branco. */
  selected?: number | null;
  onSelect?: (index: number | null) => void;
  /** O que o leitor de tela anuncia para cada coluna. */
  describe?: (index: number) => string;
  /** O unico bloco no accent — o treino de hoje. */
  accent?: { column: number; block: number } | null;
  /** Um valor de referencia, em linha tracejada atravessando as colunas. */
  reference?: number;
  /** O nome da referencia, na coluna da escala, na altura da linha. */
  referenceLabel?: string;
  /** Os periodos que ganham o tracinho longo na regua. */
  major?: (index: number) => boolean;
  /** As datas das pontas, embaixo da primeira e da ultima coluna. */
  start?: string;
  end?: string;
  accessibilityLabel?: string;
};

/** Quanto da fatia de cada periodo a coluna ocupa; o resto e respiro. */
const COLUMN_SHARE = 0.55;
/** A fresta entre dois blocos, e o menor bloco possivel. */
const GAP = 2;
const MIN_BLOCK = 2;
const BLOCK_RADIUS = 2;
/** Tracinhos da regua: o comum e o longo. */
const TICK = 3;
const TICK_MAJOR = 7;
const RULER_HEIGHT = TICK_MAJOR + 1;

export function StackedBars({
  columns,
  width,
  height = 96,
  selected = null,
  onSelect,
  describe = () => '',
  accent = null,
  reference,
  referenceLabel,
  major = () => false,
  start,
  end,
  accessibilityLabel,
}: Props) {
  const plotWidth = Math.max(0, width - SCALE_WIDTH);
  const count = columns.length;
  const totals = columns.map((blocks) => blocks.reduce((sum, value) => sum + value, 0));
  const peak = Math.max(1, ...totals, reference ?? 0);
  const columnWidth = Math.max(2, Math.floor((plotWidth / Math.max(1, count)) * COLUMN_SHARE));
  // A primeira coluna encosta na borda esquerda e a ultima na direita: as datas
  // das pontas alinham com elas, e nao com um vao.
  const pitch = count > 1 ? (plotWidth - columnWidth) / (count - 1) : 0;
  const columnX = (index: number) => (count > 1 ? index * pitch : (plotWidth - columnWidth) / 2);

  const scrub = useScrub({
    count,
    indexAt: (x) => barIndexAt(x, plotWidth, count),
    selected,
    onSelect,
    describe,
  });

  const blockColor = (column: number, block: number) =>
    accent?.column === column && accent.block === block
      ? colors.accent
      : column === selected
        ? colors.textPrimary
        : chart.bar;

  const referenceY =
    reference !== undefined && reference > 0
      ? inside(height - (reference / peak) * height, height)
      : null;

  return (
    <View style={{ width }}>
      <View style={{ flexDirection: 'row' }}>
        <View
          {...scrub}
          accessibilityLabel={accessibilityLabel}
          style={{ width: plotWidth, height }}
        >
          <Svg width={plotWidth} height={height} pointerEvents="none">
            {columns.map((blocks, column) =>
              stackBlocks(blocks, (totals[column] / peak) * height, GAP, MIN_BLOCK).map(
                (block, index) => (
                  <Rect
                    key={`${column}-${index}`}
                    x={columnX(column)}
                    y={height - block.bottom - block.height}
                    width={columnWidth}
                    height={block.height}
                    rx={Math.min(BLOCK_RADIUS, block.height / 2)}
                    fill={blockColor(column, index)}
                  />
                ),
              ),
            )}
            {referenceY !== null ? (
              <Line
                x1={0}
                x2={plotWidth}
                y1={referenceY}
                y2={referenceY}
                stroke={colors.textSecondary}
                strokeWidth={1}
                // O mesmo passo dos tracinhos da `DashedBar`: 2 cheio, 3 vazio.
                strokeDasharray="2 3"
              />
            ) : null}
          </Svg>
        </View>
        <ScaleLabels
          ticks={
            referenceY !== null && referenceLabel ? [{ y: referenceY, label: referenceLabel }] : []
          }
          height={height}
        />
      </View>

      <Svg width={plotWidth} height={RULER_HEIGHT} pointerEvents="none">
        <Line x1={0} x2={plotWidth} y1={0.5} y2={0.5} stroke={chart.baseline} strokeWidth={1} />
        {columns.map((_, index) => {
          const x = columnX(index) + columnWidth / 2;
          const lit = index === selected;
          return (
            <Line
              key={index}
              x1={x}
              x2={x}
              y1={1}
              // A coluna lida ganha o tracinho longo e aceso, como um ponteiro.
              y2={1 + (major(index) || lit ? TICK_MAJOR : TICK)}
              stroke={lit ? colors.textPrimary : chart.tick}
              strokeWidth={1}
            />
          );
        })}
      </Svg>

      <ChartFoot start={start} end={end} width={plotWidth} />
    </View>
  );
}

/**
 * Uma linha de 1dp se espalha meio dp para cada lado do seu `y`: presa a meio
 * dp das bordas, a do topo nao sai cortada pela metade.
 */
function inside(y: number, height: number): number {
  return Math.min(height - 0.5, Math.max(0.5, y));
}

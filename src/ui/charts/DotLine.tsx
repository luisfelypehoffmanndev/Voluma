import Svg, { Polyline, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

import { plotPoints } from './scale';

/**
 * Pontos ligados por uma linha fina: a progressao de uma carga ou do peso.
 *
 * O ponto e a mesma celula do dot-matrix (quadrado de 4px, quina de 1px) e nao
 * um circulo, pela regra de uma forma so do brief (§6). Tudo em cinza: o accent
 * da aba ja e a barra de hoje do volume por dia. O ultimo ponto e o unico
 * cheio, porque e o "agora" que o numero do cabecalho repete.
 *
 * Sem animacao de entrada (§10): o grafico aparece pronto.
 */
const SQUARE = 4;
const SQUARE_RADIUS = 1;
/** Espaco da borda ate o centro dos pontos das pontas, para nao serem cortados. */
const INSET = SQUARE;

type Props = {
  values: readonly number[];
  width: number;
  height?: number;
};

export function DotLine({ values, width, height = 72 }: Props) {
  const points = plotPoints(values, width, height, INSET);
  if (points.length === 0) return null;

  return (
    <Svg width={width} height={height}>
      {points.length > 1 ? (
        <Polyline
          points={points.map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none"
          stroke={colors.dotEmpty}
          strokeWidth={1}
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
          fill={index === points.length - 1 ? colors.dotFilled : colors.textSecondary}
        />
      ))}
    </Svg>
  );
}

import { View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { chart } from '@/theme/tokens';

type Props = {
  values: readonly number[];
  /** O topo da escala, o mesmo em toda fileira que for comparada com esta. */
  max: number;
  width: number;
  height: number;
  color: string;
  accessibilityLabel: string;
};

/** Respiro entre barras: sem ele, semanas vizinhas viram um bloco so. */
const GAP = 2;
const RADIUS = 1.5;

/**
 * Uma fileira de barras finas, uma por periodo — o "small multiple" da aba
 * Amigos, uma fileira por pessoa.
 *
 * A escala e fixa (`max`) e nao o maior valor da propria fileira: as fileiras
 * sao lidas uma contra a outra, e 2 dias tem que ter a mesma altura em qualquer
 * uma delas. Sem regua nem datas: repetidas por pessoa, virariam ruido — o
 * card diz o periodo uma vez so.
 *
 * Zero nao desenha barra; a linha de base fica, para a semana vazia continuar
 * ocupando o lugar dela.
 */
export function MiniBars({ values, max, width, height, color, accessibilityLabel }: Props) {
  const count = values.length;
  const barWidth = count > 0 ? Math.max(1, (width - GAP * (count - 1)) / count) : 0;

  return (
    <View accessible accessibilityLabel={accessibilityLabel}>
      <Svg width={width} height={height}>
        {values.map((value, index) => {
          if (value <= 0) return null;
          const barHeight = (Math.min(value, max) / max) * height;
          return (
            <Rect
              key={index}
              testID="mini-bar"
              x={index * (barWidth + GAP)}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              rx={RADIUS}
              fill={color}
            />
          );
        })}
        <Line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke={chart.baseline} strokeWidth={1} />
      </Svg>
    </View>
  );
}

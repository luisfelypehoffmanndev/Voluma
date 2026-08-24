import { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

type Props = {
  /** 0 a 1. */
  progress: number;
  width: number;
  height?: number;
  /** Cor dos tracinhos ja percorridos. */
  fill?: string;
  /** Cor dos tracinhos restantes. */
  track?: string;
  style?: StyleProp<ViewStyle>;
};

const TICK_WIDTH = 2;
const TICK_GAP = 3;

/**
 * Barra de progresso em tracinhos, nao solida — o padrao do grafico de sono das
 * referencias. O trecho percorrido vira um traco continuo mais grosso; o
 * restante fica pontilhado.
 */
export function DashedBar({
  progress,
  width,
  height = 8,
  fill = colors.textPrimary,
  track = colors.dotEmpty,
  style,
}: Props) {
  const ticks = useMemo(() => {
    const step = TICK_WIDTH + TICK_GAP;
    const count = Math.max(1, Math.floor(width / step));
    const clamped = Math.min(1, Math.max(0, progress));
    const filled = Math.round(count * clamped);

    return Array.from({ length: count }, (_, index) => ({
      x: index * step,
      done: index < filled,
    }));
  }, [progress, width]);

  return (
    <View style={style}>
      <Svg width={width} height={height}>
        {ticks.map((tick) => (
          <Rect
            key={tick.x}
            x={tick.x}
            y={tick.done ? 0 : height / 2 - 1}
            width={TICK_WIDTH}
            height={tick.done ? height : 2}
            rx={1}
            fill={tick.done ? fill : track}
          />
        ))}
      </Svg>
    </View>
  );
}

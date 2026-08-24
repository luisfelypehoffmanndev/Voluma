import Svg, { Circle } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';

import { colors, fontSize, fonts } from '@/theme/tokens';
import { Mono } from './Text';

type Props = {
  /** 0 a 1. */
  progress: number;
  /** Numero dentro do anel — a contagem de treinos ou series. */
  value: string;
  size?: number;
};

/**
 * Anel com um numero dentro, como os "1" e "2" dos cards de treino do mockup.
 * Traco fino e monocromatico: o anel indica progresso sem virar grafico
 * colorido.
 */
export function ProgressRing({ progress, value, size = 44 }: Props) {
  const stroke = 1.6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.dotEmpty}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.textPrimary}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference * clamped} ${circumference}`}
          // Comeca no topo, nao as 3 horas.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Mono style={styles.value}>{value}</Mono>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontFamily: fonts.monoLight,
    fontSize: fontSize.bodyLg,
  },
});

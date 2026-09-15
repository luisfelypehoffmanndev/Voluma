import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { accentGlow, colors, spacing } from '@/theme/tokens';
import { useStaged } from '@/ui/motion';

/**
 * A abertura do onboarding: o app "liga" como instrumento.
 *
 * E a unica entrada de cinema do app, e por isso a unica excecao ao §10 —
 * barras que crescem, campo de luz que acende, texto que surge em sequencia.
 * Acontece uma vez na vida do usuario; nas outras telas continua valendo tudo.
 * O que nao abre excecao: nada de mola ou overshoot (a curva e a mesma
 * `SETTLE`), e "reduzir movimento" mostra o estado final no primeiro quadro.
 */

/** O tempo de cada peca, em ms. Lidos juntos, contam a sequencia. */
export const IGNITION = {
  field: { delay: 150, duration: 1400 },
  bars: { delay: 450, stagger: 90, duration: 480 },
  wordmark: { delay: 1350, duration: 520 },
  tagline: { delay: 1750, duration: 420 },
  footer: { delay: 2150, duration: 420 },
} as const;

/**
 * As alturas do icone (Design/propostas-nome, pagina 4): uma semana de treino,
 * com a ultima barra — hoje — a mais alta.
 */
const BARS = [0.36, 0.56, 0.26, 0.7, 0.46, 0.8, 1] as const;
const BAR_WIDTH = 10;
const BARS_HEIGHT = 128;

/** Opacidade que vai de `from` a `to` depois de `delay`. */
export function Staged({
  delay,
  duration,
  from = 0,
  to = 1,
  style,
  pointerEvents,
  children,
}: {
  delay: number;
  duration: number;
  from?: number;
  to?: number;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'auto' | 'none' | 'box-none';
  children?: ReactNode;
}) {
  const staged = useStaged();
  const value = useSharedValue(from);

  useEffect(() => {
    const { delay: wait, config } = staged(delay, duration);
    value.value = wait > 0 ? withDelay(wait, withTiming(to, config)) : withTiming(to, config);
  }, [staged, delay, duration, to, value]);

  const animated = useAnimatedStyle(() => ({ opacity: value.value }));

  return (
    <Animated.View style={[style, animated]} pointerEvents={pointerEvents}>
      {children}
    </Animated.View>
  );
}

/**
 * O campo de luz acendendo: uma cortina da cor do fundo por cima do `Ambient`,
 * que some. O campo em si nao se move — so deixa de estar coberto.
 */
export function FieldCover() {
  return (
    <Staged
      delay={IGNITION.field.delay}
      duration={IGNITION.field.duration}
      from={1}
      to={0}
      pointerEvents="none"
      style={styles.cover}
    />
  );
}

/** O icone de sete barras se desenhando, da segunda ao dia de hoje. */
export function BarsMark() {
  return (
    <View style={styles.mark} accessibilityLabel="Sete barras, uma por dia da semana">
      <View style={styles.bars}>
        {BARS.map((height, index) => (
          <GrowBar
            key={index}
            height={height * BARS_HEIGHT}
            delay={IGNITION.bars.delay + index * IGNITION.bars.stagger}
            // Branco e cinza alternados; a ultima e o unico accent da tela.
            tone={index === BARS.length - 1 ? 'accent' : index % 2 === 0 ? 'strong' : 'soft'}
          />
        ))}
      </View>
      <View style={styles.baseline} />
    </View>
  );
}

function GrowBar({
  height,
  delay,
  tone,
}: {
  height: number;
  delay: number;
  tone: 'strong' | 'soft' | 'accent';
}) {
  const staged = useStaged();
  const grown = useSharedValue(0);

  useEffect(() => {
    const { delay: wait, config } = staged(delay, IGNITION.bars.duration);
    grown.value = wait > 0 ? withDelay(wait, withTiming(1, config)) : withTiming(1, config);
  }, [staged, delay, grown]);

  // Cresce pela altura, ancorada na base: e a barra do grafico sendo medida,
  // nao um elemento "estufando". Sem passar do ponto — `SETTLE` nao overshoota.
  const animated = useAnimatedStyle(() => ({ height: Math.max(BAR_WIDTH, grown.value * height) }));

  return (
    <Animated.View
      style={[
        styles.bar,
        tone === 'accent' ? styles.barAccent : tone === 'strong' ? styles.barStrong : styles.barSoft,
        animated,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.bg,
  },
  mark: {
    alignSelf: 'flex-start',
    gap: spacing.md,
  },
  bars: {
    height: BARS_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
  },
  barStrong: {
    backgroundColor: colors.textPrimary,
  },
  barSoft: {
    backgroundColor: colors.textSecondary,
  },
  barAccent: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: accentGlow.opacity,
    shadowRadius: accentGlow.radius,
    shadowOffset: { width: 0, height: 0 },
  },
  baseline: {
    height: 1,
    backgroundColor: colors.divider,
  },
});

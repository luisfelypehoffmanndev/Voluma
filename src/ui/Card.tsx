import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { accentGlow, colors, radius, spacing } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  /**
   * Inverte o card: fundo accent solido, conteudo em preto. Reservado ao dado
   * mais importante da tela — no maximo UM por tela, conforme o brief.
   */
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Card de nivel 1. Raio unico (`radius.card`) para toda a hierarquia, borda de
 * 1px, sem sombra: o brief proibe sombra difusa como separador.
 */
export function Card({ children, onPress, accent = false, style }: Props) {
  const surface: StyleProp<ViewStyle> = [
    styles.card,
    accent ? styles.accent : styles.plain,
    style,
  ];

  const inner = !onPress ? (
    <View style={surface}>{children}</View>
  ) : (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [surface, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );

  if (!accent) return inner;

  // O glow precisa de um wrapper proprio: `overflow: 'hidden'` do card vira
  // `clipsToBounds` no iOS, que recorta a sombra junto com o conteudo. O
  // wrapper repete cor e raio para o iOS ter uma forma opaca de onde tirar a
  // sombra, em vez de deduzir do alpha dos filhos.
  return <View style={styles.glow}>{inner}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: spacing.xl,
    overflow: 'hidden',
  },
  plain: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  accent: {
    backgroundColor: colors.accent,
  },
  glow: {
    borderRadius: radius.card,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: accentGlow.opacity,
    shadowRadius: accentGlow.radius,
    // Brilho para todo lado, nao sombra projetada: offset zero.
    shadowOffset: { width: 0, height: 0 },
    elevation: accentGlow.elevation,
  },
  pressed: {
    opacity: 0.72,
  },
});

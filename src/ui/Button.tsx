import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { accentGlow, colors, radius, spacing } from '@/theme/tokens';

import { GlassSurface } from './GlassSurface';
import { PressableSurface } from './PressableSurface';
import { Body } from './Text';

type Props = {
  label: string;
  onPress: () => void;
  /**
   * `primary` e o accent da tela: fundo laranja solido, texto preto. No maximo
   * UM por tela, e nunca numa tela que tenha caixa de concluido (§2).
   * `secondary` e vidro de nivel 3, sem cor.
   */
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * O botao que parece botao.
 *
 * Existe porque a acao principal de uma tela nao pode ser "um card que por
 * acaso e tocavel" — quem nunca abriu o app nao adivinha isso.
 *
 * As duas variantes compartilham a MESMA caixa: altura, raio e fonte. Botoes
 * lado a lado (Cancelar / Remover, So hoje / Toda segunda) sao sempre um par
 * destes, e uma caixa diferente entre eles faria um parecer mais importante que
 * o outro sem ninguem ter decidido isso.
 *
 * Desabilitado muda so a cor do conteudo. Mexer em fundo e opacidade junto faz
 * o botao "acender" ao habilitar, que le como feedback de toque que nao houve.
 */
export function Button({
  label,
  onPress,
  variant = 'secondary',
  disabled = false,
  icon,
  style,
  accessibilityLabel,
}: Props) {
  const primary = variant === 'primary';
  const textColor = disabled
    ? colors.textSecondary
    : primary
      ? colors.textOnAccent
      : colors.textPrimary;

  const content = (
    <View style={styles.content}>
      {icon}
      <Body numberOfLines={1} style={[styles.label, { color: textColor }]}>
        {label}
      </Body>
    </View>
  );

  return (
    <View style={[primary ? styles.glow : null, style]}>
      <PressableSurface
        onPress={onPress}
        disabled={disabled}
        // Solido apaga; vidro tambem apaga aqui, porque o preenchimento de
        // nivel 3 e quase opaco — acender uma laje fechada nao se ve.
        feedback="solid"
        borderRadius={radius.pill}
        accessibilityLabel={accessibilityLabel ?? label}
      >
        {primary ? (
          <View style={[styles.box, styles.primary]}>{content}</View>
        ) : (
          <GlassSurface borderRadius={radius.pill} style={styles.box}>
            {content}
          </GlassSurface>
        )}
      </PressableSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  /** O mesmo glow do card accent: e o que faz o laranja ler como neon. */
  glow: {
    borderRadius: radius.pill,
    shadowColor: colors.accent,
    shadowOpacity: accentGlow.opacity,
    shadowRadius: accentGlow.radius,
    shadowOffset: { width: 0, height: 0 },
    elevation: accentGlow.elevation,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    textAlign: 'center',
  },
});

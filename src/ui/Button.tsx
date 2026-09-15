import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { accentGlow, colors, radius, spacing, surfaces } from '@/theme/tokens';

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
   * `inline` e nivel 2, para a acao que ROLA com a pagina — ver abaixo.
   */
  variant?: 'primary' | 'secondary' | 'inline';
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
 * As tres variantes compartilham a MESMA caixa: altura, raio e fonte. Botoes
 * lado a lado (Cancelar / Remover, So hoje / Toda segunda) sao sempre um par
 * destes, e uma caixa diferente entre eles faria um parecer mais importante que
 * o outro sem ninguem ter decidido isso.
 *
 * **Quando usar `inline` em vez de `secondary`.** A pergunta nao e de estilo, e
 * de posicao: o botao FLUTUA sobre o conteudo (footer de `overlay`, painel de
 * `Sheet`) ou ROLA junto com ele? O que flutua e nivel 3 e esconde o que passa
 * por baixo — e `secondary`. O que rola e nivel 2, um degrau acima da
 * superficie em que esta — e `inline`. Fora a escada do brief, ha uma razao
 * dura: `secondary` monta um `GlassSurface`, e vidro dentro do conteudo cai
 * dentro do `BlurTarget` da tela e pede para borrar o proprio ancestral. Isso
 * nao degrada, derruba o app — ver `blurTarget.tsx`.
 *
 * Desabilitado, o secundario muda so a cor do conteudo: mexer em fundo e
 * opacidade junto faz o botao "acender" ao habilitar, que le como feedback de
 * toque que nao houve. O primario e a excecao: texto cinza sobre laranja fica
 * ilegivel, e um botao laranja brilhando que nao faz nada mente sobre o proprio
 * estado — ele apaga para o nivel 2, como o "Adicionar" do catalogo.
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
  const inline = variant === 'inline';
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
    <View style={[primary && !disabled ? styles.glow : null, style]}>
      <PressableSurface
        onPress={onPress}
        disabled={disabled}
        // Solido apaga; vidro tambem apaga aqui, porque o preenchimento de
        // nivel 3 e quase opaco — acender uma laje fechada nao se ve. O
        // `inline` inverte essa razao: a 8% ele e translucido de verdade, entao
        // acende, como o card e o controle.
        feedback={inline ? 'raised' : 'solid'}
        borderRadius={radius.pill}
        accessibilityLabel={accessibilityLabel ?? label}
      >
        {primary ? (
          <View style={[styles.box, disabled ? styles.primaryDisabled : styles.primary]}>
            {content}
          </View>
        ) : inline ? (
          <View style={[styles.box, styles.inline]}>{content}</View>
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
  primaryDisabled: {
    backgroundColor: surfaces.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  /**
   * Nivel 2 — o mesmo preenchimento do `primaryDisabled` logo acima e do
   * segmento ativo do `Segmented`, que e por onde esta superficie ja entrou no
   * app. Nao e superficie nova; e a que ja estava aqui, agora com nome.
   *
   * A borda, porem, e especular e nao chapada: o brief pede direcao da luz em
   * TODO nivel (clara na quina de cima, sumindo ao descer), e esta e a mesma
   * receita do `Card`. O `primaryDisabled` fica com a borda lisa de proposito —
   * botao apagado nao e superficie que o olho deva subir.
   */
  inline: {
    backgroundColor: surfaces.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopColor: surfaces.specularTop,
    borderLeftColor: surfaces.specularSide,
    borderRightColor: surfaces.specularSide,
    borderBottomColor: surfaces.specularBottom,
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

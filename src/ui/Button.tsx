import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { accentGlow, colors, fonts, radius, shape, spacing, theme } from '@/theme/tokens';

import { PressableSurface } from './PressableSurface';
import { Body, FONT_SCALE_CAP } from './Text';

type Props = {
  label: string;
  onPress: () => void;
  /**
   * `primary` e o accent da tela: fundo laranja solido, texto preto. No maximo
   * UM por tela (§2) — e as telas de aba e a sessao ja tem o seu dono.
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
      ? theme.onPrimary
      : colors.textPrimary;

  const content = (
    <View style={styles.content}>
      {icon}
      <Body
        numberOfLines={1}
        maxFontSizeMultiplier={FONT_SCALE_CAP.button}
        style={[styles.label, { color: textColor }]}
      >
        {label}
      </Body>
    </View>
  );

  return (
    // `collapsable={false}`: sem o brilho (botao desabilitado ou nao primario)
    // esta View so tem layout, e o Fabric a tira do nativo; quando o brilho
    // volta, ela volta, e o `Pressable` muda de pai. Essa troca no mesmo
    // commit em que a tela sai derrubava o app ("The specified child already
    // has a parent"): era o "Criar plano" do onboarding, com o `saving`
    // voltando a false junto do `router.replace`.
    <View collapsable={false} style={[primary && !disabled ? styles.glow : null, style]}>
      <PressableSurface
        onPress={onPress}
        disabled={disabled}
        // Solido apaga; vidro tambem apaga aqui, porque o preenchimento de
        // nivel 3 e quase opaco — acender uma laje fechada nao se ve. O
        // `inline` inverte essa razao: a 8% ele e translucido de verdade, entao
        // acende, como o card e o controle.
        feedback="solid"
        borderRadius={shape.control}
        accessibilityLabel={accessibilityLabel ?? label}
      >
        {primary ? (
          <View style={[styles.box, disabled ? styles.primaryDisabled : styles.primary]}>
            {content}
          </View>
        ) : inline ? (
          <View style={[styles.box, styles.inline]}>{content}</View>
        ) : (
          <View style={[styles.box, styles.inline]}>{content}</View>
        )}
      </PressableSurface>
    </View>
  );
}

/**
 * Altura do botao. Exportada porque quem empilha coisas acima de uma barra de
 * botao (o aviso de desfazer da sessao) precisa saber onde ela termina.
 *
 * 56 e nao 54: o multiplo de 4 da escala, e 8 acima do alvo minimo de toque.
 */
export const BUTTON_HEIGHT = 50;

const styles = StyleSheet.create({
  box: {
    height: BUTTON_HEIGHT,
    borderRadius: shape.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  primary: {
    backgroundColor: theme.primaryContainer,
  },
  primaryDisabled: {
    backgroundColor: theme.primaryContainer,
    opacity: 0.5,
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
    backgroundColor: theme.surfaceContainerHigh,
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
  /** Medium: o rotulo de uma acao e o texto mais forte da linha em que esta. */
  label: {
    textAlign: 'center',
    fontFamily: fonts.sansSemiBold,
  },
});

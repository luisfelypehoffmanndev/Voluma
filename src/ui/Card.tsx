import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { accentGlow, colors, radius, spacing, surfaces } from '@/theme/tokens';
import { useListMotion } from './motion';
import { PressableSurface } from './PressableSurface';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  /**
   * Inverte o card: fundo accent solido, conteudo em preto. Reservado ao dado
   * mais importante da tela — no maximo UM por tela, conforme o brief.
   */
  accent?: boolean;
  /**
   * O card muda de altura (abre e fecha): o vidro acompanha a mesma transicao
   * de layout dos vizinhos, e o `overflow: 'hidden'` revela o conteudo novo
   * enquanto ele cresce — em vez de o fundo pular para o tamanho final.
   */
  resizes?: boolean;
  /** Para quem precisa da altura do card — a sessao rola ate o proximo por ela. */
  onLayout?: (event: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Card de nivel 1: vidro sobre o campo de luz do `Ambient`. Raio unico
 * (`radius.card`) para toda a hierarquia, borda de 1px, sem sombra — o brief
 * proibe sombra difusa como separador.
 *
 * **Nao usa o `GlassSurface`, de proposito.** Aquele e o vidro de nivel 3, o
 * chrome que flutua e precisa esconder o que passa por baixo. Reusar ali
 * entregaria cards que ocultam o campo de luz, o oposto do que este componente
 * existe para fazer. Tambem nao ha `BlurView` aqui: o que passa por tras e um
 * degrade suave, e borrar um degrade suave devolve o mesmo degrade suave —
 * seria invisivel e ainda custaria GPU por card em lista rolavel.
 *
 * O card accent continua solido: laranja translucido perderia o soco do unico
 * elemento de cor da tela, e o glow precisa de uma forma opaca de onde o iOS
 * tire a sombra.
 */
export function Card({
  children,
  onPress,
  accent = false,
  resizes = false,
  onLayout,
  style,
}: Props) {
  const listMotion = useListMotion();
  const surface: StyleProp<ViewStyle> = [
    styles.card,
    accent ? styles.accent : styles.plain,
    style,
  ];

  const inner = !onPress ? (
    <Animated.View
      layout={resizes && 'layout' in listMotion ? listMotion.layout : undefined}
      onLayout={onLayout}
      style={surface}
    >
      {children}
    </Animated.View>
  ) : (
    // O card de vidro *acende*; o accent, solido, apaga. Baixar a opacidade
    // de uma superficie translucida apagaria o texto junto com ela e o card
    // quase sumiria — nao e o mesmo gesto. Os dois idiomas vivem em
    // `PressableSurface`; aqui so se escolhe qual.
    <PressableSurface
      onPress={onPress}
      feedback={accent ? 'solid' : 'card'}
      pressedOpacity={0.72}
      style={surface}
    >
      {children}
    </PressableSurface>
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
    backgroundColor: surfaces.card,
    borderWidth: StyleSheet.hairlineWidth,
    // A luz tem direcao: clara na quina de cima, sumindo ao descer. E o que
    // separa material fisico de retangulo translucido.
    borderTopColor: surfaces.specularTop,
    borderLeftColor: surfaces.specularSide,
    borderRightColor: surfaces.specularSide,
    borderBottomColor: surfaces.specularBottom,
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
});

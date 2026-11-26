import type { ReactNode } from 'react';
import {
  StyleSheet,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { layout, shape, theme } from '@/theme/tokens';
import { useListMotion } from './motion';
import { PressableSurface } from './PressableSurface';

type Props = {
  children: ReactNode;
  onPress?: () => void;
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
 * Ja teve uma variante `accent` (fundo laranja solido, o "card de sono" do
 * §6). Saiu no reset do plano 16: nenhuma tela a usava, e com o accent das
 * abas no botao central e o da sessao na proxima serie, nao sobrou tela onde
 * ela pudesse existir sem ser o segundo laranja.
 */
export function Card({
  children,
  onPress,
  resizes = false,
  onLayout,
  style,
}: Props) {
  const listMotion = useListMotion();
  const surface: StyleProp<ViewStyle> = [styles.card, style];

  return !onPress ? (
    <Animated.View
      layout={resizes && 'layout' in listMotion ? listMotion.layout : undefined}
      onLayout={onLayout}
      style={surface}
    >
      {children}
    </Animated.View>
  ) : (
    // O card de vidro *acende*: baixar a opacidade de uma superficie
    // translucida apagaria o texto junto com ela e o card quase sumiria.
    <PressableSurface onPress={onPress} feedback="raised" style={surface}>
      {children}
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  // Bloco solido da linguagem simples (plano 16, ajuste de clareza): sem vidro
  // e sem borda especular — o card se le como um bloco que se toca.
  card: {
    borderRadius: shape.card,
    padding: layout.cardPadding,
    backgroundColor: theme.surfaceContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});

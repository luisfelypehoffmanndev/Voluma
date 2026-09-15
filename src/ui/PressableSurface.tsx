import { useMemo, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { alphaOf, overlayAlpha } from '@/theme/composite';
import { motion, surfaces } from '@/theme/tokens';
import { useTiming } from './motion';

/**
 * Os dois gestos de toque do brief (§10), agora interpolados.
 *
 * - **acende** (`card`, `control`, `raised`): superficie translucida clareia. Baixar a
 *   opacidade dela apagaria o texto junto e o card quase sumiria — nao e o
 *   mesmo gesto. Ver o comentario original em `Card.tsx`.
 * - **apaga** (`solid`): chrome solido ou conteudo opaco escurece.
 *
 * Existe para que os ~148 `Pressable` do app nao animem cada um por conta
 * propria: fora daqui, de `motion.ts` e dos poucos componentes de estado,
 * nenhum arquivo importa `react-native-reanimated`.
 */

type Feedback =
  /** Nivel 1 — card, grupo. Acende. */
  | 'card'
  /** Nivel 1 em area pequena — botao redondo do cabecalho. Acende. */
  | 'control'
  /** Nivel 2 — superficie dentro de um card: o botao que rola com a pagina. Acende. */
  | 'raised'
  /** Chrome solido, icone ou linha de lista. Apaga. */
  | 'solid'
  /** Sem feedback proprio: quem responde e o filho (ex.: a celula marcavel). */
  | 'none';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  feedback?: Feedback;
  /**
   * Quanto `solid` apaga.
   *
   * Existe como prop porque hoje o app usa cinco valores diferentes (0,5 no
   * Stepper, 0,6 no peso, 0,72 no card accent, 0,8 em tres telas) e esta fase
   * preserva cada um. **Esta prop morre no commit de unificacao** — nao
   * adicione chamadores novos passando um valor proprio.
   */
  pressedOpacity?: number;
  /**
   * Raio da camada de feedback. So precisa quando o proprio estilo NAO tem
   * `overflow: 'hidden'` para recortar — o card tem, o botao redondo nao.
   */
  borderRadius?: number;
  hitSlop?: PressableProps['hitSlop'];
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * O feedback e uma CAMADA por cima, e nao uma animacao no proprio `Pressable`.
 *
 * A primeira versao usava `Animated.createAnimatedComponent(Pressable)` e
 * animava a cor de fundo direto nele. Custou uma regressao de toque real: o
 * botao passou a errar o alvo, reportado como "a hitbox parece menor que o
 * botao". Nao vale depurar o embrulho animado — o `Pressable` aqui e puro,
 * recebe exatamente os estilos que recebia antes, e a semantica de toque e
 * identica a de antes de existir animacao no app. A camada leva
 * `pointerEvents="none"` e nao participa do toque.
 *
 * Tambem por isso o estado vem de `onPressIn`/`onPressOut` num shared value, e
 * nao do `style={({ pressed }) => ...}`: aquela forma e um re-render do React
 * por toque, que e o custo que animar na UI thread existe para evitar.
 */
export function PressableSurface({
  children,
  onPress,
  onLongPress,
  disabled = false,
  feedback = 'solid',
  pressedOpacity = 0.8,
  borderRadius,
  hitSlop,
  style,
  accessibilityLabel,
}: Props) {
  const timing = useTiming();
  const pressed = useSharedValue(0);

  const layer = useMemo(() => {
    if (feedback === 'none') return null;

    // Apaga: preto por cima. Equivale a baixar a opacidade, porque o que ha
    // atras e o fundo quase-preto — e ao contrario de `opacity`, nao mexe na
    // composicao do que estiver por baixo da tela.
    if (feedback === 'solid') {
      return { color: '#000000', alpha: 1 - pressedOpacity, onTop: true };
    }

    // Acende: branco por cima, no alpha que POUSA no token de pressionado.
    // A conta esta em composite.ts com teste — empilhar a diferenca crua
    // (0,11 − 0,06) erraria, porque a camada so pinta o que a de baixo deixou
    // passar.
    const [rest, active] =
      feedback === 'control'
        ? [surfaces.control, surfaces.controlPressed]
        : feedback === 'raised'
          ? [surfaces.raised, surfaces.raisedPressed]
          : [surfaces.card, surfaces.cardPressed];

    return {
      color: '#FFFFFF',
      alpha: overlayAlpha(alphaOf(rest), alphaOf(active)),
      // Atras do conteudo: acender e sobre a SUPERFICIE. Por cima, a camada
      // lavaria o texto junto, que e exatamente o que "acende" existe para
      // nao fazer.
      onTop: false,
    };
  }, [feedback, pressedOpacity]);

  const layerStyle = useAnimatedStyle(() => ({
    opacity: pressed.value * (layer?.alpha ?? 0),
  }));

  // Assimetrico de proposito: desce na hora, sobe devagar. Ver o comentario de
  // `motion.duration.pressIn` — rampa na descida e latencia pura.
  const press = (value: number) => {
    const duration = value === 1 ? motion.duration.pressIn : motion.duration.pressOut;
    pressed.value = withTiming(value, timing(duration));
  };

  const overlay =
    layer && !disabled ? (
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: layer.color },
          borderRadius === undefined ? null : { borderRadius },
          layerStyle,
        ]}
      />
    ) : null;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => press(1)}
      onPressOut={() => press(0)}
      style={style}
    >
      {layer?.onTop === false ? overlay : null}
      {children}
      {layer?.onTop ? overlay : null}
    </Pressable>
  );
}

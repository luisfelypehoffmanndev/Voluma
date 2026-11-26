import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { colors, layout, radius, theme } from '@/theme/tokens';
import { CheckIcon } from './icons';
import { useFlag } from './motion';
import { PressableSurface } from './PressableSurface';

/**
 * A celula marcavel do §6 do brief, com a transicao entre os dois estados.
 *
 * A regra que manda aqui e literal: *"o que muda entre os estados e
 * preenchimento e borda, **nunca a forma nem o tamanho**"*. Estendida ao tempo,
 * ela proibe a animacao mais tentadora da lista — a caixa que estufa ao ser
 * marcada. Nada neste arquivo toca `width`, `height`, `borderRadius`,
 * `borderWidth` ou `transform`; a caixa e a mesma em todo instante da
 * transicao, e nao so nos dois extremos.
 *
 * **Quadrado de cantos arredondados, nunca circulo.** O app tem uma linguagem
 * so para "celula marcavel", e circulo aqui abriria uma segunda — o §7 chega a
 * proibir checkbox redondo pelo nome.
 *
 * **Marcada e BRANCA, nao laranja** (plano 16). Ate a Onda 0 a caixa marcada
 * era o accent, repetido uma vez por serie — a unica excecao da regra de um
 * accent por tela. A excecao caiu porque o laranja tinha trabalho mais
 * importante: dizer qual e a PROXIMA serie, que e a pergunta que a pessoa faz
 * entre series. Feito/nao feito continua legivel de relance pelo aceso/apagado
 * na mesma matiz, que e exatamente o que o §7 pede para estado. Sem cor, sem
 * glow: o glow era o que fazia o laranja ler como neon, e branco nao precisa.
 */

type Props = {
  checked: boolean;
  onPress: () => void;
  /** A caixa NAO muda com o estado — este tamanho vale para os dois. */
  size?: number;
  icon?: ReactNode;
  accessibilityLabel?: string;
};

/** Branco com alpha zero: o RGB fica parado e so o alpha se move na transicao. */
const WHITE_CLEAR = 'rgba(34,197,94,0)';

export function CheckCell({ checked, onPress, size = 32, icon, accessibilityLabel }: Props) {
  const progress = useFlag(checked);

  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [WHITE_CLEAR, theme.success]),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [theme.outline, theme.success],
    ),
  }));

  // O icone fica SEMPRE montado, so transparente quando desmarcado. Monta-lo
  // condicionalmente o faria aparecer de uma vez no fim, que e o "pop" que a
  // regra da forma existe para evitar.
  const iconStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  // O alvo de toque e o minimo de `layout.touch` em volta da caixa visual, sem
  // mexer no desenho: a caixa continua com o lado de 32, o dedo acerta 48.
  const slop = Math.max(0, (layout.touch - size) / 2);

  return (
    <PressableSurface
      feedback="none"
      hitSlop={{ top: slop, bottom: slop, left: slop, right: slop }}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={{ width: size, height: size }}>
        <Animated.View style={[styles.box, boxStyle]}>
          <Animated.View style={iconStyle}>
            {icon ?? <CheckIcon size={Math.round(size * 0.54)} color={colors.bg} />}
          </Animated.View>
        </Animated.View>
      </View>
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  box: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.square,
    alignItems: 'center',
    justifyContent: 'center',
    // A borda existe nos dois estados: sem ela o conteudo andaria 1px ao
    // entrar e sair do estado marcado. E a mesma exigencia do §6.
    borderWidth: 1.5,
  },
});

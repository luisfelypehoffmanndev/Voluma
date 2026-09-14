import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { accentGlow, colors, hitSlop, radius } from '@/theme/tokens';
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
 * Existe como componente proprio para que o lugar que define a forma seja o
 * mesmo que define a transicao dela. Enquanto os estilos moravam na tela de
 * treino, a caixa do calendario ja era outra implementacao da mesma ideia.
 *
 * **Quadrado de cantos arredondados, nunca circulo.** O app tem uma linguagem
 * so para "celula marcavel", e circulo aqui abriria uma segunda — o §7 chega a
 * proibir checkbox redondo pelo nome.
 *
 * **Sobre o accent repetido.** Marcada, a celula e laranja solido, e sao varias
 * na mesma tela — o que a regra geral do brief proibe. E a unica excecao,
 * documentada em Design/design.md §2: aqui a cor nao destaca um item entre os
 * outros, ela marca um estado binario que se repete, e a leitura util e a
 * agregada — quanto do treino ja foi feito, de relance. O preco da excecao e
 * que NENHUM outro elemento de uma tela com estas caixas pode usar accent.
 */

/**
 * O mesmo accent, com alpha zero — derivado do token para nao sair de sincronia
 * se a matiz mudar.
 *
 * Nao usar `'transparent'` no lugar: ele e `rgba(0,0,0,0)`, entao o RGB
 * interpolaria a partir do PRETO enquanto o alpha sobe, e o laranja entraria
 * sujo. Partindo do proprio accent, so o alpha se move.
 */
const ACCENT_CLEAR = `rgba(${parseInt(colors.accent.slice(1, 3), 16)},${parseInt(
  colors.accent.slice(3, 5),
  16,
)},${parseInt(colors.accent.slice(5, 7), 16)},0)`;

type Props = {
  checked: boolean;
  onPress: () => void;
  /** A caixa NAO muda com o estado — este tamanho vale para os dois. */
  size?: number;
  icon?: ReactNode;
};

export function CheckCell({ checked, onPress, size = 28, icon }: Props) {
  const progress = useFlag(checked);

  /**
   * O glow e uma camada IRMA, e o que anima nela e a opacidade.
   *
   * Animar `shadowOpacity` ou `elevation` direto seria o caminho natural e e o
   * errado: no Android a sombra por elevacao e desenhada pela plataforma a
   * partir do contorno da view, e dirigi-la quadro a quadro engasga. Opacidade
   * e first-class nas duas plataformas, e apagar a camada apaga a sombra dela
   * junto — mesmo resultado, sem o caminho instavel.
   *
   * A camada tambem carrega o `backgroundColor` accent, e por isso ela nao pode
   * ficar sempre visivel: sem a opacidade em zero, haveria um quadrado laranja
   * atras da caixa desmarcada. Ela existe separada porque `overflow: hidden` na
   * propria forma recortaria a sombra — o mesmo motivo do wrapper do `Card`.
   */
  const glowStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [ACCENT_CLEAR, colors.accent]),
    borderColor: interpolateColor(progress.value, [0, 1], [colors.dotEmpty, colors.accent]),
  }));

  // O icone fica SEMPRE montado, so transparente quando desmarcado. Monta-lo
  // condicionalmente o faria aparecer de uma vez no fim, que e o "pop" que a
  // regra da forma existe para evitar. Como a caixa tem tamanho fixo e ele e
  // centralizado, estar sempre presente nao custa layout nenhum.
  const iconStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <PressableSurface feedback="none" hitSlop={hitSlop} onPress={onPress}>
      <View style={{ width: size, height: size }}>
        <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" />

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
    // A borda existe mesmo transparente: sem ela o conteudo andaria 1px ao
    // entrar e sair do estado marcado. E a mesma exigencia do §6.
    borderWidth: 1,
  },
  /** O brilho que faz o laranja ler como neon, igual ao do card accent. */
  glow: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.square,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: accentGlow.opacity,
    shadowRadius: accentGlow.radius,
    // Brilho para todo lado, nao sombra projetada: offset zero.
    shadowOffset: { width: 0, height: 0 },
    elevation: accentGlow.elevation,
  },
});

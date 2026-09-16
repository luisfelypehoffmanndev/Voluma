import type { ReactNode } from 'react';
import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { motion } from '@/theme/tokens';
import { useTiming } from './motion';

/**
 * O conteudo que substitui o spinner entra acendendo, em vez de aparecer de
 * uma vez.
 *
 * Era o corte mais visivel do app, e o que fazia a TROCA DE ABA parecer aspera
 * mesmo ela ja sendo animada: a transicao entregava um `ActivityIndicator`, a
 * consulta resolvia, e a tela inteira surgia sem transicao nenhuma. O fade
 * daqui e a continuacao natural daquela — mesma curva, e `enter` porque isto e
 * conteudo entrando no layout, nao um valor se acomodando.
 *
 * A transicao de aba em si mudou depois disto: era um fade de entrada feito a
 * mao, que passava pelo fundo do app, e virou o cross-fade nativo do navegador
 * (ver `useTabAnimation` em `motion.ts`). Este componente nao muda com isso —
 * ele cobre o corte do spinner para o dado, que acontece dentro da tela e so na
 * primeira carga.
 *
 * **E um fade so, do bloco inteiro** — deliberadamente. Animar item a item
 * seria a "cascata de tudo que entra na tela" que o §10 proibe pelo nome, e que
 * o `LayoutAnimationConfig skipEntering` das listas ja existe para evitar.
 *
 * **Por que opacidade em vez de `entering: FadeIn`:** as telas de sessao e de
 * dia envolvem a lista naquele mesmo `skipEntering`, que engole animacao de
 * ENTRADA na primeira renderizacao — que e exatamente o momento que este
 * componente existe para cobrir. Uma animacao de estilo passa por baixo dessa
 * regra sem precisar desliga-la, e sem reabrir a decisao que ela protege.
 *
 * Nao anima em recarga: `useQuery` mantem o dado anterior na tela em vez de
 * voltar ao placeholder (ver `src/store/data.ts`), entao o componente so monta
 * uma vez, na primeira carga — o unico instante em que havia corte.
 */
export function Reveal({
  children,
  style,
}: {
  children: ReactNode;
  /**
   * Nao ha layout embutido de proposito: este componente insere uma View na
   * arvore, e so o call site sabe o que ela precisa ser ali — `flex: 1` quando
   * embrulha o `ScrollView` de uma tela, o mesmo `gap` do pai quando embrulha
   * um punhado de irmaos dentro de um `contentContainerStyle` que espaca por
   * `gap` (do contrario o espacamento entre eles colapsa).
   */
  style?: StyleProp<ViewStyle>;
}) {
  const timing = useTiming();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, timing(motion.duration.enter));
  }, [progress, timing]);

  const fade = useAnimatedStyle(() => ({ opacity: progress.value }));

  return <Animated.View style={[style, fade]}>{children}</Animated.View>;
}

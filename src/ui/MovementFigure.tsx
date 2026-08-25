import { useEffect, useState } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { FRAMES, VIEW_BOXES } from '@/movements/art';
import { colors, radius, surfaces } from '@/theme/tokens';

/**
 * A figura de um movimento: silhueta monocromatica que cicla os tres frames.
 *
 * A arte vem do workout-guide (ver ATTRIBUTION.md) como um path unico por
 * frame, entao renderizar e o mesmo `<Svg><Path>` que `icons.tsx` ja faz — o
 * fill sai do tema, nao do arquivo.
 *
 * Sobre o brief: ele manda icone outline, traco fino, sem preenchimento, e
 * estas sao silhuetas solidas. A regra continua valendo para icone; isto e
 * ilustracao, uma classe diferente, e paga a diferenca ficando em
 * `textSecondary` e nunca em accent. Numa tela onde o accent ja tem dono — a
 * caixa de concluido do treino — a figura nao disputa.
 */

/**
 * Os dois extremos do movimento. O frame do meio fica de fora.
 *
 * Nao e escolha estetica, e defeito medido da arte de origem: o frame 2 tem 83%
 * mais tinta que o frame 1 e traco efetivo 1,83x mais grosso (no supino chega a
 * 2,6x de area preenchida), enquanto o frame 3 empata com o 1 em 1,04x. Num
 * ciclo 1-2-3-2 o frame gordo aparecia metade do tempo, e a figura pulsava de
 * espessura em vez de se mover.
 *
 * Nao da para afinar um path preenchido sem redesenhar a geometria, entao a
 * saida e nao mostra-lo. O movimento nao perde nada: a distancia de pose entre
 * os frames 1 e 3 e de 111px em media, MAIOR que os 85px entre 1 e 2.
 *
 * O preco: em 3 dos 60 movimentos os frames 1 e 3 sao quase iguais (<15px) e a
 * figura fica praticamente parada. O frame 2 continua vendorizado, entao voltar
 * atras e mexer nesta linha.
 */
const CYCLE = [0, 2] as const;

/**
 * Quanto cada pose fica na tela.
 *
 * Sao duas poses, nao trinta: rapido demais vira tremor, devagar demais vira
 * slideshow. 700 ms da uma repeticao de ~1,4 s, que e a cadencia de quem esta
 * levantando de verdade.
 */
const FRAME_MS = 700;

/**
 * A pose que representa o movimento quando ele esta parado.
 *
 * E o frame 1, e nao o do meio: segundo o manifesto do workout-guide, e ele que
 * vem do `-tension.svg` do Everkinetic — ou seja, a pose de tensao ja e esta. E
 * de quebra e a mais leve das tres.
 */
const STILL = 0;

type Props = {
  /** O slug do movimento, de `artSlugFor(exercise.name)`. `null` cai no placeholder. */
  slug: string | null;
  size?: number;
  /** Cicla os frames. Fora do treino em andamento a figura fica parada. */
  animated?: boolean;
  color?: ColorValue;
};

export function MovementFigure({
  slug,
  size = 40,
  animated = false,
  color = colors.textSecondary,
}: Props) {
  const frames = slug ? FRAMES[slug] : undefined;
  // O quadro vem da arte, nao e `0 0 512 512`: a origem usa o quadro de forma
  // irregular (de 188 a 482 de largura util), e desenhar todo mundo nele deixava
  // umas figuras pequenas e as assimetricas ate 12% fora do centro. `VIEW_BOXES`
  // ja vem apertado em volta dos tres frames JUNTOS — juntos, para a pose nao
  // pular de escala entre um frame e outro.
  const viewBox = (slug && VIEW_BOXES[slug]) || '0 0 512 512';

  // Quem pediu menos movimento no sistema nao quer uma silhueta piscando em
  // cada bloco da tela de treino.
  const reduceMotion = useReducedMotion();
  const cycling = animated && !reduceMotion && frames !== undefined;

  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!cycling) return;
    const timer = setInterval(() => setStep((current) => (current + 1) % CYCLE.length), FRAME_MS);
    return () => clearInterval(timer);
  }, [cycling]);

  if (!frames) return <View style={[styles.placeholder, { width: size, height: size }]} />;

  return (
    <Svg width={size} height={size} viewBox={viewBox}>
      <Path d={frames[cycling ? CYCLE[step] : STILL]} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  /**
   * O buraco onde a figura estaria.
   *
   * Ocupa a mesma caixa em vez de encolher a linha: metade de uma lista com
   * figura e metade sem, com alturas diferentes, le como bug. Quadrado de canto
   * arredondado porque e o que o brief manda para toda celula quadrada.
   */
  placeholder: {
    backgroundColor: surfaces.control,
    borderRadius: radius.square,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});

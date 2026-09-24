import { useCallback, useEffect, useMemo } from 'react';
import { Easing as RNEasing, type Animated as RNAnimated } from 'react-native';
import {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { motion } from '@/theme/tokens';

/**
 * O portao central do movimento — ver Design/design.md §10.
 *
 * Este e o unico lugar que decide se algo se move. Nenhum call site consulta
 * `useReducedMotion` sozinho, e nenhum tem `if` de animacao: eles pedem a
 * transicao e recebem uma de duracao zero quando o sistema pediu menos
 * movimento.
 *
 * O contrato dessa degradacao importa: **quem pediu menos movimento nao pediu
 * menos interface**. `withTiming` com duracao 0 resolve no mesmo frame, entao o
 * valor FINAL continua correto — a caixa fica laranja, o chip fica aceso — e
 * nenhum estado pode ficar preso no meio da interpolacao. E o mesmo contrato
 * que `MovementFigure` ja seguia antes de existir animacao no app.
 */

/**
 * A curva unica do app: desacelera ate parar, derivada final zero, sem
 * overshoot. Mora aqui e nao em `tokens.ts` porque aquele arquivo nao importa
 * nada — e o que deixa `composite.test.ts` roda-lo em Node puro.
 */
export const SETTLE = Easing.bezier(...motion.easing);

/**
 * A MESMA curva, para quem nao fala Reanimated.
 *
 * O `Easing.bezier` do Reanimated nao devolve uma funcao: devolve um
 * `EasingFunctionFactory` — `{ factory: () => EasingFunction }` — que so o
 * `withTiming` dele sabe desembrulhar. A troca de aba nao roda no Reanimated:
 * o `transitionSpec` do bottom-tabs cai num `Animated.timing` do proprio React
 * Native, com driver nativo, e la o `easing` precisa ser `(t) => number` puro.
 *
 * Isto nao e uma segunda curva. Os quatro numeros continuam morando so em
 * `motion.easing`; o que existe em dois lugares e o RUNTIME que os resolve, que
 * e a mesma divisao que ja separa o `SETTLE` do `animationType` do `Modal`.
 */
export const TAB_SETTLE = RNEasing.bezier(...motion.easing);

/**
 * Config de `withTiming` ja com a curva e o gating aplicados.
 *
 * Use quando o valor animado nao e um booleano — do contrario prefira
 * `useFlag`, que ja cuida do shared value.
 */
export function useTiming() {
  const reduceMotion = useReducedMotion();

  return useCallback(
    (duration: number) => ({
      duration: reduceMotion ? 0 : duration,
      easing: SETTLE,
    }),
    [reduceMotion],
  );
}

/**
 * Config de `withTiming` com ATRASO, para sequencias — hoje so a abertura do
 * onboarding (ver a excecao em Design/design.md §10).
 *
 * Com movimento reduzido o atraso tambem zera, e nao so a duracao: uma entrada
 * em cinco tempos com duracao 0 e atraso intacto viraria cinco saltos com
 * pausas, que e pior que animar. Tudo aparece no primeiro quadro.
 */
export function useStaged() {
  const reduceMotion = useReducedMotion();

  return useCallback(
    (delay: number, duration: number) => ({
      delay: reduceMotion ? 0 : delay,
      config: { duration: reduceMotion ? 0 : duration, easing: SETTLE },
    }),
    [reduceMotion],
  );
}

/**
 * Um booleano virando 0..1 animado — a base de quase tudo: pressionado,
 * concluido, selecionado, aba em foco.
 *
 * O valor inicial acompanha `active` em vez de comecar sempre em 0: senao toda
 * caixa ja marcada acenderia na montagem da tela, e uma lista de exercicios
 * concluidos viraria uma cascata de laranja a cada vez que a tela abre.
 */
export function useFlag(active: boolean, duration = motion.duration.state): SharedValue<number> {
  const timing = useTiming();
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, timing(duration));
  }, [active, duration, timing, progress]);

  return progress;
}

/**
 * As animacoes de entrada/saida de item de lista, prontas para espalhar num
 * `Animated.View`.
 *
 * Tres decisoes que nao sao obvias:
 *
 * 1. **Devolve `undefined` com movimento reduzido**, e nao uma config de 0ms:
 *    layout animation do Reanimated com duracao zero ainda monta o worklet de
 *    layout. Sem as props, o `Animated.View` monta como uma View comum.
 *
 * 2. **`FadeIn`/`FadeOut`, nunca `SlideIn`/`FadeInDown`.** Dentro de um
 *    `ScrollView` com padding no `contentContainerStyle`, as variantes de
 *    slide medem contra o pai errado e o item entra voando de um offset
 *    estranho. Fade nao tem geometria para errar.
 *
 * 3. **`layout` vem no pacote, nao e opcional.** O item que sai segura o
 *    proprio espaco ate a animacao acabar; sem transicao de layout nos irmaos,
 *    o `gap` fecha de uma vez so no ultimo frame, que e pior que nao animar.
 */
export function useListMotion() {
  const reduceMotion = useReducedMotion();

  return useMemo(() => {
    if (reduceMotion) return {};

    return {
      entering: FadeIn.duration(motion.duration.enter).easing(SETTLE),
      exiting: FadeOut.duration(motion.duration.exit).easing(SETTLE),
      layout: LinearTransition.duration(motion.duration.reflow).easing(SETTLE),
    };
  }, [reduceMotion]);
}

/**
 * O `animationType` de um `Modal` do React Native, atras do mesmo portao.
 *
 * O `Modal` e o unico movimento do app que nao passa por aqui: quem anima e a
 * plataforma, por um enum de string, sem curva nem duracao que a gente possa
 * escolher. Era tambem a unica animacao que ignorava "reduzir movimento" — o
 * §10 do brief nao abre excecao ("toda animacao fica atras da preferencia de
 * sistema, sem excecao"), entao a excecao era um bug, nao uma decisao.
 *
 * Isto e o maximo de controle que a API permite: com movimento reduzido, o
 * painel aparece direto. O estado final e o mesmo — o contrato de degradacao
 * continua valendo, o modal abre igual, so nao desliza.
 *
 * Existe aqui, e nao dentro do componente, porque nenhum call site consulta
 * `useReducedMotion` sozinho — e essa regra que mantem o portao sendo um
 * portao.
 */
export function useModalAnimation(): 'none' | 'slide' {
  return useReducedMotion() ? 'none' : 'slide';
}

/**
 * Como a troca de aba anima, atras do mesmo portao.
 *
 * `'fade'` e o cross-fade nativo do bottom-tabs: a aba que sai e a que entra
 * se sobrepoem, uma apagando enquanto a outra acende. Antes disto havia um fade
 * feito a mao (`TabScene`) que so animava a ENTRADA — a tela velha sumia no
 * mesmo quadro e a nova subia de zero, entao o fundo do app aparecia inteiro no
 * meio. Era a piscada.
 *
 * Com movimento reduzido cai para `'none'` e o navegador troca as cenas por
 * `display`, sem opacidade nenhuma envolvida. O contrato de sempre: o estado
 * final e o mesmo, so o caminho ate ele desaparece.
 */
export function useTabAnimation(): 'none' | 'fade' {
  return useReducedMotion() ? 'none' : 'fade';
}

/**
 * A duracao e a curva do cross-fade de aba.
 *
 * `motion.duration.state` e o mesmo numero que o `TabIcon` ja usa ao lado — a
 * aba e o icone dela continuam se acomodando no mesmo tempo. Nenhum numero novo
 * entra no orcamento.
 *
 * `'timing'`, nunca `'spring'`: o tipo do bottom-tabs aceita as duas e o §10
 * proibe mola pelo nome.
 *
 * **Passe isto so quando houver animacao.** O navegador resolve o default por
 * parametro — `transitionSpec = NAMED_TRANSITIONS_PRESETS[animation].transitionSpec`
 * — e esse default so vale quando o valor chega `undefined`. Mandar este objeto
 * junto com `animation: 'none'` substituiria o preset de duracao zero pelo
 * nosso de 160ms, que e o oposto do que "reduzir movimento" pediu. Quem gateia
 * e o call site, com o valor de `useTabAnimation()`.
 */
export const tabTransitionSpec: {
  animation: 'timing';
  config: Omit<RNAnimated.TimingAnimationConfig, 'toValue' | keyof RNAnimated.AnimationConfig>;
} = {
  animation: 'timing',
  config: { duration: motion.duration.state, easing: TAB_SETTLE },
};

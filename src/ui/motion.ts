import { useCallback, useEffect, useMemo } from 'react';
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
      layout: LinearTransition.duration(motion.duration.state).easing(SETTLE),
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

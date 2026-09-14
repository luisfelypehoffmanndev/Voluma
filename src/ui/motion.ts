import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { countUpValue } from '@/domain/countUp';
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
 * `SETTLE` e uma `EasingFunctionFactory` (o formato que `.easing()` das
 * transicoes do Reanimated espera) — `.factory()` resolve a funcao de verdade,
 * `(t: number) => number`, para quem precisa avaliar a curva fora de uma
 * transicao do proprio Reanimated. Hoje so `useCountUp` usa isto.
 */
const settleCurve = SETTLE.factory();

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
 * Um numero subindo (ou descendo) do valor antigo ate o novo — hoje so o
 * "Volume levantado" da tela de sessao. Nao anima na montagem: a primeira vez
 * que um alvo REAL chega (em vez de `undefined`, o estado de "ainda
 * carregando") aparece direto, sem contar do zero.
 *
 * Roda no JS thread com `requestAnimationFrame`, nao com `useSharedValue` /
 * `withTiming` como o resto do arquivo: quem usa isto (`StatNumber`) e um
 * `Text` puro, nao um `TextInput`, e `formatVolume` muda de forma (digitos ->
 * "3,2k" -> "5k") conforme o valor sobe — reformatar isso a cada frame dentro
 * de um worklet exigiria reescrever `formatVolume` como worklet so para esta
 * tela. Um `useState` por frame, para um numero, numa tela, por ~700ms, e
 * barato.
 */
export function useCountUp(target: number | undefined, duration = motion.duration.count): number {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(() => target ?? 0);
  const displayRef = useRef(display);
  const prevTargetRef = useRef(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === undefined) return; // ainda carregando — nada a animar

    const prevTarget = prevTargetRef.current;
    prevTargetRef.current = target;

    const settle = (value: number) => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      displayRef.current = value;
      setDisplay(value);
    };

    // Primeiro alvo real (a tela acabou de sair do carregamento), sem
    // movimento pedido, ou alvo repetido (outra escrita em outro lugar do app
    // recarregou esta tela sem mudar o volume): aplica na hora, sem contar.
    if (prevTarget === undefined || reduceMotion || target === prevTarget) {
      settle(target);
      return;
    }

    // De onde o numero ESTA na tela agora, nao do alvo anterior: uma
    // contagem interrompida por um novo toque continua suave a partir de
    // onde parou, em vez de saltar de volta pro valor de antes dela comecar.
    const from = displayRef.current;
    let startTime: number | null = null;

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

    const tick = (now: number) => {
      // Ancora no relogio do proprio rAF, nunca em `Date.now()` — o primeiro
      // quadro define o zero, os seguintes medem a partir dele.
      if (startTime === null) startTime = now;
      const t = Math.min(1, (now - startTime) / duration);
      const value = countUpValue(from, target, settleCurve(t));
      displayRef.current = value;
      setDisplay(value);
      frameRef.current = t < 1 ? requestAnimationFrame(tick) : null;
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration, reduceMotion]);

  return display;
}

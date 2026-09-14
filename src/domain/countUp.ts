/**
 * A matematica pura de uma contagem: dado de onde o numero saiu, para onde
 * vai, e o progresso ja com a curva `SETTLE` aplicada (0..1), devolve o valor
 * inteiro a mostrar naquele frame.
 *
 * Fica em `src/domain/` e nao em `src/ui/motion.ts` justamente para poder
 * rodar em Node puro, do jeito que `composite.test.ts` ja roda a matematica de
 * `tokens.ts` sem reanimated. A curva em si (`Easing.bezier`) continua so em
 * `motion.ts` — esta funcao nao a reimplementa, so aplica um progresso que ja
 * chega com ela embutida.
 */
export function countUpValue(from: number, to: number, easedProgress: number): number {
  const t = Math.min(1, Math.max(0, easedProgress));
  return Math.round(from + (to - from) * t);
}

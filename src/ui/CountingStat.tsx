import { formatVolume } from '@/domain/volume';
import { fontSize } from '@/theme/tokens';
import { useCountUp } from '@/ui/motion';
import { StatNumber } from '@/ui/StatNumber';

type Props = {
  /** Volume alvo em kg. `undefined` enquanto a consulta nao respondeu. */
  kg: number | undefined;
  size?: number;
};

/**
 * O "Volume levantado" da tela de sessao, contando ate o valor novo.
 *
 * Existe como componente PROPRIO, e nao como um `useCountUp` na tela, por um
 * motivo so: `useCountUp` roda um `setState` por quadro (ver `motion.ts`), e
 * quem chama o hook re-renderiza junto. Na raiz de `SessionScreen` isso
 * arrastava a tela inteira — cada `ExerciseCard`, cada `SetRow`, a arte de
 * movimento — umas 40 vezes em 700ms, e justo no instante em que o toque
 * tambem dispara a escrita no banco, o `bumpData`, a transicao de layout da
 * lista e o `CheckCell` acendendo. Aqui embaixo, o unico que re-renderiza por
 * quadro e este numero.
 *
 * `fit={false}` pela mesma razao: `formatVolume` nunca passa de quatro
 * caracteres ("3,2k", "12k", "999"), entao o encolhimento automatico nao
 * protege de nada e cobraria uma re-medicao de texto por quadro no Android.
 *
 * O contrato de nao contar na montagem continua valendo: o componente monta
 * depois do carregamento, `useCountUp` inicializa com o primeiro alvo real e o
 * primeiro efeito cai em `target === prevTarget` — ou seja, assenta direto.
 */
export function CountingStat({ kg, size = fontSize.numberLg }: Props) {
  const value = useCountUp(kg);

  return <StatNumber value={formatVolume(value)} unit="kg" size={size} fit={false} />;
}

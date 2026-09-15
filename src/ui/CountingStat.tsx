import { useEffect, useRef } from 'react';
import { useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { formatVolume } from '@/domain/volume';
import { fontSize, motion } from '@/theme/tokens';
import { SETTLE } from '@/ui/motion';
import { StatNumber } from '@/ui/StatNumber';

type Props = {
  /** Volume alvo em kg. `undefined` enquanto a consulta nao respondeu. */
  kg: number | undefined;
  size?: number;
};

/**
 * O "Volume levantado" da tela de sessao, contando ate o valor novo.
 *
 * **A contagem roda inteira na UI thread.** Ja rodou na JS thread, com um
 * `setState` por quadro (~42 re-renders em 700ms) — e enquanto o numero contava,
 * qualquer trabalho concorrente em JS aparecia como engasgo na contagem: o
 * `bumpData` de uma escrita caindo no banco, um re-render de card, a recarga da
 * lista. Isolar o re-render neste componente ajudou, mas nao resolvia: o
 * problema nao era QUANTO se re-renderizava, era a animacao depender de uma
 * thread disputada.
 *
 * O que impedia a mudanca era o formato: `formatVolume` abreviava acima de mil
 * ("3,2k", "12k"), e reformatar isso a cada quadro dentro de um worklet exigiria
 * reescrever a funcao inteira como worklet so para esta tela. Quando o formato
 * passou a ser o numero cheio, a regra virou uma linha (`Math.round`) e cabe
 * num worklet sem arrastar nada junto — ver `animatedValue` em `StatNumber`.
 *
 * `fit={false}` continua valendo pelo mesmo motivo de antes: no Android o
 * `adjustsFontSizeToFit` remede o texto a cada troca de conteudo, e aqui o
 * conteudo troca a cada quadro. O tamanho fica fixo de proposito, e o numero
 * cabe — cinco digitos a `numberLg` ocupam ~165dp dos ~320dp uteis.
 *
 * **Nao anima na montagem**, so em atualizacoes: o primeiro alvo REAL (o
 * primeiro que nao e `undefined`, o estado de "ainda carregando") entra direto.
 * Contar do zero ao abrir a tela seria animar uma mudanca que nao aconteceu.
 */
export function CountingStat({ kg, size = fontSize.numberLg }: Props) {
  const reduceMotion = useReducedMotion();
  const value = useSharedValue(kg ?? 0);
  const settled = useRef(kg !== undefined);

  useEffect(() => {
    if (kg === undefined) return; // ainda carregando — nada a animar

    // Primeiro valor real, ou movimento reduzido: assenta no mesmo quadro.
    // `withTiming` com duracao 0 tambem resolveria, mas atribuir direto deixa
    // explicito que aqui nao ha transicao nenhuma para interromper.
    if (!settled.current || reduceMotion) {
      settled.current = true;
      value.value = kg;
      return;
    }

    // De onde o numero ESTA agora, nao de onde deveria ter parado: uma contagem
    // interrompida por um novo toque continua suave a partir do ponto em que
    // estava, em vez de saltar de volta. `withTiming` ja parte do valor atual.
    value.value = withTiming(kg, { duration: motion.duration.count, easing: SETTLE });
  }, [kg, reduceMotion, value]);

  return (
    <StatNumber
      value={formatVolume(kg ?? 0)}
      animatedValue={value}
      unit="kg"
      size={size}
      fit={false}
    />
  );
}

import { useRef } from 'react';
import type { AccessibilityActionEvent, GestureResponderEvent, ViewProps } from 'react-native';

/** Quanto o dedo anda de lado antes de um toque virar arrasto de leitura. */
const SCRUB_SLOP = 8;

type Options = {
  count: number;
  /** O indice sob o `x` do dedo, em coordenadas do grafico. */
  indexAt: (x: number) => number;
  selected: number | null;
  onSelect?: (index: number | null) => void;
  /** O que o leitor de tela anuncia para o periodo em leitura. */
  describe: (index: number) => string;
};

/**
 * A leitura de um grafico pelo dedo: tocar escolhe um periodo, arrastar de lado
 * percorre os periodos, tocar de novo no mesmo volta ao padrao.
 *
 * Nao existe tooltip: quem mostra o valor lido e o numero grande do cabecalho
 * do card, como o mostrador de um instrumento acompanha o cursor. O grafico so
 * acende a marca escolhida.
 *
 * A escolha acontece ao SOLTAR o dedo, e nao ao encostar: a tela rola na
 * vertical, e quem so passou o dedo por cima do grafico para rolar nao queria
 * ler nada. O arrasto so vira leitura depois de andar `SCRUB_SLOP` de lado, e a
 * partir dai a rolagem nao toma mais o gesto.
 *
 * Para o leitor de tela o grafico e um controle ajustavel: deslizar para cima e
 * para baixo anda um periodo, e o valor anunciado e o do periodo em leitura.
 */
export function useScrub({ count, indexAt, selected, onSelect, describe }: Options): ViewProps {
  const start = useRef<{ x: number; y: number } | null>(null);
  const scrubbing = useRef(false);

  if (!onSelect || count === 0) return {};

  const readAt = (event: GestureResponderEvent) => indexAt(event.nativeEvent.locationX);
  const current = selected ?? count - 1;

  return {
    onStartShouldSetResponder: () => true,
    onResponderGrant: (event) => {
      start.current = {
        x: event.nativeEvent.pageX,
        y: event.nativeEvent.pageY,
      };
      scrubbing.current = false;
    },
    onResponderMove: (event) => {
      const origin = start.current;
      if (!origin) return;
      if (!scrubbing.current) {
        const dx = Math.abs(event.nativeEvent.pageX - origin.x);
        const dy = Math.abs(event.nativeEvent.pageY - origin.y);
        if (dx < SCRUB_SLOP || dx < dy) return;
        scrubbing.current = true;
      }
      const index = readAt(event);
      if (index !== selected) onSelect(index);
    },
    onResponderRelease: (event) => {
      if (!scrubbing.current) {
        const index = readAt(event);
        onSelect(index === selected ? null : index);
      }
      start.current = null;
      scrubbing.current = false;
    },
    onResponderTerminate: () => {
      start.current = null;
      scrubbing.current = false;
    },
    // Enquanto so encostou, a rolagem pode levar o gesto; lendo, nao.
    onResponderTerminationRequest: () => !scrubbing.current,
    accessible: true,
    accessibilityRole: 'adjustable',
    accessibilityValue: { text: describe(current) },
    accessibilityActions: [{ name: 'increment' }, { name: 'decrement' }],
    onAccessibilityAction: (event: AccessibilityActionEvent) => {
      const step = event.nativeEvent.actionName === 'increment' ? 1 : -1;
      onSelect(Math.min(count - 1, Math.max(0, current + step)));
    },
  };
}

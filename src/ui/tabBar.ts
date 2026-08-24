import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Geometria da tab bar flutuante — um lugar so.
 *
 * Existe porque a barra e posicionada em absoluto: ela sai do fluxo, entao o
 * conteudo rolavel de cada tela precisa reservar por conta propria exatamente o
 * espaco que ela ocupa. Enquanto os dois lados chutavam numeros separados
 * (`bottom: 18` no layout, `paddingBottom: 96` em cada tela), mexer em um
 * quebrava o outro em silencio — o ultimo item da lista sumia atras do vidro e
 * nada no codigo denunciava o porque.
 *
 * Agora ha uma fonte de verdade: `clearance` e derivado de `bottom` e `height`,
 * entao mudar a altura da barra ajusta as quatro telas junto.
 */

/** Altura do pill. */
export const TAB_BAR_HEIGHT = 60;

/** Recuo lateral do pill ate a borda da tela. */
export const TAB_BAR_SIDE_INSET = 20;

/** Respiro abaixo do pill em aparelho sem area segura nenhuma. */
const MIN_BOTTOM_GAP = 12;

/** Ar entre o fim do conteudo rolavel e o topo do pill. */
const CONTENT_BREATHING_ROOM = 24;

export type TabBarGeometry = {
  height: number;
  bottom: number;
  sideInset: number;
  /** `paddingBottom` que o conteudo rolavel precisa para nao sumir sob a barra. */
  clearance: number;
};

export function useTabBarGeometry(): TabBarGeometry {
  const insets = useSafeAreaInsets();

  // O inset como piso, nao um numero fixo: na navegacao por gestos ele e ~24px,
  // nos tres botoes ~48. O valor fixo de antes so funcionava num dos dois — no
  // outro o pill ficava atras da barra do sistema.
  const bottom = Math.max(insets.bottom, MIN_BOTTOM_GAP);

  return {
    height: TAB_BAR_HEIGHT,
    bottom,
    sideInset: TAB_BAR_SIDE_INSET,
    clearance: bottom + TAB_BAR_HEIGHT + CONTENT_BREATHING_ROOM,
  };
}

/** Atalho para o unico valor que as telas de tab consomem. */
export function useTabBarClearance(): number {
  return useTabBarGeometry().clearance;
}

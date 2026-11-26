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

/** Altura util da barra, acima da area segura. */
export const TAB_BAR_HEIGHT = 52;

/** Ar entre o fim do conteudo rolavel e o topo da barra. */
const CONTENT_BREATHING_ROOM = 24;

export type TabBarGeometry = {
  /** Altura total, com a area segura. */
  height: number;
  bottom: number;
  sideInset: number;
  /** `paddingBottom` que o conteudo rolavel precisa para nao sumir sob a barra. */
  clearance: number;
};

/**
 * A barra de abas da linguagem Blink: largura cheia, opaca e colada no fundo da
 * tela. O conteudo rola por baixo e cada tela reserva `clearance` no fim.
 */
export function useTabBarGeometry(): TabBarGeometry {
  const insets = useSafeAreaInsets();
  const height = TAB_BAR_HEIGHT + insets.bottom;
  return { height, bottom: 0, sideInset: 0, clearance: height + CONTENT_BREATHING_ROOM };
}

/** Atalho para o unico valor que as telas de tab consomem. */
export function useTabBarClearance(): number {
  return useTabBarGeometry().clearance;
}

import type { Href } from 'expo-router';

type Navigator = { canGoBack(): boolean; back(): void; replace(href: Href): void };

/**
 * Volta se houver tela atras; senao, vai para `fallback`.
 *
 * Uma tela aberta por link direto, ou que sobrou sozinha na pilha, chamaria
 * `back()` sem destino: em desenvolvimento e um aviso, em producao o botao nao
 * faz nada e a pessoa fica presa.
 */
export function goBackOr(router: Navigator, fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

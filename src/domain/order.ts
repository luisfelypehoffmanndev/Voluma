/**
 * Aplica uma ordem salva (lista de chaves) sobre a ordem natural dos itens.
 *
 * A ordem salva e uma foto do momento do drag, entao pode estar defasada: item
 * que surgiu depois (adicionado ao plano, "so hoje") vai para o fim, na ordem
 * natural — o mesmo lugar onde adicionar ja o colocaria. Chave que nao existe
 * mais e ignorada.
 */
export function applyOrder<T>(
  items: readonly T[],
  order: readonly string[],
  keyOf: (item: T) => string,
): T[] {
  if (order.length === 0) return [...items];

  const rank = new Map<string, number>();
  order.forEach((key, index) => {
    if (!rank.has(key)) rank.set(key, index);
  });

  const ranked: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (rank.has(keyOf(item))) ranked.push(item);
    else rest.push(item);
  }

  ranked.sort((a, b) => rank.get(keyOf(a))! - rank.get(keyOf(b))!);
  return [...ranked, ...rest];
}

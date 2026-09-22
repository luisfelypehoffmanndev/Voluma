/**
 * Regras de amizade.
 *
 * A que organiza tudo: nada de uma pessoa aparece para outra sem DOIS
 * consentimentos — a amizade aceita e o toggle de compartilhamento ligado. Um
 * so nao basta. Aqui ficam as decisoes puras; quem aplica o corte de verdade e
 * o servidor, nas RPCs `security definer`.
 */

export type FriendStatus = 'pending' | 'accepted';

/** De quem partiu o pedido, visto de quem esta olhando a tela. */
export type FriendDirection = 'incoming' | 'outgoing';

export type FriendRow = {
  id: string;
  handle: string;
  status: FriendStatus;
  direction: FriendDirection;
  sharesStats: boolean;
  /** Nulo quando a pessoa nao compartilha — nao e "nao respondeu". */
  age: number | null;
  trainingYears: number | null;
};

export type FriendLists = {
  accepted: FriendRow[];
  incoming: FriendRow[];
  outgoing: FriendRow[];
};

/**
 * Separa as relacoes nas tres listas que a tela desenha.
 *
 * E o que decide qual botao cada linha mostra: um pedido recebido tem
 * aceitar/recusar, um enviado so tem cancelar. Por isso `direction` importa
 * tanto quanto `status`.
 */
export function splitFriends(rows: readonly FriendRow[]): FriendLists {
  const lists: FriendLists = { accepted: [], incoming: [], outgoing: [] };

  for (const row of rows) {
    if (row.status === 'accepted') lists.accepted.push(row);
    else if (row.direction === 'incoming') lists.incoming.push(row);
    else lists.outgoing.push(row);
  }

  lists.accepted.sort(byHandle);
  lists.incoming.sort(byHandle);
  lists.outgoing.sort(byHandle);

  return lists;
}

export type FrequencyRow = {
  handle: string;
  /** Dias treinados na semana, ou null quando a pessoa nao compartilha. */
  days: number | null;
};

/**
 * Ordena amigos por dias treinados na semana.
 *
 * Frequencia, e nao carga ou volume: dias treinados e comparavel entre
 * iniciante e avancado, e carga nao e — um ranking de carga so informaria quem
 * treina ha mais tempo.
 */
export function rankByFrequency<T extends FrequencyRow>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    // Quem nao compartilha vai para o fim, mas NAO vira zero: "nao compartilha"
    // nao e "ficou parado a semana toda", e empurrar os dois para o mesmo lugar
    // diria de alguem algo que nao se sabe.
    if (a.days === null || b.days === null) {
      if (a.days === b.days) return byHandle(a, b);
      return a.days === null ? 1 : -1;
    }

    if (a.days !== b.days) return b.days - a.days;
    return byHandle(a, b);
  });
}

/**
 * Ordem de dicionario, nao de code point: `localeCompare` e o que poe "ánia"
 * entre "ana" e "bia", em vez de depois de "z" — o acento cai fora do bloco
 * ASCII e uma comparacao crua o manda para o fim.
 */
function byHandle(a: { handle: string }, b: { handle: string }): number {
  return a.handle.localeCompare(b.handle, 'pt-BR');
}

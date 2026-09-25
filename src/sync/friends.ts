import type { FriendDirection, FriendRow, FriendStatus } from '@/domain/friends';

import { requireClient } from './requireClient';

/**
 * Leitura e escrita das amizades.
 *
 * Mesma excecao documentada de `profile.ts`: isto fala com o Supabase direto,
 * porque amizade e dado social e nao tem par no SQLite — nao ha o que
 * sincronizar nem o que fazer offline.
 *
 * Ler o @handle de um amigo passa por `list_friends()`, uma funcao
 * `security definer`, e nao por um select em `profiles`: a policy de perfil e
 * "cada um le so o seu", e afrouxa-la exporia todo mundo a todo mundo.
 */

/** O que `request_friendship` responde. Cada codigo vira outra frase na tela. */
export type RequestResult = 'ok' | 'not-found' | 'already' | 'self' | 'unauthenticated';

type Row = {
  id: string;
  handle: string;
  status: FriendStatus;
  direction: FriendDirection;
  shares_stats: boolean;
  age: number | null;
  training_years: number | null;
};

export async function listFriends(): Promise<FriendRow[]> {
  const client = requireClient();

  const { data, error } = await client.rpc('list_friends', {});
  if (error) throw new Error(error.message);

  return ((data ?? []) as Row[]).map(toFriend);
}

export async function requestFriendship(handle: string): Promise<RequestResult> {
  const client = requireClient();

  const { data, error } = await client.rpc('request_friendship', { target_handle: handle });
  if (error) throw new Error(error.message);

  return data as RequestResult;
}

/**
 * Aceitar e um update; recusar e um delete.
 *
 * Recusa nao vira status: guardar "recusado" deixaria o pedido morando na
 * tabela para sempre e, por causa do indice do par, impediria a pessoa de
 * pedir de novo mais tarde.
 */
export async function respondFriendship(
  userId: string,
  requesterId: string,
  accept: boolean,
): Promise<void> {
  const client = requireClient();

  const { error } = accept
    ? await client
        .from('friendships')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('requester_id', requesterId)
        .eq('addressee_id', userId)
    : await client
        .from('friendships')
        .delete()
        .eq('requester_id', requesterId)
        .eq('addressee_id', userId);

  if (error) throw new Error(error.message);
}

/**
 * Desfaz a amizade (ou cancela o pedido) nas duas direcoes.
 *
 * So uma das duas linhas existe — o indice do par garante isso —, mas quem
 * desfaz nem sempre e quem pediu, e o RLS ja impede apagar relacao alheia.
 * Duas chamadas evitam montar um filtro `or` concatenando ids numa string.
 */
export async function removeFriendship(userId: string, otherId: string): Promise<void> {
  const client = requireClient();

  for (const [requester, addressee] of [
    [userId, otherId],
    [otherId, userId],
  ]) {
    const { error } = await client
      .from('friendships')
      .delete()
      .eq('requester_id', requester)
      .eq('addressee_id', addressee);

    if (error) throw new Error(error.message);
  }
}

function toFriend(row: Row): FriendRow {
  return {
    id: row.id,
    handle: row.handle,
    status: row.status,
    direction: row.direction,
    sharesStats: row.shares_stats,
    age: row.age,
    trainingYears: row.training_years,
  };
}

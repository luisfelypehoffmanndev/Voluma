import type {
  FriendDirection,
  FriendRow,
  FriendStatus,
  ValueRow,
  WeeklyDaysRow,
} from '@/domain/friends';
import { GYM } from '@/world';

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
  avatar_path: string | null;
  since: string;
  display_name: string | null;
};

export async function listFriends(): Promise<FriendRow[]> {
  const client = requireClient();

  const { data, error } = await client.rpc('list_friends', { gym: GYM });
  if (error) throw new Error(error.message);

  return ((data ?? []) as Row[]).map(toFriend);
}

type WeeklyDaysDbRow = {
  id: string;
  handle: string;
  shares: boolean;
  planned_days: number | null;
  week_start: string | null;
  days: number | null;
};

/**
 * Dias treinados por semana de cada amigo aceito, de `firstWeek` ate
 * `lastWeek` (chaves de domingo), mais a meta de dias da rotina.
 *
 * Os nulos de quem nao compartilha seguem nulos ate a tela — o corte e no
 * servidor, e a tela os mostra como "nao compartilha", nunca como zero.
 */
export async function weeklyDays(firstWeek: string, lastWeek: string): Promise<WeeklyDaysRow[]> {
  const client = requireClient();

  const { data, error } = await client.rpc('friend_weekly_days', {
    first_week: firstWeek,
    last_week: lastWeek,
    gym: GYM,
  });
  if (error) throw new Error(error.message);

  return ((data ?? []) as WeeklyDaysDbRow[]).map((row) => ({
    id: row.id,
    handle: row.handle,
    shares: row.shares,
    plannedDays: row.planned_days,
    weekStart: row.week_start,
    days: row.days,
  }));
}

/** Km corridos por cada amigo aceito no mes; `value` nulo sem o toggle. */
export async function monthlyDistance(
  monthStart: string,
  monthEnd: string,
): Promise<(ValueRow & { id: string })[]> {
  const client = requireClient();

  const { data, error } = await client.rpc('friend_monthly_distance', {
    month_start: monthStart,
    month_end: monthEnd,
    gym: GYM,
  });
  if (error) throw new Error(error.message);

  return ((data ?? []) as { id: string; handle: string; km: number | null }[]).map((row) => ({
    id: row.id,
    handle: row.handle,
    value: row.km,
  }));
}

export async function requestFriendship(handle: string): Promise<RequestResult> {
  const client = requireClient();

  const { data, error } = await client.rpc('request_friendship', {
    target_handle: handle,
    gym: GYM,
  });
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
        .eq('gym_id', GYM)
    : await client
        .from('friendships')
        .delete()
        .eq('requester_id', requesterId)
        .eq('addressee_id', userId)
        .eq('gym_id', GYM);

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
      .eq('addressee_id', addressee)
      .eq('gym_id', GYM);

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
    avatarPath: row.avatar_path,
    since: row.since,
    displayName: row.display_name,
  };
}

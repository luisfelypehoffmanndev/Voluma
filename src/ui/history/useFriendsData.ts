import { useCallback, useMemo } from 'react';

import { distanceByDate, listRoutines, volumeByDate } from '@/db/repo';
import { colorSlots, friendSeries } from '@/domain/friends';
import { volumeByWeek } from '@/domain/volume';
import { lastWeekKeys, monthRange, toDateKey, weekPlan } from '@/domain/week';
import { useQuery } from '@/store/data';
import { useFriends } from '@/store/friends';
import { useProfile } from '@/store/profile';
import { signedAvatarUrls } from '@/sync/avatar';
import { listFriends, monthlyDistance, weeklyDays } from '@/sync/friends';
import { people as palette } from '@/theme/tokens';

/** A mesma janela do grafico de volume dos Numeros: um ciclo de treino. */
export const WEEKS = 12;

/** Uma pessoa da aba Amigos — voce ou um amigo aceito — com tudo o que a tela mostra. */
export type FriendPerson = {
  /** O id da conta; `'self'` na sua linha. */
  id: string;
  handle: string;
  displayName: string | null;
  isSelf: boolean;
  /** Cor da pessoa nos graficos: laranja voce, a paleta os amigos. */
  color: string;
  avatarPath: string | null;
  avatarUri: string | null;
  /** Dias treinados por semana, da mais antiga a atual; null sem o toggle. */
  weeks: number[] | null;
  /** Dias da semana com treino no Plano — a meta. Null sem o toggle. */
  plannedDays: number | null;
  /** Km no mes corrente; null sem o toggle. */
  km: number | null;
};

export type FriendsData = {
  weekKeys: string[];
  /** 0–11, para o rotulo do card de corrida. */
  month: number;
  /** Voce primeiro, depois os amigos aceitos. */
  people: FriendPerson[];
};

export const SELF_ID = 'self';

/**
 * Os numeros da aba Amigos e da tela de cada amigo, numa consulta so.
 *
 * Os amigos vem ao vivo do servidor e nao passam pelo SQLite — e dado social,
 * nao tem o que fazer offline. Os seus vem do SQLite, pelas mesmas regras das
 * RPCs, e entram sem ir a rede.
 */
export function useFriendsData() {
  const profile = useProfile((state) => state.profile);

  const query = useQuery(
    useCallback(async () => {
      const now = new Date();
      const today = toDateKey(now);
      const weekKeys = lastWeekKeys(now, WEEKS);
      const month = monthRange(now);
      const ownPath = useProfile.getState().profile?.avatarPath ?? null;
      const cachedAccepted = useFriends.getState().lists.accepted;
      const cachedPaths = cachedAccepted.flatMap((friend) =>
        friend.avatarPath ? [friend.avatarPath] : [],
      );
      const urlsPromise = signedAvatarUrls(ownPath ? [...cachedPaths, ownPath] : cachedPaths);

      const [rows, distances, volumes, ownDistances, routines, relations, initialUrls] =
        await Promise.all([
          weeklyDays(weekKeys[0], weekKeys[WEEKS - 1]),
          monthlyDistance(month.start, month.end),
          volumeByDate(weekKeys[0], today),
          distanceByDate(month.start, today),
          listRoutines(),
          listFriends(),
          urlsPromise,
        ]);

      let ownKm = 0;
      for (const km of ownDistances.values()) ownKm += km;

      // A cor de cada amigo sai da ordem em que a amizade comecou, e nao da
      // posicao no ranking: a mesma pessoa tem a mesma cor em toda tela.
      const accepted = relations.filter((relation) => relation.status === 'accepted');
      const slots = colorSlots(accepted, palette.friends.length);
      const byId = new Map(accepted.map((friend) => [friend.id, friend]));
      const kmById = new Map(distances.map((row) => [row.id, row.value]));

      const missingPaths = accepted
        .flatMap((friend) => (friend.avatarPath ? [friend.avatarPath] : []))
        .filter((path) => !initialUrls.has(path));

      let urls = initialUrls;
      if (missingPaths.length > 0) {
        const extraUrls = await signedAvatarUrls(missingPaths);
        urls = new Map([...initialUrls, ...extraUrls]);
      }

      const friends: FriendPerson[] = friendSeries(rows, weekKeys).map((series) => {
        const relation = byId.get(series.id);
        const avatarPath = relation?.avatarPath ?? null;
        return {
          id: series.id,
          handle: series.handle,
          displayName: relation?.displayName ?? null,
          isSelf: false,
          color: palette.friends[slots.get(series.id) ?? 0],
          avatarPath,
          avatarUri: avatarPath ? (urls.get(avatarPath) ?? null) : null,
          weeks: series.weeks,
          plannedDays: series.plannedDays,
          km: kmById.get(series.id) ?? null,
        };
      });

      return {
        weekKeys,
        month: now.getMonth(),
        friends,
        urls,
        self: {
          weeks: volumeByWeek(volumes, now, WEEKS).map((week) => week.workouts.length),
          plannedDays: weekPlan(routines).filter((routine) => routine !== null).length,
          // Uma casa, como o servidor: somar 0,1 dez vezes nao da 1.
          km: Math.round(ownKm * 10) / 10,
        },
      };
    }, []),
    // Dado de rede: uma serie marcada no treino nao pode refazer a chamada ao
    // servidor. O foco e o "Tentar de novo" ainda recarregam.
    { liveUpdates: false },
  );

  // A sua linha fora da consulta: o perfil (nome, @, foto) chega por outro
  // caminho e pode mudar depois dela.
  const handle = profile?.handle ?? '';
  const displayName = profile?.displayName ?? null;
  const avatarPath = profile?.avatarPath ?? null;
  const raw = query.data;

  const data = useMemo<FriendsData | null>(() => {
    if (!raw) return null;
    const self: FriendPerson = {
      id: SELF_ID,
      handle,
      displayName,
      isSelf: true,
      color: palette.self,
      avatarPath,
      avatarUri: avatarPath ? (raw.urls.get(avatarPath) ?? null) : null,
      weeks: raw.self.weeks,
      plannedDays: raw.self.plannedDays,
      km: raw.self.km,
    };
    return { weekKeys: raw.weekKeys, month: raw.month, people: [self, ...raw.friends] };
  }, [raw, handle, displayName, avatarPath]);

  return { data, error: query.error, reload: query.reload };
}

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
 * Ordena pela medida de `value`, maior primeiro — dias treinados, km, semanas
 * com a meta.
 *
 * Nenhuma dessas medidas e carga ou volume: comparar carga entre iniciante e
 * avancado so informaria quem treina ha mais tempo.
 */
export function rankByValue<T extends { handle: string }>(
  rows: readonly T[],
  value: (row: T) => number | null,
): T[] {
  return [...rows].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    // Quem nao compartilha vai para o fim, mas NAO vira zero: "nao compartilha"
    // nao e "ficou parado", e empurrar os dois para o mesmo lugar diria de
    // alguem algo que nao se sabe.
    if (left === null || right === null) {
      if (left === right) return byHandle(a, b);
      return left === null ? 1 : -1;
    }

    if (left !== right) return right - left;
    return byHandle(a, b);
  });
}

/** Ordena amigos por dias treinados na semana. */
export function rankByFrequency<T extends FrequencyRow>(rows: readonly T[]): T[] {
  return rankByValue(rows, (row) => row.days);
}

/** Uma pessoa e a medida dela, ou null quando nao compartilha. */
export type ValueRow = { handle: string; value: number | null };

export type RankingRow = ValueRow & { isSelf: boolean };

/**
 * O ranking com voce dentro, ordenado pela mesma regra dos amigos.
 *
 * Sem amigos devolve vazio, e nao uma lista so com voce: um ranking de um e o
 * estado "adicione amigos", nao um podio.
 */
export function rankWithSelf(
  friends: readonly ValueRow[],
  self: { handle: string; value: number },
): RankingRow[] {
  if (friends.length === 0) return [];

  return rankByValue(
    [...friends.map((friend) => ({ ...friend, isSelf: false })), { ...self, isSelf: true }],
    (row) => row.value,
  );
}

/** Uma linha de `friend_weekly_days`, ja com nomes do app. */
export type WeeklyDaysRow = {
  handle: string;
  shares: boolean;
  /** Dias da semana com rotina no Plano; null sem o toggle. */
  plannedDays: number | null;
  /** Domingo da semana; null na linha de quem nao compartilha ou nao treinou. */
  weekStart: string | null;
  days: number | null;
};

export type FriendSeries = {
  handle: string;
  plannedDays: number | null;
  /** Dias treinados por semana, na ordem pedida; null sem o toggle. */
  weeks: number[] | null;
};

/**
 * Junta as linhas do servidor numa serie por pessoa, na ordem de `weekKeys`.
 *
 * O servidor so manda semana COM treino; as outras viram zero aqui, senao a
 * barra daquela semana sumiria e as seguintes andariam de lugar. Semana fora
 * da lista e ignorada.
 */
export function friendSeries(
  rows: readonly WeeklyDaysRow[],
  weekKeys: readonly string[],
): FriendSeries[] {
  const position = new Map(weekKeys.map((key, index) => [key, index]));
  const byHandle = new Map<string, FriendSeries>();

  for (const row of rows) {
    let series = byHandle.get(row.handle);
    if (!series) {
      series = {
        handle: row.handle,
        plannedDays: row.shares ? row.plannedDays : null,
        weeks: row.shares ? weekKeys.map(() => 0) : null,
      };
      byHandle.set(row.handle, series);
    }

    const index = row.weekStart === null ? undefined : position.get(row.weekStart);
    if (series.weeks && index !== undefined) series.weeks[index] = row.days ?? 0;
  }

  return [...byHandle.values()];
}

/** Semana fechada (bateu a meta), perdida, ou a atual ainda em andamento. */
export type WeekGoal = 'closed' | 'missed' | 'open';

export type Consistency = {
  weeks: WeekGoal[];
  /** Semanas que bateram a meta. */
  count: number;
  /** Semanas que ja valem na conta: todas menos a atual em andamento. */
  of: number;
};

/**
 * Quantas semanas bateram a meta de dias — a meta sao os dias da rotina.
 *
 * A ultima semana e a atual: abaixo da meta ela esta em andamento, nao
 * perdida, e fica fora da conta ate fechar. Sem plano nao ha meta, e a
 * resposta e null — "sem plano", nao "zero semanas".
 *
 * Aplica o plano de HOJE as semanas passadas: o banco nao guarda o historico
 * do plano, e quem mudou de rotina ve as semanas antigas pela meta nova.
 */
export function closedWeeks(
  weeks: readonly number[],
  plannedDays: number | null,
): Consistency | null {
  if (!plannedDays) return null;

  const last = weeks.length - 1;
  const goals = weeks.map((days, index): WeekGoal => {
    if (days >= plannedDays) return 'closed';
    return index === last ? 'open' : 'missed';
  });

  return {
    weeks: goals,
    count: goals.filter((goal) => goal === 'closed').length,
    of: goals.filter((goal) => goal !== 'open').length,
  };
}

/**
 * Ordem de dicionario, nao de code point: `localeCompare` e o que poe "ánia"
 * entre "ana" e "bia", em vez de depois de "z" — o acento cai fora do bloco
 * ASCII e uma comparacao crua o manda para o fim.
 */
function byHandle(a: { handle: string }, b: { handle: string }): number {
  return a.handle.localeCompare(b.handle, 'pt-BR');
}

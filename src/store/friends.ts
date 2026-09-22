import { AppState, type NativeEventSubscription } from 'react-native';
import { create } from 'zustand';

import { splitFriends, type FriendLists, type FriendRow } from '@/domain/friends';
import {
  listFriends,
  removeFriendship,
  requestFriendship,
  respondFriendship,
  type RequestResult,
} from '@/sync/friends';
import { UNDO_WINDOW } from '@/theme/tokens';

/**
 * Amigos de quem esta logado.
 *
 * Store proprio, irmao de `useProfile`: amizade e outro assunto, some junto com
 * a conta e nao tem nada a ver com o outbox do SQLite.
 *
 * `applySession` (src/sync/auth.ts) liga isto ao ciclo de vida — carrega ao
 * entrar, limpa ao sair.
 */

const EMPTY: FriendLists = { accepted: [], incoming: [], outgoing: [] };

/**
 * Uma remocao esperando a janela do "Desfazer" fechar.
 *
 * A escrita no servidor e ADIADA, e nao desfeita depois: o RLS da v6 so deixa o
 * `requester` inserir, entao quem recusa um pedido nao conseguiria recria-lo, e
 * "desfazer" uma amizade viraria um pedido novo que a outra pessoa teria que
 * aceitar de novo. Adiando, "Desfazer" e simplesmente nao mandar nada.
 *
 * Guarda a linha inteira, nao so os ids, para desfazer sem ir ao servidor.
 */
export type PendingRemoval = {
  /** Muda a cada remocao, para a tela saber que e outra oferta de desfazer. */
  id: number;
  kind: 'respond' | 'remove';
  userId: string;
  otherId: string;
  row: FriendRow | null;
};

type FriendsState = {
  lists: FriendLists;
  loading: boolean;
  error: string | null;
  pendingRemoval: PendingRemoval | null;

  load: () => Promise<void>;
  request: (handle: string) => Promise<RequestResult | 'error'>;
  /**
   * Aceitar vai direto ao servidor. Recusar some da tela na hora e so e
   * gravado quando a janela do "Desfazer" fecha.
   */
  respond: (userId: string, requesterId: string, accept: boolean) => Promise<void>;
  /** Cancelar pedido ou desfazer amizade — adiado como a recusa. */
  remove: (userId: string, otherId: string) => void;
  /** Grava agora o que estiver pendente. Sem pendencia, nao faz nada. */
  commitPending: () => Promise<void>;
  /** Devolve a linha a tela e nao manda nada ao servidor. */
  undoPending: () => void;
  clear: () => void;
};

// Fora do estado do zustand: nao e nada que a tela desenhe.
let timer: ReturnType<typeof setTimeout> | null = null;
let background: NativeEventSubscription | null = null;
let nextId = 1;

function disarm() {
  if (timer) clearTimeout(timer);
  timer = null;
  background?.remove();
  background = null;
}

export const useFriends = create<FriendsState>((set, get) => {
  /**
   * Tira a linha da tela e arma o relogio.
   *
   * Uma remocao pendente por vez: se ja havia outra esperando, ela e gravada
   * ANTES de armar a nova — senao a primeira janela se perderia em silencio.
   */
  function defer(kind: PendingRemoval['kind'], userId: string, otherId: string) {
    if (get().pendingRemoval) void get().commitPending();

    const { lists } = get();
    const row = allRows(lists).find((candidate) => candidate.id === otherId) ?? null;

    set({
      lists: without(lists, otherId),
      pendingRemoval: { id: nextId++, kind, userId, otherId, row },
    });

    timer = setTimeout(() => void get().commitPending(), UNDO_WINDOW);
    // Fechar o app no meio da janela nao pode engolir a acao: o relogio nao
    // sobrevive ao processo, entao grava ja ao ir para segundo plano.
    background = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void get().commitPending();
    });
  }

  return {
    lists: EMPTY,
    loading: false,
    error: null,
    pendingRemoval: null,

    load: async () => {
      set({ loading: true, error: null });
      try {
        const lists = splitFriends(await listFriends());
        // A linha pendente ainda existe no servidor ate a janela fechar; sem
        // este filtro, qualquer recarga no meio dela a traria de volta.
        const pending = get().pendingRemoval;
        set({ lists: pending ? without(lists, pending.otherId) : lists });
      } catch (error) {
        set({ error: message(error) });
      } finally {
        // No finally: `loading` preso em true deixaria a tela girando para sempre
        // depois de uma falha de rede.
        set({ loading: false });
      }
    },

    request: async (handle) => {
      set({ loading: true, error: null });
      try {
        const result = await requestFriendship(handle);
        // So recarrega quando alguma linha nasceu. Depois de "nao existe esse @"
        // a lista e a mesma, e buscar de novo so gastaria rede.
        if (result === 'ok') await get().load();
        return result;
      } catch (error) {
        set({ error: message(error) });
        return 'error';
      } finally {
        set({ loading: false });
      }
    },

    respond: async (userId, requesterId, accept) => {
      // Aceitar nao tem desfazer: voltar de aceito para pendente nao seria
      // "desfazer o aceite", seria uma acao nova.
      if (!accept) {
        defer('respond', userId, requesterId);
        return;
      }

      set({ loading: true, error: null });
      try {
        await respondFriendship(userId, requesterId, true);
        await get().load();
      } catch (error) {
        set({ error: message(error) });
      } finally {
        set({ loading: false });
      }
    },

    remove: (userId, otherId) => defer('remove', userId, otherId),

    commitPending: async () => {
      const pending = get().pendingRemoval;
      if (!pending) return;

      // Solta a pendencia ANTES de ir a rede: o relogio, o segundo plano e a
      // saida da tela podem pedir o commit quase juntos, e so um deve escrever.
      disarm();
      set({ pendingRemoval: null });

      try {
        if (pending.kind === 'respond') {
          await respondFriendship(pending.userId, pending.otherId, false);
        } else {
          await removeFriendship(pending.userId, pending.otherId);
        }
      } catch (error) {
        // Nada mudou no servidor, entao a linha volta: a tela nao pode dizer
        // que alguem saiu da lista quando nao saiu.
        if (pending.row) set({ lists: withRow(get().lists, pending.row) });
        set({ error: message(error) });
      }
    },

    undoPending: () => {
      const pending = get().pendingRemoval;
      if (!pending) return;

      disarm();
      set({
        pendingRemoval: null,
        lists: pending.row ? withRow(get().lists, pending.row) : get().lists,
      });
    },

    // Descarta a pendencia SEM gravar: no sign-out, a remocao era intencao de
    // quem saiu, nao da proxima pessoa a entrar no aparelho.
    clear: () => {
      disarm();
      set({ lists: EMPTY, loading: false, error: null, pendingRemoval: null });
    },
  };
});

function allRows(lists: FriendLists): FriendRow[] {
  return [...lists.accepted, ...lists.incoming, ...lists.outgoing];
}

function without(lists: FriendLists, id: string): FriendLists {
  return splitFriends(allRows(lists).filter((row) => row.id !== id));
}

/** Devolve a linha pela mesma regra do servidor, na mesma ordem. */
function withRow(lists: FriendLists, row: FriendRow): FriendLists {
  return splitFriends([...allRows(lists).filter((other) => other.id !== row.id), row]);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível carregar os amigos';
}

import { AppState } from 'react-native';

import type { FriendRow } from '@/domain/friends';
import { UNDO_WINDOW } from '@/theme/tokens';

import { useFriends } from '../friends';

jest.mock('@/sync/friends', () => ({
  listFriends: jest.fn(),
  requestFriendship: jest.fn(),
  respondFriendship: jest.fn(),
  removeFriendship: jest.fn(),
}));

const sync = jest.requireMock('@/sync/friends') as {
  listFriends: jest.Mock;
  requestFriendship: jest.Mock;
  respondFriendship: jest.Mock;
  removeFriendship: jest.Mock;
};

function makeRow(overrides: Partial<FriendRow> = {}): FriendRow {
  return {
    id: 'u2',
    handle: 'bia',
    status: 'accepted',
    direction: 'outgoing',
    sharesStats: false,
    age: null,
    trainingYears: null,
    avatarPath: null,
    since: '2026-09-01T10:00:00+00:00',
    displayName: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  useFriends.getState().clear();
});

describe('load', () => {
  it('guarda as linhas ja separadas em listas', async () => {
    sync.listFriends.mockResolvedValue([
      makeRow({ id: 'u2', handle: 'ana', status: 'accepted' }),
      makeRow({ id: 'u3', handle: 'bia', status: 'pending', direction: 'incoming' }),
    ]);

    await useFriends.getState().load();

    const { lists } = useFriends.getState();
    expect(lists.accepted.map((row) => row.handle)).toEqual(['ana']);
    expect(lists.incoming.map((row) => row.handle)).toEqual(['bia']);
  });

  it('guarda o erro e sai de loading quando a rede falha', async () => {
    sync.listFriends.mockRejectedValue(new Error('Sem conexão'));

    await useFriends.getState().load();

    expect(useFriends.getState().error).toBe('Sem conexão');
    expect(useFriends.getState().loading).toBe(false);
  });
});

describe('request', () => {
  it('recarrega a lista quando o pedido foi aceito pelo servidor', async () => {
    sync.requestFriendship.mockResolvedValue('ok');
    sync.listFriends.mockResolvedValue([]);

    expect(await useFriends.getState().request('bia')).toBe('ok');
    expect(sync.listFriends).toHaveBeenCalled();
  });

  // Recarregar depois de "nao existe esse @" so gastaria uma chamada de rede
  // para receber de volta a mesma lista.
  it('nao recarrega quando o servidor recusou o pedido', async () => {
    sync.requestFriendship.mockResolvedValue('not-found');

    expect(await useFriends.getState().request('ninguem')).toBe('not-found');
    expect(sync.listFriends).not.toHaveBeenCalled();
  });

  it('devolve erro quando a rede falha, sem derrubar a tela', async () => {
    sync.requestFriendship.mockRejectedValue(new Error('Sem conexão'));

    expect(await useFriends.getState().request('bia')).toBe('error');
  });
});

describe('respond', () => {
  it('aceitar vai direto ao servidor e recarrega a lista', async () => {
    sync.respondFriendship.mockResolvedValue(undefined);
    sync.listFriends.mockResolvedValue([]);

    await useFriends.getState().respond('me', 'u2', true);

    expect(sync.respondFriendship).toHaveBeenCalledWith('me', 'u2', true);
    expect(sync.listFriends).toHaveBeenCalled();
  });
});

/**
 * Recusar, cancelar e desfazer sao ADIADOS, nao invertidos depois: o RLS da v6
 * so deixa o `requester` inserir, entao quem recusou nao conseguiria recriar o
 * pedido. "Desfazer" tem que ser "nao mandar nada".
 */
describe('remocao adiada', () => {
  const ana = makeRow({ id: 'u2', handle: 'ana', status: 'accepted' });
  const bia = makeRow({ id: 'u3', handle: 'bia', status: 'pending', direction: 'incoming' });
  const caio = makeRow({ id: 'u4', handle: 'caio', status: 'pending', direction: 'outgoing' });

  beforeEach(async () => {
    jest.useFakeTimers();
    sync.listFriends.mockResolvedValue([ana, bia, caio]);
    sync.respondFriendship.mockResolvedValue(undefined);
    sync.removeFriendship.mockResolvedValue(undefined);
    await useFriends.getState().load();
    sync.listFriends.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function handles() {
    const { lists } = useFriends.getState();
    return [...lists.accepted, ...lists.incoming, ...lists.outgoing].map((row) => row.handle);
  }

  it('recusar tira a linha na hora, sem falar com o servidor ainda', () => {
    void useFriends.getState().respond('me', 'u3', false);

    expect(useFriends.getState().lists.incoming).toEqual([]);
    expect(useFriends.getState().pendingRemoval).toMatchObject({ kind: 'respond', row: bia });
    expect(sync.respondFriendship).not.toHaveBeenCalled();
  });

  it('cancelar e desfazer tiram a linha na hora, sem falar com o servidor ainda', () => {
    useFriends.getState().remove('me', 'u4');
    expect(useFriends.getState().lists.outgoing).toEqual([]);

    useFriends.getState().undoPending();
    useFriends.getState().remove('me', 'u2');
    expect(useFriends.getState().lists.accepted).toEqual([]);

    expect(sync.removeFriendship).not.toHaveBeenCalled();
  });

  it('grava quando a janela fecha sem ninguem tocar em desfazer', () => {
    void useFriends.getState().respond('me', 'u3', false);

    jest.advanceTimersByTime(UNDO_WINDOW - 1);
    expect(sync.respondFriendship).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(sync.respondFriendship).toHaveBeenCalledWith('me', 'u3', false);
    expect(useFriends.getState().pendingRemoval).toBeNull();
  });

  it('desfazer dentro da janela devolve a linha e nunca fala com o servidor', () => {
    useFriends.getState().remove('me', 'u2');

    useFriends.getState().undoPending();
    jest.advanceTimersByTime(UNDO_WINDOW * 2);

    expect(useFriends.getState().lists.accepted).toEqual([ana]);
    expect(useFriends.getState().pendingRemoval).toBeNull();
    expect(sync.removeFriendship).not.toHaveBeenCalled();
  });

  it('uma segunda remocao grava a primeira antes de armar a nova', () => {
    useFriends.getState().remove('me', 'u4');
    useFriends.getState().remove('me', 'u2');

    expect(sync.removeFriendship).toHaveBeenCalledTimes(1);
    expect(sync.removeFriendship).toHaveBeenCalledWith('me', 'u4');
    expect(useFriends.getState().pendingRemoval).toMatchObject({ kind: 'remove', otherId: 'u2' });
    expect(handles()).toEqual(['bia']);

    jest.advanceTimersByTime(UNDO_WINDOW);
    expect(sync.removeFriendship).toHaveBeenCalledTimes(2);
    expect(sync.removeFriendship).toHaveBeenLastCalledWith('me', 'u2');
  });

  it('commitPending grava antes do relogio, e o relogio nao grava de novo', async () => {
    useFriends.getState().remove('me', 'u4');

    await useFriends.getState().commitPending();
    expect(sync.removeFriendship).toHaveBeenCalledWith('me', 'u4');

    jest.advanceTimersByTime(UNDO_WINDOW);
    expect(sync.removeFriendship).toHaveBeenCalledTimes(1);
  });

  // Fechar o app no meio da janela: o relogio nao sobrevive ao processo.
  it('grava ao ir para segundo plano', () => {
    const listeners: ((state: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
      listeners.push(listener as (state: string) => void);
      return { remove: jest.fn() } as never;
    });

    useFriends.getState().remove('me', 'u2');
    listeners.forEach((listener) => listener('background'));

    expect(sync.removeFriendship).toHaveBeenCalledWith('me', 'u2');
  });

  it('uma recarga no meio da janela nao traz a linha de volta', async () => {
    useFriends.getState().remove('me', 'u2');

    // O servidor ainda tem a linha: a remocao so sai quando a janela fechar.
    await useFriends.getState().load();

    expect(handles()).toEqual(['bia', 'caio']);
  });

  it('falha ao gravar devolve a linha e mostra o erro', async () => {
    sync.removeFriendship.mockRejectedValue(new Error('Sem conexão'));
    useFriends.getState().remove('me', 'u2');

    await useFriends.getState().commitPending();

    expect(useFriends.getState().lists.accepted).toEqual([ana]);
    expect(useFriends.getState().error).toBe('Sem conexão');
  });

  // No sign-out a remocao era intencao de quem saiu, nao da proxima pessoa.
  it('clear descarta a pendencia sem gravar', () => {
    useFriends.getState().remove('me', 'u2');

    useFriends.getState().clear();
    jest.advanceTimersByTime(UNDO_WINDOW);

    expect(useFriends.getState().pendingRemoval).toBeNull();
    expect(sync.removeFriendship).not.toHaveBeenCalled();
  });
});

/**
 * O signOut apaga o banco local; sem limpar este store junto, a lista de amigos
 * de uma conta continuaria na tela para a proxima pessoa que entrasse no
 * aparelho. Mesma armadilha do perfil, no item 11.
 */
describe('clear', () => {
  it('zera listas e erro', async () => {
    sync.listFriends.mockResolvedValue([makeRow()]);
    await useFriends.getState().load();

    useFriends.getState().clear();

    const { lists, error } = useFriends.getState();
    expect(lists.accepted).toEqual([]);
    expect(lists.incoming).toEqual([]);
    expect(lists.outgoing).toEqual([]);
    expect(error).toBeNull();
  });
});

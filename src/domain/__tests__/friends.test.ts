import { rankByFrequency, splitFriends, type FriendRow } from '../friends';

function makeRow(overrides: Partial<FriendRow> = {}): FriendRow {
  return {
    id: 'u2',
    handle: 'bia',
    status: 'accepted',
    direction: 'outgoing',
    sharesStats: false,
    age: null,
    trainingYears: null,
    ...overrides,
  };
}

describe('splitFriends', () => {
  it('devolve as tres listas vazias quando nao ha ninguem', () => {
    expect(splitFriends([])).toEqual({ accepted: [], incoming: [], outgoing: [] });
  });

  it('poe a amizade aceita so em accepted', () => {
    const { accepted, incoming, outgoing } = splitFriends([makeRow({ status: 'accepted' })]);

    expect(accepted).toHaveLength(1);
    expect(incoming).toHaveLength(0);
    expect(outgoing).toHaveLength(0);
  });

  // A direcao e o que decide qual botao a linha mostra: aceitar/recusar num
  // pedido recebido, cancelar num enviado.
  it('pedido recebido vai para incoming', () => {
    const { incoming, outgoing } = splitFriends([
      makeRow({ status: 'pending', direction: 'incoming' }),
    ]);

    expect(incoming).toHaveLength(1);
    expect(outgoing).toHaveLength(0);
  });

  it('pedido enviado vai para outgoing', () => {
    const { incoming, outgoing } = splitFriends([
      makeRow({ status: 'pending', direction: 'outgoing' }),
    ]);

    expect(outgoing).toHaveLength(1);
    expect(incoming).toHaveLength(0);
  });

  it('ordena os aceitos por handle', () => {
    const { accepted } = splitFriends([
      makeRow({ id: 'u3', handle: 'carla' }),
      makeRow({ id: 'u2', handle: 'ana' }),
      makeRow({ id: 'u4', handle: 'bia' }),
    ]);

    expect(accepted.map((row) => row.handle)).toEqual(['ana', 'bia', 'carla']);
  });

  // Ordenar por code point poria "ánia" depois de "bia", porque o acento cai
  // fora do bloco ASCII. Quem le a lista espera ordem de dicionario.
  it('ordena com acento no lugar certo, nao por code point', () => {
    const { accepted } = splitFriends([
      makeRow({ id: 'u4', handle: 'bia' }),
      makeRow({ id: 'u3', handle: 'ánia' }),
      makeRow({ id: 'u2', handle: 'ana' }),
    ]);

    expect(accepted.map((row) => row.handle)).toEqual(['ana', 'ánia', 'bia']);
  });

  it('separa os tres tipos na mesma chamada', () => {
    const { accepted, incoming, outgoing } = splitFriends([
      makeRow({ id: 'u2', handle: 'ana', status: 'accepted' }),
      makeRow({ id: 'u3', handle: 'bia', status: 'pending', direction: 'incoming' }),
      makeRow({ id: 'u4', handle: 'carla', status: 'pending', direction: 'outgoing' }),
    ]);

    expect(accepted.map((row) => row.handle)).toEqual(['ana']);
    expect(incoming.map((row) => row.handle)).toEqual(['bia']);
    expect(outgoing.map((row) => row.handle)).toEqual(['carla']);
  });
});

describe('rankByFrequency', () => {
  it('devolve vazio quando nao ha amigos', () => {
    expect(rankByFrequency([])).toEqual([]);
  });

  it('poe quem treinou mais dias primeiro', () => {
    const ranked = rankByFrequency([
      { handle: 'ana', days: 2 },
      { handle: 'bia', days: 5 },
      { handle: 'carla', days: 3 },
    ]);

    expect(ranked.map((row) => row.handle)).toEqual(['bia', 'carla', 'ana']);
  });

  it('desempata por handle, para a ordem nao pular entre duas leituras iguais', () => {
    const ranked = rankByFrequency([
      { handle: 'carla', days: 3 },
      { handle: 'ana', days: 3 },
    ]);

    expect(ranked.map((row) => row.handle)).toEqual(['ana', 'carla']);
  });

  // Quem nao compartilha nao e quem ficou parado: tratar ausencia de dado como
  // zero poria essa pessoa em ultimo lugar como se nao tivesse treinado.
  it('joga quem nao compartilha para o fim, sem virar zero', () => {
    const ranked = rankByFrequency([
      { handle: 'ana', days: null },
      { handle: 'bia', days: 0 },
      { handle: 'carla', days: 4 },
    ]);

    expect(ranked.map((row) => row.handle)).toEqual(['carla', 'bia', 'ana']);
  });

  it('mantem days nulo em vez de converter', () => {
    const [ultimo] = rankByFrequency([{ handle: 'ana', days: null }]);
    expect(ultimo.days).toBeNull();
  });

  it('ordena quem nao compartilha entre si por handle', () => {
    const ranked = rankByFrequency([
      { handle: 'carla', days: null },
      { handle: 'ana', days: null },
    ]);

    expect(ranked.map((row) => row.handle)).toEqual(['ana', 'carla']);
  });
});

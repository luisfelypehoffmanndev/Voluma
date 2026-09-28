import {
  closedWeeks,
  colorSlots,
  firstName,
  friendSeries,
  rankByFrequency,
  rankByValue,
  rankWithSelf,
  rankingLabels,
  splitFriends,
  type FriendRow,
  type WeeklyDaysRow,
} from '../friends';

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

describe('rankByValue', () => {
  const km = (row: { value: number | null }) => row.value;

  it('ordena valores decimais, maior primeiro', () => {
    const ranked = rankByValue(
      [
        { handle: 'ana', value: 12.4 },
        { handle: 'bia', value: 12.5 },
        { handle: 'carla', value: 3 },
      ],
      km,
    );

    expect(ranked.map((row) => row.handle)).toEqual(['bia', 'ana', 'carla']);
  });

  it('nulo vai para o fim sem virar zero, empate desempata por handle', () => {
    const ranked = rankByValue(
      [
        { handle: 'carla', value: null },
        { handle: 'bia', value: 0 },
        { handle: 'ana', value: 0 },
      ],
      km,
    );

    expect(ranked.map((row) => row.handle)).toEqual(['ana', 'bia', 'carla']);
  });

  it('nao altera a lista recebida', () => {
    const rows = [
      { handle: 'bia', value: 1 },
      { handle: 'ana', value: 5 },
    ];
    rankByValue(rows, km);
    expect(rows.map((row) => row.handle)).toEqual(['bia', 'ana']);
  });
});

describe('rankWithSelf', () => {
  const eu = { handle: 'luis', value: 3 };

  // Ranking de uma pessoa so nao compara nada: e o estado "adicione amigos".
  it('sem amigos devolve vazio, nem a sua linha', () => {
    expect(rankWithSelf([], eu)).toEqual([]);
  });

  it('te poe no lugar certo entre os amigos', () => {
    const ranked = rankWithSelf(
      [
        { handle: 'bia', value: 1 },
        { handle: 'ana', value: 5 },
      ],
      eu,
    );

    expect(ranked.map((row) => row.handle)).toEqual(['ana', 'luis', 'bia']);
  });

  it('no empate com um amigo, desempata por handle como entre amigos', () => {
    const ranked = rankWithSelf([{ handle: 'ana', value: 3 }], eu);
    expect(ranked.map((row) => row.handle)).toEqual(['ana', 'luis']);
  });

  // Zero e um dado ("nao treinei"); null e falta de dado ("nao compartilha").
  it('com zero fica acima de quem nao compartilha', () => {
    const ranked = rankWithSelf([{ handle: 'ana', value: null }], { handle: 'luis', value: 0 });
    expect(ranked.map((row) => row.handle)).toEqual(['luis', 'ana']);
  });

  it('marca exatamente uma linha como sua', () => {
    const ranked = rankWithSelf(
      [
        { handle: 'ana', value: 2 },
        { handle: 'bia', value: null },
      ],
      eu,
    );

    expect(ranked.filter((row) => row.isSelf).map((row) => row.handle)).toEqual(['luis']);
  });
});

function makeWeekRow(overrides: Partial<WeeklyDaysRow> = {}): WeeklyDaysRow {
  return {
    id: 'u-ana',
    handle: 'ana',
    shares: true,
    plannedDays: 3,
    weekStart: '2026-09-27',
    days: 2,
    ...overrides,
  };
}

describe('friendSeries', () => {
  const semanas = ['2026-09-13', '2026-09-20', '2026-09-27'];

  it('preenche com zero as semanas sem treino, na ordem das semanas', () => {
    const [ana] = friendSeries(
      [
        makeWeekRow({ weekStart: '2026-09-27', days: 4 }),
        makeWeekRow({ weekStart: '2026-09-13', days: 2 }),
      ],
      semanas,
    );

    expect(ana).toEqual({ id: 'u-ana', handle: 'ana', plannedDays: 3, weeks: [2, 0, 4] });
  });

  it('agrupa varias pessoas, uma serie por pessoa', () => {
    const series = friendSeries(
      [
        makeWeekRow({ weekStart: '2026-09-13', days: 1 }),
        makeWeekRow({
          id: 'u-bia',
          handle: 'bia',
          weekStart: '2026-09-20',
          days: 3,
          plannedDays: 2,
        }),
        makeWeekRow({ weekStart: '2026-09-20', days: 5 }),
      ],
      semanas,
    );

    expect(series).toEqual([
      { id: 'u-ana', handle: 'ana', plannedDays: 3, weeks: [1, 5, 0] },
      { id: 'u-bia', handle: 'bia', plannedDays: 2, weeks: [0, 3, 0] },
    ]);
  });

  // Agrupa pelo id: o @ e escolha da pessoa e pode mudar.
  it('duas pessoas com o mesmo @ nao se misturam', () => {
    const series = friendSeries(
      [makeWeekRow({ id: 'u-1', weekStart: '2026-09-13' }), makeWeekRow({ id: 'u-2' })],
      semanas,
    );

    expect(series.map((row) => row.id)).toEqual(['u-1', 'u-2']);
  });

  // O servidor manda uma linha sem semana para quem compartilha e nao treinou,
  // justamente para a pessoa nao sumir.
  it('quem compartilha e nao treinou vira tudo zero, nao some', () => {
    const series = friendSeries([makeWeekRow({ weekStart: null, days: null })], semanas);
    expect(series).toEqual([{ id: 'u-ana', handle: 'ana', plannedDays: 3, weeks: [0, 0, 0] }]);
  });

  it('quem nao compartilha fica com semanas e meta nulas', () => {
    const series = friendSeries(
      [makeWeekRow({ shares: false, plannedDays: null, weekStart: null, days: null })],
      semanas,
    );

    expect(series).toEqual([{ id: 'u-ana', handle: 'ana', plannedDays: null, weeks: null }]);
  });

  it('ignora semana fora da lista pedida', () => {
    const [ana] = friendSeries(
      [
        makeWeekRow({ weekStart: '2026-09-06', days: 7 }),
        makeWeekRow({ weekStart: '2026-09-20', days: 1 }),
      ],
      semanas,
    );

    expect(ana.weeks).toEqual([0, 1, 0]);
  });
});

describe('closedWeeks', () => {
  it('fecha a semana que bateu ou passou da meta', () => {
    expect(closedWeeks([3, 2, 4, 3], 3)).toEqual({
      weeks: ['closed', 'missed', 'closed', 'closed'],
      count: 3,
      of: 4,
    });
  });

  // Segunda-feira ninguem "falhou" a semana ainda: ela so conta quando fecha.
  it('semana atual abaixo da meta fica em andamento e nao entra no total', () => {
    expect(closedWeeks([3, 1], 3)).toEqual({
      weeks: ['closed', 'open'],
      count: 1,
      of: 1,
    });
  });

  it('semana atual que ja bateu a meta conta', () => {
    expect(closedWeeks([2, 3], 3)).toEqual({
      weeks: ['missed', 'closed'],
      count: 1,
      of: 2,
    });
  });

  it.each([0, null])('sem plano (meta %p) nao tem consistencia', (meta) => {
    expect(closedWeeks([3, 3], meta)).toBeNull();
  });

  it('sem semanas nao quebra', () => {
    expect(closedWeeks([], 3)).toEqual({ weeks: [], count: 0, of: 0 });
  });
});

describe('firstName', () => {
  it.each([
    ['Ana Souza', 'Ana'],
    ['  Bruno   Lima ', 'Bruno'],
    ['Luís', 'Luís'],
    ['', null],
    ['   ', null],
    [null, null],
  ])('%p vira %p', (full, first) => {
    expect(firstName(full)).toBe(first);
  });
});

describe('rankingLabels', () => {
  const pessoa = (id: string, handle: string, displayName: string | null) => ({
    id,
    handle,
    displayName,
  });

  it('mostra o primeiro nome, sem o @', () => {
    const labels = rankingLabels([pessoa('a', 'ana.s', 'Ana Souza')]);
    expect(labels.get('a')).toEqual({ title: 'Ana', subtitle: null });
  });

  it('sem nome, o @ vira o titulo', () => {
    const labels = rankingLabels([pessoa('a', 'ana.s', null)]);
    expect(labels.get('a')).toEqual({ title: '@ana.s', subtitle: null });
  });

  // Duas Anas no ranking seriam a mesma pessoa aos olhos de quem le.
  it('primeiro nome repetido ganha o @ embaixo, nos dois', () => {
    const labels = rankingLabels([
      pessoa('a', 'ana.s', 'Ana Souza'),
      pessoa('b', 'ana.l', 'Ana Lima'),
      pessoa('c', 'bruno', 'Bruno'),
    ]);

    expect(labels.get('a')).toEqual({ title: 'Ana', subtitle: '@ana.s' });
    expect(labels.get('b')).toEqual({ title: 'Ana', subtitle: '@ana.l' });
    expect(labels.get('c')).toEqual({ title: 'Bruno', subtitle: null });
  });

  it('a repeticao ignora maiuscula e acento', () => {
    const labels = rankingLabels([pessoa('a', 'x', 'Luís'), pessoa('b', 'y', 'luis')]);
    expect(labels.get('a')?.subtitle).toBe('@x');
    expect(labels.get('b')?.subtitle).toBe('@y');
  });
});

describe('colorSlots', () => {
  const amigo = (id: string, since: string) => ({ id, since });

  it('da as cores na ordem em que a amizade comecou', () => {
    const slots = colorSlots(
      [amigo('b', '2026-09-20T10:00:00Z'), amigo('a', '2026-09-01T10:00:00Z')],
      5,
    );

    expect(slots.get('a')).toBe(0);
    expect(slots.get('b')).toBe(1);
  });

  // A cor segue a pessoa: nao pode depender da ordem em que a lista chegou.
  it('a mesma pessoa tem a mesma cor em qualquer ordem de entrada', () => {
    const lista = [
      amigo('a', '2026-09-01T10:00:00Z'),
      amigo('b', '2026-09-10T10:00:00Z'),
      amigo('c', '2026-09-20T10:00:00Z'),
    ];

    expect(colorSlots(lista, 5)).toEqual(colorSlots([...lista].reverse(), 5));
  });

  it('um amigo novo nao repinta os antigos', () => {
    const antes = colorSlots(
      [amigo('a', '2026-09-01T10:00:00Z'), amigo('b', '2026-09-10T10:00:00Z')],
      5,
    );
    const depois = colorSlots(
      [
        amigo('a', '2026-09-01T10:00:00Z'),
        amigo('b', '2026-09-10T10:00:00Z'),
        amigo('c', '2026-09-28T10:00:00Z'),
      ],
      5,
    );

    expect(depois.get('a')).toBe(antes.get('a'));
    expect(depois.get('b')).toBe(antes.get('b'));
    expect(depois.get('c')).toBe(2);
  });

  it('passou do tamanho da paleta, volta ao comeco', () => {
    const slots = colorSlots(
      ['a', 'b', 'c'].map((id, index) => amigo(id, `2026-09-0${index + 1}T10:00:00Z`)),
      2,
    );

    expect([slots.get('a'), slots.get('b'), slots.get('c')]).toEqual([0, 1, 0]);
  });

  it('amizades do mesmo instante desempatam pelo id, para a ordem nao pular', () => {
    const slots = colorSlots(
      [amigo('z', '2026-09-01T10:00:00Z'), amigo('m', '2026-09-01T10:00:00Z')],
      5,
    );

    expect(slots.get('m')).toBe(0);
    expect(slots.get('z')).toBe(1);
  });
});

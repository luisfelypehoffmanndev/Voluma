import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import type { FriendPerson } from '../useFriendsData';
import { FriendsRanking } from '../FriendsRanking';

/**
 * O ranking da semana e onde a regra de privacidade encontra a tela: "nao
 * compartilha" nunca pode virar "0 dias", que diria que a pessoa ficou parada.
 */

function makePerson(overrides: Partial<FriendPerson> = {}): FriendPerson {
  return {
    id: 'u-ana',
    handle: 'teste_ana',
    displayName: 'Ana Souza',
    isSelf: false,
    color: '#29B6FF',
    avatarPath: null,
    avatarUri: null,
    weeks: [0, 0, 5],
    plannedDays: 3,
    km: 0,
    ...overrides,
  };
}

const eu = makePerson({
  id: 'self',
  handle: 'luis',
  displayName: 'Luis Felype',
  isSelf: true,
  color: '#FF5C00',
  weeks: [0, 0, 3],
});

async function setup(overrides: Partial<ComponentProps<typeof FriendsRanking>> = {}) {
  const onOpen = jest.fn();
  const onShare = jest.fn();
  await render(
    <FriendsRanking
      people={[eu, makePerson()]}
      selfShares
      onOpen={onOpen}
      onShare={onShare}
      {...overrides}
    />,
  );
  return { onOpen, onShare };
}

const linhas = () =>
  screen.getAllByLabelText(/^\d+º/).map((linha) => linha.props.accessibilityLabel as string);

describe('FriendsRanking', () => {
  it('ordena pelos dias desta semana, com a posicao', async () => {
    await setup({
      people: [eu, makePerson(), makePerson({ id: 'u-bia', handle: 'bia', displayName: 'Bia', weeks: [1] })],
    });

    expect(linhas()).toEqual(['1º, Ana, 5 dias', '2º, Você, 3 dias', '3º, Bia, 1 dia']);
  });

  it('mostra o primeiro nome, nao o @', async () => {
    await setup();

    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.queryByText('@teste_ana')).toBeNull();
    expect(screen.getByText('Você')).toBeTruthy();
  });

  it('sem nome, mostra o @', async () => {
    await setup({ people: [eu, makePerson({ displayName: null })] });
    expect(screen.getByText('@teste_ana')).toBeTruthy();
  });

  it('dois amigos com o mesmo primeiro nome ganham o @ embaixo', async () => {
    await setup({
      people: [
        eu,
        makePerson(),
        makePerson({ id: 'u-ana2', handle: 'ana.lima', displayName: 'Ana Lima', weeks: [2] }),
      ],
    });

    expect(screen.getByText('@teste_ana')).toBeTruthy();
    expect(screen.getByText('@ana.lima')).toBeTruthy();
  });

  // Nulo e "nao compartilha"; mostrar como zero diria que a pessoa ficou parada.
  it('quem nao compartilha fica fora do ranking, numa linha so, nunca como 0 dias', async () => {
    await setup({
      people: [eu, makePerson(), makePerson({ id: 'u-duda', handle: 'duda', displayName: 'Duda', weeks: null })],
    });

    expect(linhas()).toEqual(['1º, Ana, 5 dias', '2º, Você, 3 dias']);
    expect(screen.getByText('Duda não compartilha os números')).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('zero de quem compartilha continua zero', async () => {
    await setup({ people: [eu, makePerson({ weeks: [0] })] });
    expect(linhas()).toContain('2º, Ana, 0 dias');
  });

  it('tocar num amigo abre o detalhe dele', async () => {
    const { onOpen } = await setup();

    fireEvent.press(screen.getByLabelText('1º, Ana, 5 dias'));

    expect(onOpen).toHaveBeenCalledWith('u-ana');
  });

  it('a sua linha nao abre nada', async () => {
    const { onOpen } = await setup();

    fireEvent.press(screen.getByLabelText('2º, Você, 3 dias'));

    expect(onOpen).not.toHaveBeenCalled();
  });

  it('com o seu toggle desligado, avisa e leva ao Perfil', async () => {
    const { onShare } = await setup({ selfShares: false });

    fireEvent.press(screen.getByText('Seus amigos não veem seus números'));

    expect(onShare).toHaveBeenCalled();
  });

  it('com o toggle ligado, nao ha aviso', async () => {
    await setup({ selfShares: true });
    expect(screen.queryByText('Seus amigos não veem seus números')).toBeNull();
  });
});

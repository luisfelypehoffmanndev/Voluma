import { goBackOr } from '../navigation';

function fakeRouter(canGoBack: boolean) {
  return { canGoBack: jest.fn(() => canGoBack), back: jest.fn(), replace: jest.fn() };
}

describe('goBackOr', () => {
  it('volta quando ha tela atras', () => {
    const router = fakeRouter(true);
    goBackOr(router, '/profile');
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  // Sem tela atras, back() nao faz nada em producao e a pessoa fica presa.
  it('sem tela atras, vai para o destino de reserva', () => {
    const router = fakeRouter(false);
    goBackOr(router, '/profile');
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/profile');
  });
});

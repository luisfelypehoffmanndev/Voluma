import { redirectSystemPath } from '../../../app/+native-intent';
import { isAuthCallback } from '../authCallback';

describe('isAuthCallback', () => {
  it.each([
    'voluma://#access_token=abc&refresh_token=def&expires_in=3600',
    'voluma-teste://#access_token=abc',
    'voluma://?error=access_denied&error_code=403',
    '/#refresh_token=def',
  ])('%s e retorno de login', (url) => {
    expect(isAuthCallback(url)).toBe(true);
  });

  it.each(['voluma://', '/', '/session/abc', '/friend/u1?tab=numeros', '/profile'])(
    '%s e uma rota comum',
    (url) => {
      expect(isAuthCallback(url)).toBe(false);
    },
  );
});

// Navegar pelo retorno do login tirava o login da pilha no meio do fluxo, e o
// perfil ficava sozinho, sem ter para onde voltar ao salvar.
describe('redirectSystemPath', () => {
  it('com o app aberto, nao navega pelo retorno do login', () => {
    expect(redirectSystemPath({ path: 'voluma://#access_token=abc', initial: false })).toBeNull();
  });

  it('abrindo o app pelo retorno do login, cai na rota inicial', () => {
    expect(redirectSystemPath({ path: 'voluma://#access_token=abc', initial: true })).toBe('/');
  });

  it('deixa as outras rotas passarem como vieram', () => {
    expect(redirectSystemPath({ path: '/session/abc', initial: false })).toBe('/session/abc');
  });
});

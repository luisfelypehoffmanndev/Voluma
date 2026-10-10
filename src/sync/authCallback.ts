const AUTH_PARAMS = /[#?&](access_token|refresh_token|error|error_code)=/;

/**
 * O retorno do login com Google (`voluma://#access_token=…`), e nao uma rota.
 *
 * Quem consome esse link e o `signInWithGoogle` (src/sync/auth.ts), pela
 * sessao do navegador. Se o Expo Router tambem o tratasse como navegacao, ele
 * iria para `/` e tiraria o login da pilha no meio do fluxo.
 */
export function isAuthCallback(url: string): boolean {
  return AUTH_PARAMS.test(url);
}

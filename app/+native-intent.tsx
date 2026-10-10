import { isAuthCallback } from '@/sync/authCallback';

// O retorno do login chega por deep link, mas quem o consome e o signInWithGoogle:
// navegar por ele tiraria o login da pilha no meio do fluxo.
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (!isAuthCallback(path)) return path;
  return initial ? '/' : null;
}

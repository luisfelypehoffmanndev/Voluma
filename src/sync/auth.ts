import type { Session } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import { getQueryParams } from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { resetDb } from '@/db/client';
import { bumpData } from '@/store/data';

import {
  inFlightSync,
  invalidateSync,
  pendingCount,
  sync,
  type SyncOutcome,
} from './engine';
import { isCloudConfigured, supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

/**
 * Estado de conta e de sincronizacao.
 *
 * Sem nuvem configurada (`.env` vazio), `status` fica em `local` e o app
 * funciona inteiro offline. Nao ha tela de login bloqueando nada — o SQLite
 * ja e a fonte de verdade, a nuvem so acrescenta backup e segundo aparelho.
 */

export type AuthStatus = 'loading' | 'local' | 'signedOut' | 'signedIn';

/** O listener de sessao ativo, para nao acumular um por `bootstrap`. */
let authSubscription: { unsubscribe: () => void } | null = null;

type AuthState = {
  status: AuthStatus;
  email: string | null;
  syncing: boolean;
  lastSync: SyncOutcome | null;
  pending: number;

  bootstrap: () => Promise<void>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
  runSync: () => Promise<void>;
  refreshPending: () => Promise<void>;
};

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  email: null,
  syncing: false,
  lastSync: null,
  pending: 0,

  bootstrap: async () => {
    if (!supabase) {
      set({ status: 'local' });
      return;
    }

    const { data } = await supabase.auth.getSession();
    applySession(set, data.session);

    // Desinscreve o anterior antes de assinar de novo: `bootstrap` rodando duas
    // vezes (Fast Refresh, ou o hook montado de dois lugares) acumularia
    // listeners pelo resto da vida do app, cada um reprocessando todo evento.
    authSubscription?.unsubscribe();
    authSubscription = supabase.auth.onAuthStateChange((_event, session) =>
      applySession(set, session),
    ).data.subscription;

    await get().refreshPending();
    if (data.session) void get().runSync();
  },

  /**
   * Login com conta Google, unico jeito de entrar.
   *
   * Sem senha propria de proposito: uma senha a mais e uma senha a mais para
   * vazar, e o app nao tem por que guardar a de ninguem.
   */
  signInWithGoogle: async () => {
    if (!supabase) return 'Nuvem não configurada';

    // `voluma://`, o scheme do app.json. E o mesmo redirect no dev client e no
    // build de producao, e o unico que precisa estar liberado no Supabase.
    const redirectTo = makeRedirectUri();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) return translate(error.message);

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    // Desistir nao e falha: quem fechou a janela do Google nao precisa de uma
    // mensagem de erro na tela.
    if (result.type !== 'success') return null;

    const { params, errorCode } = getQueryParams(result.url);
    if (errorCode) return translate(errorCode);

    const { access_token, refresh_token } = params;
    if (!access_token || !refresh_token) return 'Não foi possível entrar';

    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (sessionError) return translate(sessionError.message);

    await get().runSync();
    return null;
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();

    // Pode haver um ciclo de sync no ar — o AppState dispara `runSync` sozinho
    // quando o app volta do background, que e justamente quando alguem abre o
    // Perfil. Esse ciclo ainda carrega o userId ANTIGO, e o INSERT do pull dele
    // cairia DEPOIS do resetDb, deixando no aparelho exatamente os dados que o
    // logout existe para apagar. Invalida (o pull desiste antes de escrever) e
    // espera ele morrer.
    invalidateSync();
    await inFlightSync()?.catch(() => undefined);

    // Limpa o banco local: deixar os dados de uma conta visiveis para a
    // proxima seria pior do que perder o cache, que o pull reconstroi.
    await resetDb();
    bumpData();
    set({ status: 'signedOut', email: null, pending: 0, lastSync: null });
  },

  runSync: async () => {
    if (get().syncing) return;
    set({ syncing: true });
    try {
      const outcome = await sync();
      set({ lastSync: outcome });
      if (outcome.pulled > 0) bumpData();
      await get().refreshPending();
    } finally {
      // No finally, e nao no caminho feliz: `syncing` preso em true desliga
      // todo sync futuro, porque a primeira linha daqui e justamente
      // `if (get().syncing) return`.
      set({ syncing: false });
    }
  },

  refreshPending: async () => {
    set({ pending: await pendingCount() });
  },
}));

function applySession(
  set: (partial: Partial<AuthState>) => void,
  session: Session | null,
): void {
  set({
    status: session ? 'signedIn' : 'signedOut',
    email: session?.user.email ?? null,
  });
}

/**
 * Dispara o sync no boot e sempre que o app volta do background — o momento
 * mais provavel de haver rede de novo depois de um treino offline.
 */
export function useSyncLifecycle(): void {
  const bootstrap = useAuth((state) => state.bootstrap);
  const runSync = useAuth((state) => state.runSync);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!isCloudConfigured) return;

    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void runSync();
    });
    return () => subscription.remove();
  }, [runSync]);
}

/** Mensagens do Supabase sao em ingles e tecnicas demais para uma tela de login. */
function translate(message: string): string {
  if (message.toLowerCase().includes('network')) return 'Sem conexão';
  return message;
}

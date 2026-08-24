import type { Session } from '@supabase/supabase-js';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { resetDb } from '@/db/client';
import { bumpData } from '@/store/data';

import { pendingCount, sync, type SyncOutcome } from './engine';
import { isCloudConfigured, supabase } from './supabase';

/**
 * Estado de conta e de sincronizacao.
 *
 * Sem nuvem configurada (`.env` vazio), `status` fica em `local` e o app
 * funciona inteiro offline. Nao ha tela de login bloqueando nada — o SQLite
 * ja e a fonte de verdade, a nuvem so acrescenta backup e segundo aparelho.
 */

export type AuthStatus = 'loading' | 'local' | 'signedOut' | 'signedIn';

type AuthState = {
  status: AuthStatus;
  email: string | null;
  syncing: boolean;
  lastSync: SyncOutcome | null;
  pending: number;

  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
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

    supabase.auth.onAuthStateChange((_event, session) => applySession(set, session));

    await get().refreshPending();
    if (data.session) void get().runSync();
  },

  signIn: async (email, password) => {
    if (!supabase) return 'Nuvem não configurada';
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return translate(error.message);
    await get().runSync();
    return null;
  },

  signUp: async (email, password) => {
    if (!supabase) return 'Nuvem não configurada';
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) return translate(error.message);
    await get().runSync();
    return null;
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    // Limpa o banco local: deixar os dados de uma conta visiveis para a
    // proxima seria pior do que perder o cache, que o pull reconstroi.
    await resetDb();
    bumpData();
    set({ status: 'signedOut', email: null, pending: 0, lastSync: null });
  },

  runSync: async () => {
    if (get().syncing) return;
    set({ syncing: true });
    const outcome = await sync();
    set({ syncing: false, lastSync: outcome });
    if (outcome.pulled > 0) bumpData();
    await get().refreshPending();
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
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos';
  if (message.includes('already registered')) return 'Esse e-mail já tem conta';
  if (message.includes('Password should be')) return 'A senha precisa de ao menos 6 caracteres';
  if (message.includes('Unable to validate email')) return 'E-mail inválido';
  if (message.toLowerCase().includes('network')) return 'Sem conexão';
  return message;
}

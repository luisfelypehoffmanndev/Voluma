import { create } from 'zustand';

import type { Profile } from '@/domain/types';
import {
  claimHandle,
  fetchProfile,
  updateProfile,
  type ProfileExtras,
  type ProfilePatch,
} from '@/sync/profile';

/**
 * O perfil publico de quem esta logado.
 *
 * Store proprio, e nao mais campos em `useAuth`: aquele ja carrega conta E
 * sincronizacao, e perfil e um terceiro assunto — some sozinho quando nao ha
 * conta, e nao tem nada a ver com o outbox.
 *
 * `applySession` (src/sync/auth.ts) e quem liga isto ao ciclo de vida: carrega
 * ao entrar, limpa ao sair.
 */

export type SaveResult = 'ok' | 'handle-taken' | 'error';

type ProfileState = {
  profile: Profile | null;
  loading: boolean;
  /** Mensagem da ultima falha de rede, para a tela oferecer "tentar de novo". */
  error: string | null;

  load: (userId: string) => Promise<void>;
  claim: (userId: string, candidates: string[], extras: ProfileExtras) => Promise<SaveResult>;
  save: (patch: ProfilePatch) => Promise<SaveResult>;
  clear: () => void;
};

export const useProfile = create<ProfileState>((set, get) => ({
  profile: null,
  loading: false,
  error: null,

  load: async (userId) => {
    set({ loading: true, error: null });
    try {
      set({ profile: await fetchProfile(userId) });
    } catch (error) {
      set({ error: message(error) });
    } finally {
      // No finally: `loading` preso em true deixaria o card girando para sempre
      // depois de uma falha de rede.
      set({ loading: false });
    }
  },

  claim: async (userId, candidates, extras) => {
    set({ loading: true, error: null });
    try {
      const result = await claimHandle(userId, candidates, extras);
      if (result === 'handle-taken') return 'handle-taken';

      set({ profile: result });
      return 'ok';
    } catch (error) {
      set({ error: message(error) });
      return 'error';
    } finally {
      set({ loading: false });
    }
  },

  save: async (patch) => {
    const current = get().profile;
    // Sem perfil carregado nao ha o que atualizar — chamar a rede so produziria
    // um update que nao acerta linha nenhuma.
    if (!current) return 'error';

    set({ loading: true, error: null });
    try {
      const result = await updateProfile(current.id, patch);
      if (result === 'handle-taken') return 'handle-taken';

      set({ profile: result });
      return 'ok';
    } catch (error) {
      set({ error: message(error) });
      return 'error';
    } finally {
      set({ loading: false });
    }
  },

  clear: () => set({ profile: null, loading: false, error: null }),
}));

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível carregar o perfil';
}

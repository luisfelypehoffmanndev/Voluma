import { create } from 'zustand';

import type { Profile } from '@/domain/types';
import { NAME_MAX } from '@/domain/friends';
import { removeAvatar, uploadAvatar } from '@/sync/avatar';
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

  /** `suggestedName` e o nome da conta Google, gravado so se o perfil nao tiver. */
  load: (userId: string, suggestedName?: string | null) => Promise<void>;
  claim: (userId: string, candidates: string[], extras: ProfileExtras) => Promise<SaveResult>;
  save: (patch: ProfilePatch, silent?: boolean) => Promise<SaveResult>;
  /** Troca a foto por um JPEG ja reencodado (`pickAvatar`). */
  setAvatar: (jpeg: Uint8Array) => Promise<'ok' | 'error'>;
  removeAvatar: () => Promise<'ok' | 'error'>;
  clear: () => void;
};

export const useProfile = create<ProfileState>((set, get) => ({
  profile: null,
  loading: false,
  error: null,

  load: async (userId, suggestedName) => {
    set({ loading: true, error: null });
    try {
      const profile = await fetchProfile(userId);
      set({ profile });

      // O nome da conta Google entra so onde ainda nao ha nome: o que a pessoa
      // escolheu vale mais. Falhar aqui nao e erro de tela — o perfil ja
      // carregou, e o nome tenta de novo no proximo login.
      const name = suggestedName?.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
      if (profile && profile.displayName === null && name) {
        const result = await updateProfile(userId, { displayName: name }).catch(() => null);
        if (result && result !== 'handle-taken') set({ profile: result });
      }
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

  save: async (patch, silent = false) => {
    const current = get().profile;
    // Sem perfil carregado nao ha o que atualizar — chamar a rede so produziria
    // um update que nao acerta linha nenhuma.
    if (!current) return 'error';

    if (silent) {
      set({ profile: { ...current, ...patch }, error: null });
    } else {
      set({ loading: true, error: null });
    }

    try {
      const result = await updateProfile(current.id, patch);
      if (result === 'handle-taken') {
        if (silent) set({ profile: current }); // Rollback
        return 'handle-taken';
      }

      set({ profile: result });
      return 'ok';
    } catch (error) {
      if (silent) {
        set({ profile: current, error: message(error) }); // Rollback
      } else {
        set({ error: message(error) });
      }
      return 'error';
    } finally {
      if (!silent) set({ loading: false });
    }
  },

  setAvatar: async (jpeg) => {
    const current = get().profile;
    if (!current) return 'error';

    set({ loading: true, error: null });
    try {
      set({ profile: await uploadAvatar(current.id, jpeg, current.avatarPath) });
      return 'ok';
    } catch (error) {
      set({ error: message(error) });
      return 'error';
    } finally {
      set({ loading: false });
    }
  },

  removeAvatar: async () => {
    const current = get().profile;
    if (!current?.avatarPath) return 'error';

    set({ loading: true, error: null });
    try {
      set({ profile: await removeAvatar(current.id, current.avatarPath) });
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

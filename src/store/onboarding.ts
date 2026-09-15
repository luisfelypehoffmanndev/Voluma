import { create } from 'zustand';

import { isFirstRun } from '@/db/onboarding';

type OnboardingState = {
  /** `checking` ate o banco responder; o splash segura a tela ate la. */
  status: 'checking' | 'needed' | 'done';
  check: () => Promise<void>;
  complete: () => void;
};

/**
 * Se esta abertura precisa passar pelo onboarding.
 *
 * Nao ha flag em disco: a verdade e o banco (`isFirstRun`). Uma flag no
 * AsyncStorage discordaria do SQLite no primeiro "sair da conta", que apaga o
 * banco e deixaria o usuario numa home vazia sem caminho de volta.
 */
export const useOnboarding = create<OnboardingState>((set) => ({
  status: 'checking',
  check: async () => {
    try {
      set({ status: (await isFirstRun()) ? 'needed' : 'done' });
    } catch (error) {
      // Banco ilegivel nao pode prender o app no splash: segue para a home, que
      // tem a propria tela de erro com "Tentar de novo".
      console.warn('[Voluma] falha ao checar primeira abertura', error);
      set({ status: 'done' });
    }
  },
  complete: () => set({ status: 'done' }),
}));

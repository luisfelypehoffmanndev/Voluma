import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { Rect } from '@/domain/tour';

/**
 * O tour guiado: uma dica por tela, na primeira vez que o usuario chega nela.
 *
 * Por que no AsyncStorage e nao no SQLite: e preferencia DESTE aparelho, como
 * a vibracao (`prefs.ts`) — trocar de celular e rever a dica e o comportamento
 * certo, e guardar isso no banco custaria migracao mais sincronizacao para um
 * booleano por tela.
 *
 * `targets` nao e persistido: sao posicoes medidas na tela, validas enquanto
 * ela esta montada.
 */

const KEY = 'voluma:tour';

type TourState = {
  /** Telas cujo tour o usuario ja viu (ou pulou). */
  seen: Record<string, boolean>;
  /** Falso ate o disco responder: sem isso a dica pisca antes de sabermos. */
  ready: boolean;
  targets: Record<string, Rect>;
  load: () => Promise<void>;
  markSeen: (tour: string) => void;
  /** Esquece o que ja foi visto: as dicas voltam a aparecer uma vez cada. */
  reset: () => void;
  register: (id: string, rect: Rect) => void;
  unregister: (id: string) => void;
};

export const useTour = create<TourState>((set, get) => ({
  seen: {},
  ready: false,
  targets: {},

  load: async () => {
    try {
      const stored = await AsyncStorage.getItem(KEY);
      set({ seen: stored ? (JSON.parse(stored) as Record<string, boolean>) : {}, ready: true });
    } catch (error) {
      // Preferencia ilegivel nao pode travar o app nem repetir a dica para
      // sempre: segue como "ja visto", que e o estado menos intrusivo.
      console.warn('[Voluma] falha ao ler o tour', error);
      set({ ready: true });
    }
  },

  markSeen: (tour) => {
    const seen = { ...get().seen, [tour]: true };
    set({ seen });
    void AsyncStorage.setItem(KEY, JSON.stringify(seen)).catch((error) => {
      console.warn('[Voluma] falha ao gravar o tour', error);
    });
  },

  reset: () => {
    set({ seen: {} });
    void AsyncStorage.removeItem(KEY).catch((error) => {
      console.warn('[Voluma] falha ao limpar o tour', error);
    });
  },

  register: (id, rect) => {
    const current = get().targets[id];
    if (
      current &&
      current.x === rect.x &&
      current.y === rect.y &&
      current.width === rect.width &&
      current.height === rect.height
    ) {
      return;
    }
    set({ targets: { ...get().targets, [id]: rect } });
  },

  unregister: (id) => {
    const targets = { ...get().targets };
    delete targets[id];
    set({ targets });
  },
}));

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
  /**
   * O alvo que a dica esta apontando AGORA, ou `null`.
   *
   * E o sinal para o `TourTarget` daquele id se remedir enquanto a dica esta
   * aberta: a posicao muda quando a lista rola, quando um card abre, quando o
   * teclado entra — e uma medida tirada no primeiro layout fica velha.
   */
  measuring: string | null;
  load: () => Promise<void>;
  markSeen: (tour: string) => void;
  setMeasuring: (target: string | null) => void;
  /** Esquece o que ja foi visto: as dicas voltam a aparecer uma vez cada. */
  reset: () => void;
  register: (id: string, rect: Rect) => void;
  unregister: (id: string) => void;
};

export const useTour = create<TourState>((set, get) => ({
  seen: {},
  ready: false,
  targets: {},
  measuring: null,

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

  setMeasuring: (target) => {
    if (get().measuring === target) return;
    set({ measuring: target });
  },

  register: (id, rect) => {
    const current = get().targets[id];
    /*
      Diferenca menor que um ponto nao mexe nada na tela, mas trocava o estado
      e redesenhava o recorte — com a medida repetindo a cada 250ms, isso virava
      tremor. `measureInWindow` devolve fracao (490,3333...), entao comparar por
      igualdade exata nunca filtrava nada.
    */
    const same =
      current &&
      Math.abs(current.x - rect.x) < 1 &&
      Math.abs(current.y - rect.y) < 1 &&
      Math.abs(current.width - rect.width) < 1 &&
      Math.abs(current.height - rect.height) < 1;
    if (same) return;
    set({ targets: { ...get().targets, [id]: rect } });
  },

  unregister: (id) => {
    const targets = { ...get().targets };
    delete targets[id];
    set({ targets });
  },
}));

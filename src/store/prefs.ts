import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/**
 * Preferencias do aparelho.
 *
 * Ficam no AsyncStorage, e nao no SQLite, de proposito: nao ha tabela de
 * preferencia no schema e criar uma custaria migracao mais sincronizacao para
 * guardar um booleano. E preferencia DESTE aparelho — nao faz sentido o
 * segundo aparelho herdar a escolha de vibracao do primeiro —, entao a
 * ausencia de sync aqui e o comportamento certo, nao uma limitacao.
 */

const HAPTICS_KEY = 'cleangym:haptics';

type PrefsState = {
  haptics: boolean;
  /**
   * Falso ate o disco responder.
   *
   * Sem isto a tela de ajustes desenharia a caixa desmarcada por um frame e
   * ela "se marcaria sozinha" quando o valor chegasse — exatamente o pisca que
   * o resto deste trabalho existe para tirar.
   */
  ready: boolean;
  setHaptics: (on: boolean) => void;
  load: () => Promise<void>;
};

export const usePrefs = create<PrefsState>((set) => ({
  // Ligado por padrao: o toque so existe onde algo foi gravado, e essa
  // confirmacao e util. Quem nao quiser, desliga uma vez.
  haptics: true,
  ready: false,

  setHaptics: (on) => {
    // Grava em segundo plano: a preferencia ja valeu na hora, e esperar o
    // disco para acender a caixa reintroduziria o atraso do banco.
    set({ haptics: on });
    void AsyncStorage.setItem(HAPTICS_KEY, on ? '1' : '0').catch((error) => {
      console.warn('[Voluma] falha ao gravar preferencia de vibracao', error);
    });
  },

  load: async () => {
    try {
      const stored = await AsyncStorage.getItem(HAPTICS_KEY);
      set({ haptics: stored === null ? true : stored === '1', ready: true });
    } catch (error) {
      // Preferencia ilegivel nao pode derrubar o app: fica no padrao.
      console.warn('[Voluma] falha ao ler preferencia de vibracao', error);
      set({ ready: true });
    }
  },
}));

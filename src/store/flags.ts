import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { supabase } from '@/sync/supabase';
import { GYM } from '@/world';

/**
 * Feature flags por academia.
 *
 * Ficam no AsyncStorage e nao no SQLite de proposito: sao configuracoes do
 * APARELHO para aquele mundo/academia, lidas antes de qualquer tela carregar, e
 * valem tanto para usuarios anonimos quanto autenticados.
 *
 * Politica de fallback: uma flag desconhecida ou ainda nao baixada sempre vale
 * `false` (desligada por padrao).
 */

export type FlagsMap = Record<string, boolean>;

/** Liga as fichas sugeridas da academia (Plano, onboarding e `/presets`). */
export const FLAG_SUGGESTED_WORKOUTS = 'suggested_workouts';

/**
 * A academia usa o painel (plano 18): a equipe dela ve o plano e a frequencia
 * de quem entra com a conta. Liga o aviso no Perfil e no login.
 */
export const FLAG_STAFF_PANEL = 'staff_panel';

/** O aviso de privacidade do painel, igual nos dois lugares. */
export const STAFF_PANEL_NOTICE = 'A equipe da academia vê seu plano e sua frequência';

export const storageKeyFor = (gym: string) => `@voluma:flags:${gym}`;

type FlagsState = {
  /** Mapa chave -> booleano para as flags da academia atual. */
  flags: FlagsMap;
  /** Falso ate o AsyncStorage responder. */
  ready: boolean;
  /** Verdadeiro enquanto uma consulta remota estiver em voo. */
  loading: boolean;
  load: () => Promise<void>;
  fetchRemote: () => Promise<void>;
  reset: () => Promise<void>;
};

export const useFlags = create<FlagsState>((set, get) => ({
  flags: {},
  ready: false,
  loading: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(storageKeyFor(GYM));
      const parsed = raw ? (JSON.parse(raw) as FlagsMap) : {};
      set({ flags: parsed, ready: true });
    } catch (error) {
      console.warn('[Voluma] falha ao carregar flags do cache', error);
      set({ ready: true });
    }
  },

  fetchRemote: async () => {
    if (!supabase) return;
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('gym_flags')
        .select('key, enabled')
        .eq('gym_id', GYM);

      if (error) {
        console.warn('[Voluma] falha ao buscar flags no servidor', error.message);
        return;
      }

      const next: FlagsMap = {};
      if (Array.isArray(data)) {
        for (const row of data) {
          if (typeof row.key === 'string' && typeof row.enabled === 'boolean') {
            next[row.key] = row.enabled;
          }
        }
      }

      set({ flags: next });
      void AsyncStorage.setItem(storageKeyFor(GYM), JSON.stringify(next)).catch((err) => {
        console.warn('[Voluma] falha ao gravar flags no cache', err);
      });
    } catch (error) {
      console.warn('[Voluma] erro inesperado ao sincronizar flags', error);
    } finally {
      set({ loading: false });
    }
  },

  reset: async () => {
    set({ flags: {}, ready: false, loading: false });
    try {
      await AsyncStorage.removeItem(storageKeyFor(GYM));
    } catch (err) {
      console.warn('[Voluma] falha ao limpar flags', err);
    }
  },
}));

/**
 * Hook reativo para consultar se uma feature flag esta habilitada.
 * Devolve `false` por padrao se a chave nao existir.
 */
export function useFlag(key: string): boolean {
  return useFlags((state) => state.flags[key] ?? false);
}

/**
 * Leitura sincrona para modulos fora da arvore de componentes React.
 */
export function getFlag(key: string): boolean {
  return useFlags.getState().flags[key] ?? false;
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase.
 *
 * `detectSessionInUrl: false` e obrigatorio em React Native — nao ha URL de
 * redirect para inspecionar, e deixar ligado gera erro no boot. A sessao vai
 * para o AsyncStorage para sobreviver ao fechamento do app.
 *
 * As credenciais vem de `EXPO_PUBLIC_*`, que o Expo injeta no bundle. A anon
 * key e publica por design: quem protege os dados e o RLS do schema.sql.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * `null` quando o `.env` nao foi preenchido. Nesse caso o app roda inteiro em
 * modo local — nada de tela de erro no boot so porque a nuvem nao esta
 * configurada ainda.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export const isCloudConfigured = supabase !== null;

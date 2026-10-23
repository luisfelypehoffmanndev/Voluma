import { createClient } from '@supabase/supabase-js';

// Os mesmos nomes do app (`.env` da raiz): a chave e a publicavel, nunca a
// secret. Quem protege os dados e o RLS e as RPCs `staff_*`.
const url = import.meta.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined;
const key = import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key) {
  throw new Error('Falta EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no .env da raiz.');
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

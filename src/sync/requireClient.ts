import { supabase } from './supabase';

/**
 * O cliente do Supabase, ou um erro legivel quando o app foi buildado sem as
 * chaves da nuvem. Para as chamadas que nao tem sentido offline (perfil,
 * amigos); o sync de treino checa `supabase` direto porque sem nuvem ele so nao
 * faz nada.
 *
 * Modulo proprio, e nao dentro de `supabase.ts`, para que os testes que
 * substituem `./supabase` inteiro continuem valendo aqui tambem.
 */
export function requireClient() {
  if (!supabase) throw new Error('Nuvem não configurada');
  return supabase;
}

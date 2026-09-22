import type { Profile } from '@/domain/types';

import { supabase } from './supabase';

/**
 * Leitura e escrita do perfil publico.
 *
 * Este modulo e a UNICA excecao a regra "nenhuma tela consulta o Supabase
 * diretamente" (README). Ela se justifica porque o perfil nao existe no SQLite:
 * e dado social, so faz sentido com rede, e sincronizar um registro que a
 * propria pessoa quase nunca muda nao pagaria a complexidade de entrar no
 * outbox.
 */

/** Violacao de unique — para o handle, quer dizer "ja e de outra pessoa". */
const UNIQUE_VIOLATION = '23505';

export type ProfileExtras = {
  age?: number | null;
  trainingYears?: number | null;
};

export type ProfilePatch = ProfileExtras & {
  handle?: string;
};

/** O handle pedido pertence a outra conta. */
export type HandleTaken = 'handle-taken';

type Row = {
  id: string;
  handle: string;
  age: number | null;
  training_years: number | null;
};

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const client = requireClient();

  const { data, error } = await client
    .from('profiles')
    .select('id, handle, age, training_years')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toProfile(data as Row) : null;
}

/**
 * Cria o perfil, tentando os candidatos em ordem ate um passar.
 *
 * Nao existe "conferir se esta livre e depois gravar": entre a consulta e o
 * insert cabe o insert de outra pessoa. Quem decide e o indice unico do
 * Postgres, e `23505` e a resposta — aqui so se escolhe o proximo nome da fila.
 */
export async function claimHandle(
  userId: string,
  candidates: readonly string[],
  extras: ProfileExtras,
): Promise<Profile | HandleTaken> {
  const client = requireClient();

  for (const handle of candidates) {
    const { data, error } = await client
      .from('profiles')
      .insert({
        id: userId,
        handle,
        age: extras.age ?? null,
        training_years: extras.trainingYears ?? null,
      })
      .select('id, handle, age, training_years')
      .single();

    if (!error) return toProfile(data as Row);

    // So colisao vira "tenta o proximo". Qualquer outro erro (RLS, rede) tem
    // que subir: insistir esconderia a falha e acabaria gravando um handle que
    // a pessoa nao escolheu.
    if (error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
  }

  return 'handle-taken';
}

export async function updateProfile(
  userId: string,
  patch: ProfilePatch,
): Promise<Profile | HandleTaken> {
  const client = requireClient();

  const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.handle !== undefined) changes.handle = patch.handle;
  if (patch.age !== undefined) changes.age = patch.age;
  if (patch.trainingYears !== undefined) changes.training_years = patch.trainingYears;

  const { data, error } = await client
    .from('profiles')
    .update(changes)
    .eq('id', userId)
    .select('id, handle, age, training_years')
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return 'handle-taken';
    throw new Error(error.message);
  }
  return toProfile(data as Row);
}

function toProfile(row: Row): Profile {
  return {
    id: row.id,
    handle: row.handle,
    age: row.age,
    trainingYears: row.training_years,
  };
}

function requireClient() {
  if (!supabase) throw new Error('Nuvem não configurada');
  return supabase;
}

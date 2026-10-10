import type { Profile } from '@/domain/types';
import { GYM } from '@/world';

import { requireClient } from './requireClient';

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
  displayName?: string | null;
};

export type ProfilePatch = ProfileExtras & {
  handle?: string;
  sharesStats?: boolean;
  /** Nulo tira a foto. So `src/sync/avatar.ts` mexe nisto, depois de subir o arquivo. */
  avatarPath?: string | null;
  displayName?: string | null;
};

/** As colunas que viram um `Profile`, iguais nas tres consultas. */
const COLUMNS = 'id, handle, age, training_years, shares_stats, avatar_path, display_name';

/** O handle pedido pertence a outra conta. */
export type HandleTaken = 'handle-taken';

type Row = {
  id: string;
  handle: string;
  age: number | null;
  training_years: number | null;
  shares_stats: boolean;
  avatar_path: string | null;
  display_name: string | null;
};

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const client = requireClient();

  const { data, error } = await client
    .from('profiles')
    .select(COLUMNS)
    .eq('id', userId)
    .eq('gym_id', GYM)
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
        gym_id: GYM,
        handle,
        age: extras.age ?? null,
        training_years: extras.trainingYears ?? null,
        display_name: extras.displayName ?? null,
      })
      .select(COLUMNS)
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
  if (patch.sharesStats !== undefined) changes.shares_stats = patch.sharesStats;
  if (patch.avatarPath !== undefined) changes.avatar_path = patch.avatarPath;
  if (patch.displayName !== undefined) changes.display_name = patch.displayName;

  const { data, error } = await client
    .from('profiles')
    .update(changes)
    .eq('id', userId)
    .eq('gym_id', GYM)
    .select(COLUMNS)
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
    sharesStats: row.shares_stats,
    avatarPath: row.avatar_path,
    displayName: row.display_name,
  };
}

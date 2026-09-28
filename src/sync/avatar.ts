import type { Profile } from '@/domain/types';

import { updateProfile } from './profile';
import { requireClient } from './requireClient';

/**
 * A foto de perfil no bucket privado `avatars`.
 *
 * Privado de proposito: com URL publica, qualquer um com o link veria a foto.
 * Aqui so sai URL assinada, e o Storage so assina para quem passa na policy de
 * leitura (o dono, amigo aceito, ou quem recebeu um pedido do dono — ver a v9
 * em `supabase/schema.sql`).
 *
 * O arquivo que sobe ja vem reencodado pelo app (`pickAvatar`): 256x256, JPEG.
 * Reencodar e o que tira o EXIF — inclusive o GPS de onde a foto foi tirada —,
 * e o bucket recusa qualquer coisa que nao seja JPEG pequeno.
 */

const BUCKET = 'avatars';
/** Validade das URLs assinadas. */
const SIGNED_TTL_S = 60 * 60;
/** Assina de novo quando falta menos que isto: a tela pode ficar aberta. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * `{userId}/{instante}.jpg`. A pasta e o que as policies conferem; o instante
 * troca a URL a cada foto nova, e o cache do aparelho nao mostra a antiga.
 */
export function avatarPathFor(userId: string, now: number): string {
  return `${userId}/${now}.jpg`;
}

/** O maior quadrado central de uma imagem — o recorte da foto de perfil. */
export function centerSquare(width: number, height: number) {
  const side = Math.min(width, height);
  return {
    originX: Math.floor((width - side) / 2),
    originY: Math.floor((height - side) / 2),
    width: side,
    height: side,
  };
}

/**
 * Troca a foto. A ordem e a regra: sobe a nova, aponta o perfil para ela, e so
 * entao apaga a antiga. Em qualquer outra ordem, uma falha no meio deixaria o
 * perfil apontando para um arquivo que nao existe.
 */
export async function uploadAvatar(
  userId: string,
  jpeg: Uint8Array,
  previousPath: string | null,
  now = Date.now(),
): Promise<Profile> {
  const client = requireClient();
  const path = avatarPathFor(userId, now);

  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, jpeg, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);

  let profile: Profile;
  try {
    const result = await updateProfile(userId, { avatarPath: path });
    // So o handle tem unicidade; trocar a foto nunca colide.
    if (result === 'handle-taken') throw new Error('Não foi possível salvar a foto');
    profile = result;
  } catch (reason) {
    // O perfil continua na foto antiga: o arquivo novo ficaria orfao, sem
    // ninguem para apaga-lo depois.
    await client.storage.from(BUCKET).remove([path]);
    throw reason;
  }

  if (previousPath) await client.storage.from(BUCKET).remove([previousPath]);
  return profile;
}

/** Tira a foto: primeiro do perfil, depois o arquivo — a mesma ordem do upload. */
export async function removeAvatar(userId: string, previousPath: string): Promise<Profile> {
  const client = requireClient();

  const result = await updateProfile(userId, { avatarPath: null });
  if (result === 'handle-taken') throw new Error('Não foi possível remover a foto');

  await client.storage.from(BUCKET).remove([previousPath]);
  return result;
}

const cache = new Map<string, { url: string; expiresAt: number }>();

/**
 * URLs assinadas para as fotos de uma tela, numa chamada so.
 *
 * Guarda as que ainda valem: trocar de aba e voltar nao assina tudo de novo. O
 * caminho muda a cada foto nova, entao uma URL em cache nunca aponta para uma
 * foto trocada.
 */
export async function signedAvatarUrls(
  paths: readonly string[],
  now = Date.now(),
): Promise<Map<string, string>> {
  const unique = [...new Set(paths)];
  const missing = unique.filter((path) => {
    const hit = cache.get(path);
    return !hit || hit.expiresAt - now < REFRESH_MARGIN_MS;
  });

  if (missing.length > 0) {
    const client = requireClient();
    const { data, error } = await client.storage
      .from(BUCKET)
      .createSignedUrls(missing, SIGNED_TTL_S);
    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      // Uma foto que a policy nao libera volta com erro, sem URL: fica sem foto
      // (a inicial no lugar), e as outras seguem.
      if (row.path && row.signedUrl) {
        cache.set(row.path, { url: row.signedUrl, expiresAt: now + SIGNED_TTL_S * 1000 });
      }
    }
  }

  const urls = new Map<string, string>();
  for (const path of unique) {
    const hit = cache.get(path);
    if (hit) urls.set(path, hit.url);
  }
  return urls;
}

/** Esquece as URLs — no sign-out, as fotos liberadas eram da conta que saiu. */
export function clearAvatarCache(): void {
  cache.clear();
}

#!/usr/bin/env node
/**
 * Fotos de teste para os amigos FALSOS (perfis `teste_*`) — so para testar a
 * foto de perfil sem uma segunda conta de verdade.
 *
 *   node scripts/seed-fake-avatars.mjs           # sobe uma foto para cada teste_*
 *   node scripts/seed-fake-avatars.mjs --remove  # apaga as fotos e zera o avatar_path
 *
 * Rode o --remove ANTES de apagar os usuarios falsos: o cascade de
 * `auth.users` apaga o perfil, mas nao os arquivos do Storage.
 *
 * Precisa da chave `service_role` em SUPABASE_SERVICE_ROLE_KEY, porque os
 * falsos nao tem login e o bucket so deixa cada um gravar na propria pasta. A
 * chave passa por cima de todo RLS: nunca no `.env`, nunca no app, nunca num
 * commit. Para nao deixa-la no historico do shell:
 *
 *   read -rs SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY
 *
 * As fotos vem do picsum.photos (acervo livre do Unsplash), com a semente no
 * @ — a mesma pessoa ganha a mesma foto a cada execucao.
 */

import { readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'avatars';
/** Trava: so perfis falsos. Um @ de verdade nunca comeca assim por acaso. */
const FAKE = /^teste_/;
const MAX_BYTES = 512 * 1024;

const url = readEnvUrl();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error('Defina SUPABASE_SERVICE_ROLE_KEY (ver o comentario no topo do script).');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const remove = process.argv.includes('--remove');

const { data: profiles, error } = await admin
  .from('profiles')
  .select('id, handle, avatar_path')
  .like('handle', 'teste\\_%');
if (error) throw new Error(error.message);

const fakes = profiles.filter((profile) => FAKE.test(profile.handle));
if (fakes.length === 0) {
  console.log('Nenhum perfil teste_* encontrado.');
  process.exit(0);
}

for (const profile of fakes) {
  if (remove) await clearAvatar(profile);
  else await seedAvatar(profile);
}

async function seedAvatar(profile) {
  const response = await fetch(`https://picsum.photos/seed/${profile.handle}/256`);
  if (!response.ok) throw new Error(`picsum respondeu ${response.status} para ${profile.handle}`);
  const bytes = new Uint8Array(await response.arrayBuffer());

  // O bucket so aceita JPEG pequeno; conferir aqui da uma mensagem melhor que
  // a recusa do Storage.
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!isJpeg || bytes.length > MAX_BYTES) {
    throw new Error(`foto de ${profile.handle} nao e um JPEG pequeno (${bytes.length} bytes)`);
  }

  const path = `${profile.id}/${Date.now()}.jpg`;
  const upload = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (upload.error) throw new Error(upload.error.message);

  const update = await admin.from('profiles').update({ avatar_path: path }).eq('id', profile.id);
  if (update.error) {
    await admin.storage.from(BUCKET).remove([path]);
    throw new Error(update.error.message);
  }

  if (profile.avatar_path) await admin.storage.from(BUCKET).remove([profile.avatar_path]);
  console.log(`@${profile.handle}: foto nova em ${path}`);
}

async function clearAvatar(profile) {
  const listed = await admin.storage.from(BUCKET).list(profile.id);
  if (listed.error) throw new Error(listed.error.message);

  const update = await admin.from('profiles').update({ avatar_path: null }).eq('id', profile.id);
  if (update.error) throw new Error(update.error.message);

  const paths = listed.data.map((file) => `${profile.id}/${file.name}`);
  if (paths.length > 0) {
    const removed = await admin.storage.from(BUCKET).remove(paths);
    if (removed.error) throw new Error(removed.error.message);
  }
  console.log(`@${profile.handle}: ${paths.length} foto(s) apagada(s)`);
}

/** A URL do projeto vem do `.env` do app — e publica; a chave nao. */
function readEnvUrl() {
  const line = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .find((entry) => entry.startsWith('EXPO_PUBLIC_SUPABASE_URL='));
  if (!line) throw new Error('EXPO_PUBLIC_SUPABASE_URL nao esta no .env');
  return line.slice('EXPO_PUBLIC_SUPABASE_URL='.length).trim();
}

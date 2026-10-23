-- O minimo do Supabase para rodar o schema.sql e os testes num Postgres local:
-- os papeis da API, `auth.users`, `auth.uid()`/`auth.jwt()` lendo o
-- `request.jwt.claims` (como no Supabase) e o pedaco do Storage que o schema usa.
-- Idempotente: os papeis sao do cluster, e o banco e recriado a cada rodada.

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

grant usage on schema public to anon, authenticated, service_role;
-- Como no Supabase: toda tabela e funcao nova de `public` nasce aberta para os
-- papeis da API, e quem fecha e o proprio schema.sql.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id                 uuid primary key,
  email              text,
  -- Nulo por padrao, como no Supabase
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb
);

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

grant execute on all functions in schema auth to anon, authenticated, service_role;

create schema storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key,
  name text,
  public boolean,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text,
  owner     uuid default auth.uid()
);

alter table storage.objects enable row level security;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;

create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

grant execute on function storage.foldername(text) to anon, authenticated, service_role;

-- O dono de tudo, SEM superusuario, como o `postgres` do Supabase. O schema e
-- os testes rodam com ele (o run.sh troca de papel ao conectar): o que so um
-- superusuario pode fazer (como declarar `set meu.parametro = ...` numa
-- funcao) falha aqui antes de falhar na producao.
do $$ begin create role voluma_owner nologin bypassrls; exception when duplicate_object then null; end $$;
do $$ begin
  if not pg_has_role('voluma_owner', 'authenticated', 'member') then
    grant anon, authenticated, service_role to voluma_owner;
  end if;
end $$;
grant create, usage on schema public to voluma_owner;
alter table auth.users owner to voluma_owner;
alter table storage.buckets owner to voluma_owner;
alter table storage.objects owner to voluma_owner;
alter default privileges for role voluma_owner in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role voluma_owner in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges for role voluma_owner in schema public grant all on sequences to anon, authenticated, service_role;

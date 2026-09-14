-- Voluma — schema do Supabase.
--
-- Cole este arquivo inteiro no SQL Editor do projeto e rode uma vez.
-- E idempotente: rodar de novo nao quebra nada.
--
-- As colunas sao identicas as do SQLite local, de proposito: o sync envia a
-- linha como ela esta, sem tradutor no meio.
--
-- A `anon key` do app e publica por design. O que protege os dados e o RLS
-- abaixo: cada linha carrega `user_id` e so o dono consegue ler ou escrever.

-- ---------------------------------------------------------------- tabelas

create table if not exists public.exercises (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null,
  muscle_group text,
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table if not exists public.routines (
  id         uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  weekday    smallint not null check (weekday between 0 and 6),
  position   integer not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.routine_exercises (
  id               uuid primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  routine_id       uuid not null,
  exercise_id      uuid not null,
  position         integer not null default 0,
  target_sets      integer not null default 3,
  target_reps      integer not null default 10,
  target_weight_kg real not null default 0,
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create table if not exists public.week_targets (
  id                  uuid primary key,
  user_id             uuid not null references auth.users (id) on delete cascade,
  week_start          date not null,
  routine_exercise_id uuid not null,
  target_sets         integer not null,
  target_reps         integer not null,
  target_weight_kg    real not null,
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create table if not exists public.sessions (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  routine_id  uuid,
  date        date not null,
  started_at  timestamptz not null,
  finished_at timestamptz,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists public.session_sets (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  session_id  uuid not null,
  exercise_id uuid not null,
  set_index   integer not null,
  reps        integer not null default 0,
  weight_kg   real not null default 0,
  done        boolean not null default false,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists public.body_weight_logs (
  id         uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  logged_at  timestamptz not null,
  weight_kg  real not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Sem foreign keys entre as tabelas do app de proposito: o cliente escreve
-- offline e sobe as linhas em lote; uma FK faria o push falhar so por causa da
-- ordem de chegada. A integridade e garantida pelo cliente, que gera os ids.

-- ------------------------------------------------- v3: corrida (km e tempo)
-- Idempotente como o resto do arquivo: rodar de novo nao quebra nada.

alter table public.exercises         add column if not exists kind text not null default 'strength';
alter table public.routine_exercises add column if not exists target_distance_km real not null default 0;
alter table public.routine_exercises add column if not exists target_duration_min integer not null default 0;
alter table public.week_targets      add column if not exists target_distance_km real not null default 0;
alter table public.week_targets      add column if not exists target_duration_min integer not null default 0;
alter table public.session_sets      add column if not exists distance_km real not null default 0;
alter table public.session_sets      add column if not exists duration_min integer not null default 0;

-- ---------------------------------------------------------------- indices
-- O pull filtra sempre por dono + updated_at, entao esse e o indice que importa.

create index if not exists idx_exercises_sync         on public.exercises (user_id, updated_at);
create index if not exists idx_routines_sync          on public.routines (user_id, updated_at);
create index if not exists idx_routine_exercises_sync on public.routine_exercises (user_id, updated_at);
create index if not exists idx_week_targets_sync      on public.week_targets (user_id, updated_at);
create index if not exists idx_sessions_sync          on public.sessions (user_id, updated_at);
create index if not exists idx_session_sets_sync      on public.session_sets (user_id, updated_at);
create index if not exists idx_body_weight_sync       on public.body_weight_logs (user_id, updated_at);

-- -------------------------------------------------------------------- RLS

alter table public.exercises         enable row level security;
alter table public.routines          enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.week_targets      enable row level security;
alter table public.sessions          enable row level security;
alter table public.session_sets      enable row level security;
alter table public.body_weight_logs  enable row level security;

do $$
declare
  target text;
begin
  foreach target in array array[
    'exercises', 'routines', 'routine_exercises', 'week_targets',
    'sessions', 'session_sets', 'body_weight_logs'
  ]
  loop
    execute format('drop policy if exists own_rows on public.%I', target);
    execute format(
      'create policy own_rows on public.%I
         for all
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id)',
      target
    );
  end loop;
end $$;

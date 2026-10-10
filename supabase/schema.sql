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

-- ------------------------------------ v4: pular exercicio e finalizar treino

alter table public.sessions          add column if not exists skipped_exercise_ids text not null default '[]';
alter table public.sessions          add column if not exists completed_at timestamptz;
alter table public.sessions          add column if not exists exercise_order text not null default '[]';

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
    -- `(select auth.uid())` e nao `auth.uid()` direto: dentro de subquery
    -- escalar o Postgres avalia UMA vez por query (InitPlan) em vez de uma vez
    -- por linha. Com um usuario nao se nota; com a academia inteira e
    -- session_sets crescendo uma linha por serie de cada treino de cada pessoa,
    -- passa a pesar em todo select.
    --
    -- `to authenticated` nao e o que protege (com anon, auth.uid() e null e
    -- `null = user_id` ja nega) — e o que evita avaliar a policy a toa em
    -- request anonimo. Quem protege continua sendo o par using/with check: o
    -- `with check` e o que impede reatribuir user_id para outra pessoa.
    execute format(
      'create policy own_rows on public.%I
         for all
         to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)',
      target
    );
  end loop;
end $$;

-- ------------------------------------------------------------ v5: perfil
-- O perfil publico: o @handle com que amigos se acham, mais idade e anos de
-- treino. Nao tem par no SQLite e nao entra no sync: e dado social, so existe
-- para ser mostrado a outra pessoa, e quem nao entra na conta nao tem a quem
-- mostrar. Uma tabela, nenhuma migration local, zero mudanca no engine.

create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  handle         text not null check (handle ~ '^[a-z0-9._]{3,20}$'),
  age            int check (age is null or age between 13 and 120),
  training_years int check (training_years is null or training_years between 0 and 80),
  updated_at     timestamptz not null default now()
);

-- Os `check` vao inline no create table, e nao em `alter table add constraint`
-- depois: o Postgres nao aceita `add constraint if not exists`, e a segunda
-- colagem deste arquivo abortaria. E o mesmo motivo de v3 e v4 usarem
-- `add column if not exists`.

-- O indice unico do handle (`idx_profiles_handle`, global) morava aqui. A v11
-- o troca por um unico por mundo, e cria-lo aqui de novo, a cada colagem do
-- arquivo, voltaria a proibir o mesmo @ em dois mundos.

alter table public.profiles enable row level security;

-- Fora do loop acima de proposito: aqui a chave do dono e a PK `id`, que
-- referencia auth.users direto, e nao uma coluna `user_id`. Mesmas razoes do
-- item 04 para `(select auth.uid())` e `to authenticated`.
drop policy if exists own_profile on public.profiles;
create policy own_profile on public.profiles
  for all
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ------------------------------------------------------------ v6: amigos
-- Amizade com aceite, e o toggle que libera os numeros.
--
-- A regra que organiza tudo: nada de uma pessoa aparece para outra sem DOIS
-- consentimentos — a amizade aceita E o toggle ligado. Um so nao basta.

alter table public.profiles
  add column if not exists shares_stats boolean not null default false;

-- Desligado por padrao, de proposito: opt-in. Nada e compartilhado ate alguem
-- escolher compartilhar, que e o mesmo principio do login opcional e do "nada
-- criado as escondidas" do onboarding.

create table if not exists public.friendships (
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status       text not null check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- O indice unico do par (`idx_friendship_pair`, um par = uma linha) morava
-- aqui. A v11 o troca por um por mundo, pelo mesmo motivo do handle na v5.

create index if not exists idx_friendship_addressee
  on public.friendships (addressee_id, status);

alter table public.friendships enable row level security;

-- Quatro policies, e nao uma `for all`: aqui cada verbo tem dono diferente,
-- porque quem pede nao e quem aceita. Uma policy unica daria ao requester o
-- poder de aceitar o proprio pedido.

drop policy if exists friendship_select on public.friendships;
create policy friendship_select on public.friendships
  for select
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

drop policy if exists friendship_insert on public.friendships;
create policy friendship_insert on public.friendships
  for insert
  to authenticated
  with check ((select auth.uid()) = requester_id and status = 'pending');

drop policy if exists friendship_update on public.friendships;
create policy friendship_update on public.friendships
  for update
  to authenticated
  using ((select auth.uid()) = addressee_id)
  with check ((select auth.uid()) = addressee_id);

-- Recusar, cancelar e desfazer sao a mesma operacao, e qualquer um dos dois
-- lados pode faze-la: ninguem fica preso numa amizade que nao quer.
drop policy if exists friendship_delete on public.friendships;
create policy friendship_delete on public.friendships
  for delete
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- ------------------------------------------------------------------ RPCs
-- A policy de `profiles` e "cada um le so o seu". Ler o @handle de um amigo
-- exige sair disso, e a escolha aqui e funcao `security definer` em vez de
-- afrouxar o RLS: abrir `profiles` para leitura ampla exporia todo mundo a
-- todo mundo, e uma vez aberto nao da para fechar por caso.

create or replace function public.find_profile_by_handle(target text)
returns table (id uuid, handle text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.handle
  from public.profiles p
  where lower(p.handle) = lower(target)
  limit 1;
$$;

revoke all on function public.find_profile_by_handle(text) from public, anon;
grant execute on function public.find_profile_by_handle(text) to authenticated;

create or replace function public.request_friendship(target_handle text)
returns text
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
  target uuid;
begin
  if me is null then return 'unauthenticated'; end if;

  select p.id into target
  from public.profiles p
  where lower(p.handle) = lower(target_handle)
  limit 1;

  if target is null then return 'not-found'; end if;
  if target = me then return 'self'; end if;

  -- O indice do par e quem decide se ja existe relacao, inclusive na direcao
  -- contraria. Consultar antes nao fecharia a corrida entre duas pessoas se
  -- pedindo no mesmo instante, so encurtaria a janela.
  begin
    insert into public.friendships (requester_id, addressee_id, status)
    values (me, target, 'pending');
  exception
    when unique_violation then return 'already';
  end;

  return 'ok';
end;
$$;

revoke all on function public.request_friendship(text) from public, anon;
grant execute on function public.request_friendship(text) to authenticated;

-- (drop antes do create: a v9 muda as colunas de retorno, e sem isto colar o
-- arquivo de novo falharia aqui ao tentar voltar ao formato antigo.)
drop function if exists public.list_friends();
create function public.list_friends()
returns table (
  id uuid,
  handle text,
  status text,
  direction text,
  shares_stats boolean,
  age int,
  training_years int
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.handle,
    f.status,
    case when f.requester_id = (select auth.uid()) then 'outgoing' else 'incoming' end,
    p.shares_stats,
    -- Idade e anos de treino so saem do servidor com os DOIS consentimentos.
    -- Filtrar no cliente nao serviria: o dado ja teria atravessado a rede.
    case when p.shares_stats and f.status = 'accepted' then p.age end,
    case when p.shares_stats and f.status = 'accepted' then p.training_years end
  from public.friendships f
  join public.profiles p
    on p.id = case
      when f.requester_id = (select auth.uid()) then f.addressee_id
      else f.requester_id
    end
  where (select auth.uid()) in (f.requester_id, f.addressee_id);
$$;

revoke all on function public.list_friends() from public, anon;
grant execute on function public.list_friends() to authenticated;

-- ------------------------------------------------ v7: indices de frequencia
-- A v7 criava `friend_weekly_frequency`, substituida na v8 por
-- `friend_weekly_days`. Ficam os indices, que as RPCs da v8 usam.

-- Os indices do sync sao por (dono, updated_at) e nao servem a esta consulta:
-- sem estes, cada amigo varreria `session_sets` inteira.
create index if not exists idx_sessions_user_date   on public.sessions (user_id, date);
create index if not exists idx_session_sets_session on public.session_sets (session_id);

-- ------------------------------------------ v8: graficos da aba Amigos
-- Duas RPCs alimentam os quatro cards da aba Amigos: dias treinados por semana
-- (ranking, 12 semanas e consistencia) e km corridos no mes.
--
-- As mesmas regras da v7: so amizade ACEITA, e com o toggle desligado nada
-- alem do @ sai do servidor — nulo, nao zero. So agregado, nunca a linha de
-- treino. "Dia treinado" = dia com serie concluida de `reps * kg > 0`, a regra
-- do cliente (`volumeByWeek`). O filtro `st.user_id` explicito continua: sem
-- FK entre as tabelas, nada garante que a serie seja do dono da sessao.

drop function if exists public.friend_weekly_frequency(date, date);

-- Uma linha por amigo e semana COM treino. A semana e o domingo da data
-- (`dow` 0 = domingo), igual ao `weekStartKey` do cliente; `sessions.date` ja
-- e a data local de quem treinou, entao nao depende do fuso do servidor.
--
-- Quem nao compartilha, ou compartilha e nao treinou no intervalo, vem numa
-- linha so com `week_start` nulo: o cliente precisa saber que a pessoa existe.
-- `planned_days` sao os dias da semana com rotina no Plano — a meta da
-- consistencia —, e tambem so saem com o toggle.
-- (drop antes do create: a v9 muda as colunas de retorno, e sem isto colar o
-- arquivo de novo falharia aqui ao tentar voltar ao formato antigo.)
drop function if exists public.friend_weekly_days(date, date);
create function public.friend_weekly_days(first_week date, last_week date)
returns table (
  handle       text,
  shares       boolean,
  planned_days int,
  week_start   date,
  days         int
)
language sql
security definer
stable
set search_path = public
as $$
  with amigos as (
    select p.id, p.handle, p.shares_stats
    from public.friendships f
    join public.profiles p
      on p.id = case
        when f.requester_id = (select auth.uid()) then f.addressee_id
        else f.requester_id
      end
    where (select auth.uid()) in (f.requester_id, f.addressee_id)
      and f.status = 'accepted'
  ),
  dias as (
    select distinct a.id, s.date
    from amigos a
    join public.sessions s
      on s.user_id = a.id
    join public.session_sets st
      on st.session_id = s.id
     and st.user_id = a.id
    where a.shares_stats
      and s.deleted_at is null
      and st.deleted_at is null
      and st.done
      and st.reps * st.weight_kg > 0
      and s.date between first_week and last_week + 6
  ),
  semanas as (
    select id, date - extract(dow from date)::int as week_start, count(*)::int as days
    from dias
    group by 1, 2
  ),
  planos as (
    select r.user_id as id, count(distinct r.weekday)::int as planned
    from public.routines r
    join amigos a on a.id = r.user_id
    where a.shares_stats
      and r.deleted_at is null
    group by r.user_id
  )
  select
    a.handle,
    a.shares_stats,
    case when a.shares_stats then coalesce(pl.planned, 0) end,
    w.week_start,
    w.days
  from amigos a
  left join planos pl on pl.id = a.id
  left join semanas w on w.id = a.id;
$$;

revoke all on function public.friend_weekly_days(date, date) from public, anon;
grant execute on function public.friend_weekly_days(date, date) to authenticated;

-- Km corridos no intervalo, a regra do `distanceByDate` do cliente: soma de
-- `distance_km` das series concluidas e nao apagadas. Arredonda a uma casa no
-- servidor: somar 0,1 dez vezes em `real` nao da 1.
-- (drop antes do create: a v9 muda as colunas de retorno, e sem isto colar o
-- arquivo de novo falharia aqui ao tentar voltar ao formato antigo.)
drop function if exists public.friend_monthly_distance(date, date);
create function public.friend_monthly_distance(month_start date, month_end date)
returns table (handle text, km real)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.handle,
    case when p.shares_stats then (
      select round(coalesce(sum(st.distance_km), 0)::numeric, 1)::real
      from public.sessions s
      join public.session_sets st
        on st.session_id = s.id
       and st.user_id = p.id
      where s.user_id = p.id
        and s.deleted_at is null
        and st.deleted_at is null
        and st.done
        and s.date between month_start and month_end
    ) end
  from public.friendships f
  join public.profiles p
    on p.id = case
      when f.requester_id = (select auth.uid()) then f.addressee_id
      else f.requester_id
    end
  where (select auth.uid()) in (f.requester_id, f.addressee_id)
    and f.status = 'accepted';
$$;

revoke all on function public.friend_monthly_distance(date, date) from public, anon;
grant execute on function public.friend_monthly_distance(date, date) to authenticated;

-- ------------------------------------------ v9: foto de perfil e cor por pessoa
-- A foto e identidade, como o @: aparece para amigo aceito sem depender do
-- toggle de numeros (decisao do item 12). Mora num bucket PRIVADO — URL publica
-- deixaria qualquer um com o link ver a foto —, lida por URL assinada, que o
-- Storage so emite para quem passa na policy de `select` abaixo.
--
-- O caminho e `{user_id}/{timestamp}.jpg`: a pasta amarra o arquivo ao dono
-- (as policies conferem isso), e o timestamp troca a URL a cada foto nova, sem
-- o cache do aparelho mostrar a antiga.

alter table public.profiles
  add column if not exists avatar_path text
    check (avatar_path is null or avatar_path ~ ('^' || id::text || '/[0-9]+\.jpg$'));

-- 512 KB e so JPEG: o app sempre reencoda para 256x256 antes de subir, entao
-- qualquer coisa maior ou de outro tipo nao veio do app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 524288, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Escrever e apagar: so na propria pasta. Sem `update`: cada foto nova e um
-- arquivo novo, e a antiga e apagada depois.
drop policy if exists avatar_insert on storage.objects;
create policy avatar_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatar_delete on storage.objects;
create policy avatar_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Ler: o dono, qualquer lado de uma amizade ACEITA, e quem RECEBEU um pedido do
-- dono — quem pede escolheu se mostrar para ser reconhecido. Quem so sabe o seu
-- @, ou a quem voce so pediu, nao ve a sua foto. A subconsulta em `friendships`
-- roda com o RLS de quem pergunta, que ja deixa os dois lados lerem a relacao.
drop policy if exists avatar_select on storage.objects;
create policy avatar_select on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from public.friendships f
        where (
            f.status = 'accepted'
            and (select auth.uid()) in (f.requester_id, f.addressee_id)
            and (storage.foldername(name))[1] in (f.requester_id::text, f.addressee_id::text)
          )
          or (
            f.status = 'pending'
            and f.addressee_id = (select auth.uid())
            and f.requester_id::text = (storage.foldername(name))[1]
          )
      )
    )
  );

-- `list_friends` ganha a foto e `since` (quando a relacao comecou): a cor de
-- cada amigo segue essa ordem, nao o ranking, para ninguem trocar de cor entre
-- um card e outro. A foto sai na mesma regra do Storage: aceita, ou pedido
-- recebido. Mudar as colunas de retorno exige recriar a funcao.
drop function if exists public.list_friends();
create function public.list_friends()
returns table (
  id             uuid,
  handle         text,
  status         text,
  direction      text,
  shares_stats   boolean,
  age            int,
  training_years int,
  avatar_path    text,
  since          timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.handle,
    f.status,
    case when f.requester_id = (select auth.uid()) then 'outgoing' else 'incoming' end,
    p.shares_stats,
    -- Idade e anos de treino so saem do servidor com os DOIS consentimentos.
    case when p.shares_stats and f.status = 'accepted' then p.age end,
    case when p.shares_stats and f.status = 'accepted' then p.training_years end,
    case
      when f.status = 'accepted' or f.requester_id <> (select auth.uid()) then p.avatar_path
    end,
    f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = case
      when f.requester_id = (select auth.uid()) then f.addressee_id
      else f.requester_id
    end
  where (select auth.uid()) in (f.requester_id, f.addressee_id);
$$;

revoke all on function public.list_friends() from public, anon;
grant execute on function public.list_friends() to authenticated;

-- As RPCs dos graficos ganham o `id`: e ele, e nao o @ (que a pessoa pode
-- trocar), que liga a linha do grafico a foto e a cor.
drop function if exists public.friend_weekly_days(date, date);
create function public.friend_weekly_days(first_week date, last_week date)
returns table (
  id           uuid,
  handle       text,
  shares       boolean,
  planned_days int,
  week_start   date,
  days         int
)
language sql
security definer
stable
set search_path = public
as $$
  with amigos as (
    select p.id, p.handle, p.shares_stats
    from public.friendships f
    join public.profiles p
      on p.id = case
        when f.requester_id = (select auth.uid()) then f.addressee_id
        else f.requester_id
      end
    where (select auth.uid()) in (f.requester_id, f.addressee_id)
      and f.status = 'accepted'
  ),
  dias as (
    select distinct a.id, s.date
    from amigos a
    join public.sessions s
      on s.user_id = a.id
    join public.session_sets st
      on st.session_id = s.id
     and st.user_id = a.id
    where a.shares_stats
      and s.deleted_at is null
      and st.deleted_at is null
      and st.done
      and st.reps * st.weight_kg > 0
      and s.date between first_week and last_week + 6
  ),
  semanas as (
    select id, date - extract(dow from date)::int as week_start, count(*)::int as days
    from dias
    group by 1, 2
  ),
  planos as (
    select r.user_id as id, count(distinct r.weekday)::int as planned
    from public.routines r
    join amigos a on a.id = r.user_id
    where a.shares_stats
      and r.deleted_at is null
    group by r.user_id
  )
  select
    a.id,
    a.handle,
    a.shares_stats,
    case when a.shares_stats then coalesce(pl.planned, 0) end,
    w.week_start,
    w.days
  from amigos a
  left join planos pl on pl.id = a.id
  left join semanas w on w.id = a.id;
$$;

revoke all on function public.friend_weekly_days(date, date) from public, anon;
grant execute on function public.friend_weekly_days(date, date) to authenticated;

drop function if exists public.friend_monthly_distance(date, date);
create function public.friend_monthly_distance(month_start date, month_end date)
returns table (id uuid, handle text, km real)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.handle,
    case when p.shares_stats then (
      select round(coalesce(sum(st.distance_km), 0)::numeric, 1)::real
      from public.sessions s
      join public.session_sets st
        on st.session_id = s.id
       and st.user_id = p.id
      where s.user_id = p.id
        and s.deleted_at is null
        and st.deleted_at is null
        and st.done
        and s.date between month_start and month_end
    ) end
  from public.friendships f
  join public.profiles p
    on p.id = case
      when f.requester_id = (select auth.uid()) then f.addressee_id
      else f.requester_id
    end
  where (select auth.uid()) in (f.requester_id, f.addressee_id)
    and f.status = 'accepted';
$$;

revoke all on function public.friend_monthly_distance(date, date) from public, anon;
grant execute on function public.friend_monthly_distance(date, date) to authenticated;

-- ------------------------------------------------------- v10: nome de exibicao
-- O nome que aparece no ranking. Identidade, como o @ e a foto: sai para amigo
-- aceito sem depender do toggle de numeros. Vem preenchido com o nome da conta
-- Google (o app grava no login, se estiver vazio) e a pessoa pode trocar.
--
-- 1 a 40 caracteres, sem so espaco: o app mostra so o primeiro nome, mas o
-- limite e o que impede alguem de colar um paragrafo no lugar do nome.
alter table public.profiles
  add column if not exists display_name text
    check (
      display_name is null
      or (char_length(display_name) between 1 and 40 and btrim(display_name) <> '')
    );

-- `list_friends` ganha o nome: mesma regra da foto — amizade aceita, ou pedido
-- recebido (quem pede escolheu se mostrar). Mudar as colunas exige recriar.
drop function if exists public.list_friends();
create function public.list_friends()
returns table (
  id             uuid,
  handle         text,
  status         text,
  direction      text,
  shares_stats   boolean,
  age            int,
  training_years int,
  avatar_path    text,
  since          timestamptz,
  display_name   text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.handle,
    f.status,
    case when f.requester_id = (select auth.uid()) then 'outgoing' else 'incoming' end,
    p.shares_stats,
    -- Idade e anos de treino so saem do servidor com os DOIS consentimentos.
    case when p.shares_stats and f.status = 'accepted' then p.age end,
    case when p.shares_stats and f.status = 'accepted' then p.training_years end,
    case
      when f.status = 'accepted' or f.requester_id <> (select auth.uid()) then p.avatar_path
    end,
    f.created_at,
    case
      when f.status = 'accepted' or f.requester_id <> (select auth.uid()) then p.display_name
    end
  from public.friendships f
  join public.profiles p
    on p.id = case
      when f.requester_id = (select auth.uid()) then f.addressee_id
      else f.requester_id
    end
  where (select auth.uid()) in (f.requester_id, f.addressee_id);
$$;

revoke all on function public.list_friends() from public, anon;
grant execute on function public.list_friends() to authenticated;

-- ------------------------------------------------------- v11: multi-academia
-- O Voluma passa a ter varios apps no mesmo banco: o padrao e um por academia.
-- Cada app e um MUNDO e, para todos os fins, um app diferente: perfil, @,
-- amizades e treinos de um mundo nao aparecem em outro. Ver
-- plans/16-multi-academia.md.
--
-- O mundo e uma coluna `gym_id` em cada tabela, e nao um projeto Supabase por
-- academia: um banco, uma migracao, e a mesma pessoa pode estar em dois mundos
-- com a mesma conta Google (dois apps instalados).
--
-- Compativel com o app ja instalado, que nao conhece mundo nenhum: o default
-- 'padrao' em toda coluna e em todo parametro de RPC faz ele continuar
-- funcionando como antes, no mundo padrao.
--
-- O `gym_id` vem do app e nao e verificado, de proposito: forjar o mundo so
-- permite buscar @ e pedir amizade la, porque os numeros continuam atras de
-- amizade aceita + toggle. Por isso o RLS dos treinos continua so no dono.

create table if not exists public.gyms (
  id         text primary key check (id ~ '^[a-z0-9-]{2,30}$'),
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

insert into public.gyms (id, name) values ('padrao', 'Voluma')
on conflict (id) do nothing;

-- RLS ligado, nenhuma policy e nenhum grant: o app nao le esta tabela. Ele
-- sabe o proprio mundo pelo package name, e a lista de academias clientes nao
-- tem por que sair do banco. A FK abaixo confere o `gym_id` mesmo assim: a
-- checagem de chave estrangeira nao passa pelo RLS nem pelos grants de quem
-- escreve.
alter table public.gyms enable row level security;
revoke all on public.gyms from anon, authenticated;

-- A FK e o que impede um build com slug errado de criar um mundo fantasma: o
-- banco recusa a linha. Nao contradiz o "sem FK entre as tabelas do app" do
-- inicio do arquivo: aquilo e sobre a ORDEM de chegada no push, e `gyms` e
-- cadastrada pela equipe antes de qualquer app daquele mundo existir.
do $$
declare
  target text;
begin
  foreach target in array array[
    'exercises', 'routines', 'routine_exercises', 'week_targets',
    'sessions', 'session_sets', 'body_weight_logs', 'profiles', 'friendships'
  ]
  loop
    execute format(
      'alter table public.%I
         add column if not exists gym_id text not null default %L
         references public.gyms (id)',
      target, 'padrao'
    );
  end loop;
end $$;

-- O pull do app novo filtra por dono + mundo + updated_at. Os indices antigos
-- (dono + updated_at) ficam enquanto houver app instalado que puxa sem mundo, e
-- saem numa versao futura, depois da trava do plano 16.
do $$
declare
  target text;
begin
  foreach target in array array[
    'exercises', 'routines', 'routine_exercises', 'week_targets',
    'sessions', 'session_sets', 'body_weight_logs'
  ]
  loop
    execute format(
      'create index if not exists %I on public.%I (user_id, gym_id, updated_at)',
      'idx_' || target || '_sync_gym', target
    );
  end loop;
end $$;

-- O ranking busca as sessoes de cada amigo NO MUNDO, por data.
create index if not exists idx_sessions_user_gym_date
  on public.sessions (user_id, gym_id, date);

-- ---------------------------------------------------- perfil por mundo
-- A mesma pessoa tem um perfil em cada mundo em que entrou: outro @, outra
-- foto, outro nome, outro toggle. A chave passa a ser (id, gym_id).
do $$
begin
  if (select i.indnatts from pg_index i
       where i.indrelid = 'public.profiles'::regclass and i.indisprimary) <> 2 then
    alter table public.profiles drop constraint profiles_pkey;
    alter table public.profiles add constraint profiles_pkey primary key (id, gym_id);
  end if;
end $$;

-- O @ e unico dentro do mundo. Sobre lower(handle), como antes: o cliente grava
-- normalizado, mas e o indice que garante que `luis` e `LUIS` nunca coexistam
-- se o cliente algum dia errar.
drop index if exists public.idx_profiles_handle;
create unique index if not exists idx_profiles_gym_handle
  on public.profiles (gym_id, lower(handle));

-- A foto ganha a pasta do mundo: `{user_id}/{gym_id}/{instante}.jpg`. O formato
-- antigo, sem essa pasta, continua valendo no mundo padrao: e o que o app
-- instalado grava, e sao as fotos que ja estao no bucket.
--
-- A regra antiga e achada pelo conteudo, nao pelo nome: criada inline numa
-- coluna mas citando outra (`id`), ela ganhou o nome generico `profiles_check`.
do $$
declare
  rule text;
begin
  for rule in
    select conname from pg_constraint
     where conrelid = 'public.profiles'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%avatar_path%'
  loop
    execute format('alter table public.profiles drop constraint %I', rule);
  end loop;
end $$;

alter table public.profiles add constraint profiles_avatar_path_check check (
  avatar_path is null
  or avatar_path ~ ('^' || id::text || '/' || gym_id || '/[0-9]+\.jpg$')
  or (gym_id = 'padrao' and avatar_path ~ ('^' || id::text || '/[0-9]+\.jpg$'))
);

-- --------------------------------------------------- amizade por mundo
-- A amizade pertence ao mundo onde nasceu: o mesmo par pode ser amigo em dois
-- mundos, e sao duas amizades independentes.
do $$
begin
  if (select i.indnatts from pg_index i
       where i.indrelid = 'public.friendships'::regclass and i.indisprimary) <> 3 then
    alter table public.friendships drop constraint friendships_pkey;
    alter table public.friendships add constraint friendships_pkey
      primary key (requester_id, addressee_id, gym_id);
  end if;
end $$;

-- Um par, uma linha POR MUNDO, em qualquer direcao. Sem isto, duas pessoas que
-- se pedem ao mesmo tempo criam A->B e B->A no mesmo mundo, e cada uma aparece
-- duas vezes na lista da outra.
drop index if exists public.idx_friendship_pair;
create unique index if not exists idx_friendship_gym_pair on public.friendships (
  gym_id,
  least(requester_id::text, addressee_id::text),
  greatest(requester_id::text, addressee_id::text)
);

create index if not exists idx_friendship_addressee_gym
  on public.friendships (addressee_id, gym_id, status);

-- Quem recebe um pedido so pode mudar o STATUS dele. A policy de update da v6
-- confere QUEM altera, mas nao O QUE: sem isto, quem recebeu um pedido do Caio
-- podia trocar o requester_id para a Dana e marcar como aceito, criando uma
-- amizade que a Dana nunca aceitou, com os numeros dela liberados. Com o
-- `gym_id`, daria tambem para mudar a amizade de mundo. O app so atualiza estas
-- duas colunas (`respondFriendship`).
revoke update on public.friendships from anon, authenticated;
grant update (status, updated_at) on public.friendships to authenticated;

-- ------------------------------------------------------ foto por mundo
-- A leitura confere a amizade DO MUNDO DA FOTO, que e a segunda pasta do
-- caminho; sem ela (o formato antigo), o mundo e o padrao. Insert e delete nao
-- mudam: continuam conferindo so que a primeira pasta e do dono.
drop policy if exists avatar_select on storage.objects;
create policy avatar_select on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from public.friendships f
        where f.gym_id = coalesce((storage.foldername(name))[2], 'padrao')
          and (
            (
              f.status = 'accepted'
              and (select auth.uid()) in (f.requester_id, f.addressee_id)
              and (storage.foldername(name))[1] in (f.requester_id::text, f.addressee_id::text)
            )
            or (
              f.status = 'pending'
              and f.addressee_id = (select auth.uid())
              and f.requester_id::text = (storage.foldername(name))[1]
            )
          )
      )
    )
  );

-- ------------------------------------------------------- RPCs com mundo
-- Todas ganham `gym`, por ultimo e com default 'padrao': o app instalado chama
-- sem ele e continua no mundo padrao. Mudar a assinatura cria uma funcao NOVA
-- ao lado da antiga, e com as duas uma chamada sem `gym` seria ambigua. Por
-- isso as antigas saem antes.
--
-- Os rankings filtram pelo mundo tambem as sessoes, series e rotinas, e nao so
-- a amizade: os dias treinados do Bruno no mundo Y nao entram no ranking do X.

drop function if exists public.find_profile_by_handle(text);
drop function if exists public.find_profile_by_handle(text, text);
create function public.find_profile_by_handle(target text, gym text default 'padrao')
returns table (id uuid, handle text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.handle
  from public.profiles p
  where p.gym_id = gym
    and lower(p.handle) = lower(target)
  limit 1;
$$;

revoke all on function public.find_profile_by_handle(text, text) from public, anon;
grant execute on function public.find_profile_by_handle(text, text) to authenticated;

drop function if exists public.request_friendship(text);
drop function if exists public.request_friendship(text, text);
create function public.request_friendship(target_handle text, gym text default 'padrao')
returns text
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
  target uuid;
begin
  if me is null then return 'unauthenticated'; end if;

  -- So acha quem esta NESTE mundo: e a unica coisa que o mundo libera.
  select p.id into target
  from public.profiles p
  where p.gym_id = gym
    and lower(p.handle) = lower(target_handle)
  limit 1;

  if target is null then return 'not-found'; end if;
  if target = me then return 'self'; end if;

  -- O indice do par no mundo decide se ja existe relacao, inclusive na direcao
  -- contraria (ver v6).
  begin
    insert into public.friendships (requester_id, addressee_id, status, gym_id)
    values (me, target, 'pending', gym);
  exception
    when unique_violation then return 'already';
  end;

  return 'ok';
end;
$$;

revoke all on function public.request_friendship(text, text) from public, anon;
grant execute on function public.request_friendship(text, text) to authenticated;

drop function if exists public.list_friends();
drop function if exists public.list_friends(text);
create function public.list_friends(gym text default 'padrao')
returns table (
  id             uuid,
  handle         text,
  status         text,
  direction      text,
  shares_stats   boolean,
  age            int,
  training_years int,
  avatar_path    text,
  since          timestamptz,
  display_name   text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.handle,
    f.status,
    case when f.requester_id = (select auth.uid()) then 'outgoing' else 'incoming' end,
    p.shares_stats,
    -- Idade e anos de treino so saem do servidor com os DOIS consentimentos.
    case when p.shares_stats and f.status = 'accepted' then p.age end,
    case when p.shares_stats and f.status = 'accepted' then p.training_years end,
    case
      when f.status = 'accepted' or f.requester_id <> (select auth.uid()) then p.avatar_path
    end,
    f.created_at,
    case
      when f.status = 'accepted' or f.requester_id <> (select auth.uid()) then p.display_name
    end
  from public.friendships f
  join public.profiles p
    on p.gym_id = f.gym_id
   and p.id = case
      when f.requester_id = (select auth.uid()) then f.addressee_id
      else f.requester_id
    end
  where f.gym_id = gym
    and (select auth.uid()) in (f.requester_id, f.addressee_id);
$$;

revoke all on function public.list_friends(text) from public, anon;
grant execute on function public.list_friends(text) to authenticated;

drop function if exists public.friend_weekly_days(date, date);
drop function if exists public.friend_weekly_days(date, date, text);
create function public.friend_weekly_days(
  first_week date,
  last_week  date,
  gym        text default 'padrao'
)
returns table (
  id           uuid,
  handle       text,
  shares       boolean,
  planned_days int,
  week_start   date,
  days         int
)
language sql
security definer
stable
set search_path = public
as $$
  with amigos as (
    select p.id, p.handle, p.shares_stats
    from public.friendships f
    join public.profiles p
      on p.gym_id = f.gym_id
     and p.id = case
        when f.requester_id = (select auth.uid()) then f.addressee_id
        else f.requester_id
      end
    where f.gym_id = gym
      and (select auth.uid()) in (f.requester_id, f.addressee_id)
      and f.status = 'accepted'
  ),
  dias as (
    select distinct a.id, s.date
    from amigos a
    join public.sessions s
      on s.user_id = a.id
     and s.gym_id = gym
    join public.session_sets st
      on st.session_id = s.id
     and st.user_id = a.id
     and st.gym_id = gym
    where a.shares_stats
      and s.deleted_at is null
      and st.deleted_at is null
      and st.done
      and st.reps * st.weight_kg > 0
      and s.date between first_week and last_week + 6
  ),
  semanas as (
    select id, date - extract(dow from date)::int as week_start, count(*)::int as days
    from dias
    group by 1, 2
  ),
  planos as (
    select r.user_id as id, count(distinct r.weekday)::int as planned
    from public.routines r
    join amigos a on a.id = r.user_id
    where a.shares_stats
      and r.gym_id = gym
      and r.deleted_at is null
    group by r.user_id
  )
  select
    a.id,
    a.handle,
    a.shares_stats,
    case when a.shares_stats then coalesce(pl.planned, 0) end,
    w.week_start,
    w.days
  from amigos a
  left join planos pl on pl.id = a.id
  left join semanas w on w.id = a.id;
$$;

revoke all on function public.friend_weekly_days(date, date, text) from public, anon;
grant execute on function public.friend_weekly_days(date, date, text) to authenticated;

drop function if exists public.friend_monthly_distance(date, date);
drop function if exists public.friend_monthly_distance(date, date, text);
create function public.friend_monthly_distance(
  month_start date,
  month_end   date,
  gym         text default 'padrao'
)
returns table (id uuid, handle text, km real)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.handle,
    case when p.shares_stats then (
      select round(coalesce(sum(st.distance_km), 0)::numeric, 1)::real
      from public.sessions s
      join public.session_sets st
        on st.session_id = s.id
       and st.user_id = p.id
       and st.gym_id = gym
      where s.user_id = p.id
        and s.gym_id = gym
        and s.deleted_at is null
        and st.deleted_at is null
        and st.done
        and s.date between month_start and month_end
    ) end
  from public.friendships f
  join public.profiles p
    on p.gym_id = f.gym_id
   and p.id = case
      when f.requester_id = (select auth.uid()) then f.addressee_id
      else f.requester_id
    end
  where f.gym_id = gym
    and (select auth.uid()) in (f.requester_id, f.addressee_id)
    and f.status = 'accepted';
$$;

revoke all on function public.friend_monthly_distance(date, date, text) from public, anon;
grant execute on function public.friend_monthly_distance(date, date, text) to authenticated;

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

-- --------------------------------------------------- v12: slug de academia
-- O slug vira tres coisas com regras diferentes: o package Android
-- (`com.luisf.voluma.<slug>`, que nao aceita hifen), o scheme do login
-- (`voluma-<slug>`, que nao aceita underscore) e o bundle do iOS. So letras
-- minusculas e numeros, comecando por letra, cabem nos tres sem traducao.
--
-- A regra antiga e achada pelo conteudo, como na v11: inline, ela nao tem nome
-- escolhido. Rodar de novo apaga e recria esta mesma.
do $$
declare
  rule text;
begin
  for rule in
    select conname from pg_constraint
     where conrelid = 'public.gyms'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%id ~%'
  loop
    execute format('alter table public.gyms drop constraint %I', rule);
  end loop;
end $$;

alter table public.gyms add constraint gyms_slug_check check (id ~ '^[a-z][a-z0-9]{1,29}$');

-- ------------------------------------------------ v13: relogio do servidor
-- O `updated_at` e gerado no APARELHO, e era tambem o marcador do pull. Dois
-- problemas:
--   1. O aparelho B edita offline as 10h; o A edita as 11h e sincroniza, e o
--      marcador dele fica em 11h. Quando o B sobe a edicao das 10h, o A pede
--      "depois das 11h" e nunca a recebe. O mesmo com um relogio atrasado.
--   2. O upsert do push gravava qualquer versao por cima, mesmo a mais velha.
--
-- `synced_at` e o relogio do SERVIDOR: a hora em que a linha chegou. O pull
-- passa a usa-lo como marcador. E o gatilho recusa gravar uma versao mais
-- velha (pelo `updated_at` do aparelho, que continua sendo o last-write-wins)
-- por cima de uma mais nova; o aparelho que mandou a velha busca a do servidor.
--
-- `clock_timestamp()`, e nao `now()`: `now()` e o inicio da transacao, igual
-- para todas as linhas de um lote. O pull ainda olha 60 s para tras do
-- marcador, porque uma transacao lenta pode ficar visivel depois de outra que
-- foi carimbada mais tarde.

create or replace function public.sync_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null; -- versao mais velha: o servidor fica com a que ja tem
  end if;
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

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
      'alter table public.%I add column if not exists synced_at timestamptz not null default now()',
      target
    );
    execute format(
      'create index if not exists %I on public.%I (user_id, gym_id, synced_at, id)',
      'idx_' || target || '_synced', target
    );
    -- `create or replace`, e nao drop + create: sem comando destrutivo, rodar
    -- de novo nao pede confirmacao no SQL Editor nem no MCP.
    execute format(
      'create or replace trigger sync_stamp before insert or update on public.%I
         for each row execute function public.sync_stamp()',
      target
    );
  end loop;
end $$;

-- ---------------------------------------------------- v14: feature flags
-- Permite ligar/desligar funcionalidades por academia sem novo build.
-- Chave composta (gym_id, key): cada academia tem uma configuracao por flag.

create table if not exists public.gym_flags (
  gym_id     text not null references public.gyms (id) on delete cascade,
  key        text not null,
  enabled    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (gym_id, key)
);

alter table public.gym_flags enable row level security;

-- Leitura publica: flags nao sao segredo e o app precisa delas mesmo sem login
drop policy if exists "flags_readable_by_all" on public.gym_flags;
create policy "flags_readable_by_all"
  on public.gym_flags
  for select
  to anon, authenticated
  using (true);

-- Sem policies de INSERT, UPDATE ou DELETE e sem grant de escrita para
-- anon/authenticated: so a equipe (SQL Editor / service_role) altera flags. O
-- revoke importa porque, so com RLS, UPDATE e DELETE sem policy nao dao erro:
-- passam em silencio afetando 0 linhas.
revoke insert, update, delete on public.gym_flags from anon, authenticated;

-- ---------------------------------------- v15: treinos sugeridos por academia
-- Fichas padrao cadastradas pela equipe, no SQL Editor. Para tirar um exercicio
-- da ficha, prefira `deleted_at`; o delete de verdade tambem propaga (gatilho
-- BEFORE DELETE, que roda antes do `on delete set null` da FK).
--
-- `name`, `muscle_group` e `kind` vao junto do `movement_slug` porque o servidor
-- nao conhece a biblioteca de movimentos do app: o gatilho precisa do nome para
-- achar (ou criar) o exercicio do aluno quando a ficha ganha um exercicio novo.
-- Use o mesmo nome da biblioteca (`src/movements/library.ts`).

create table if not exists public.gym_presets (
  id         uuid primary key default gen_random_uuid(),
  gym_id     text not null references public.gyms (id) on delete cascade,
  name       text not null,
  position   integer not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.gym_preset_exercises (
  id                  uuid primary key default gen_random_uuid(),
  preset_id           uuid not null references public.gym_presets (id) on delete cascade,
  gym_id              text not null references public.gyms (id) on delete cascade,
  movement_slug       text not null,
  name                text not null check (char_length(btrim(name)) between 1 and 80),
  muscle_group        text,
  kind                text not null default 'strength',
  position            integer not null default 0,
  target_sets         integer not null default 3,
  target_reps         integer not null default 10,
  target_distance_km  real not null default 0,
  target_duration_min integer not null default 0,
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create index if not exists idx_gym_presets_gym on public.gym_presets (gym_id);
create index if not exists idx_gym_preset_exercises_gym on public.gym_preset_exercises (gym_id);

-- Colunas de vinculo no plano do aluno
alter table public.routines add column if not exists preset_id uuid references public.gym_presets (id) on delete set null;
alter table public.routine_exercises add column if not exists preset_exercise_id uuid references public.gym_preset_exercises (id) on delete set null;
create index if not exists idx_routines_preset on public.routines (preset_id);
create index if not exists idx_routine_exercises_preset on public.routine_exercises (preset_exercise_id);

-- RLS
alter table public.gym_presets enable row level security;
alter table public.gym_preset_exercises enable row level security;

drop policy if exists "gym_presets_readable_by_all" on public.gym_presets;
create policy "gym_presets_readable_by_all"
  on public.gym_presets for select to anon, authenticated using (true);

drop policy if exists "gym_preset_exercises_readable_by_all" on public.gym_preset_exercises;
create policy "gym_preset_exercises_readable_by_all"
  on public.gym_preset_exercises for select to anon, authenticated using (true);

revoke insert, update, delete on public.gym_presets from anon, authenticated;
revoke insert, update, delete on public.gym_preset_exercises from anon, authenticated;

-- Mesma chave do `normalizeName` do app (sem caixa, sem acento, sem espaco
-- nas pontas), para o gatilho e a adocao no aparelho acharem o mesmo exercicio.
create or replace function public.exercise_name_key(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(
    lower(btrim(raw)),
    'áàâãäéèêëíìîïóòôõöúùûüç',
    'aaaaaeeeeiiiiooooouuuuc'
  );
$$;

-- Gatilho: a ficha mudou, as rotinas AINDA vinculadas (routines.preset_id)
-- acompanham. Rotina desvinculada pelo aluno nao e tocada, mesmo que os
-- exercicios dela ainda guardem o `preset_exercise_id`.
--   INSERT (ou restaurar um soft delete): poe o exercicio em cada rotina
--     vinculada, reaproveitando o exercicio do aluno com o mesmo nome no mundo
--     ou criando um.
--   UPDATE: series, reps, distancia, tempo, posicao e soft delete.
--   DELETE: soft delete nas rotinas (BEFORE, antes da FK zerar o vinculo).
-- Os ids existentes nao mudam, porque `week_targets` aponta para eles.
create or replace function public.propagate_preset_exercise_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r       record;
  ex      uuid;
  name_key text;
begin
  if tg_op = 'DELETE' then
    update public.routine_exercises re
       set deleted_at = clock_timestamp(),
           updated_at = clock_timestamp()
      from public.routines ro
     where re.preset_exercise_id = old.id
       and re.deleted_at is null
       and ro.id = re.routine_id
       and ro.preset_id = old.preset_id
       and ro.deleted_at is null;
    return old;
  end if;

  if tg_op = 'UPDATE' and not (old.deleted_at is not null and new.deleted_at is null) then
    update public.routine_exercises re
       set target_sets = new.target_sets,
           target_reps = new.target_reps,
           target_distance_km = new.target_distance_km,
           target_duration_min = new.target_duration_min,
           position = new.position,
           deleted_at = new.deleted_at,
           updated_at = clock_timestamp()
      from public.routines ro
     where re.preset_exercise_id = new.id
       and re.deleted_at is null
       and ro.id = re.routine_id
       and ro.preset_id = new.preset_id
       and ro.deleted_at is null;
    return new;
  end if;

  -- INSERT, ou UPDATE que restaurou um exercicio apagado
  if new.deleted_at is not null then
    return new;
  end if;
  name_key := public.exercise_name_key(new.name);

  for r in
    select ro.id, ro.user_id, ro.gym_id
      from public.routines ro
     where ro.preset_id = new.preset_id
       and ro.deleted_at is null
       and not exists (
         select 1 from public.routine_exercises re
          where re.routine_id = ro.id
            and re.preset_exercise_id = new.id
            and re.deleted_at is null
       )
  loop
    select e.id into ex
      from public.exercises e
     where e.user_id = r.user_id
       and e.gym_id = r.gym_id
       and e.deleted_at is null
       and public.exercise_name_key(e.name) = name_key
     order by e.updated_at, e.id
     limit 1;

    if ex is null then
      ex := gen_random_uuid();
      insert into public.exercises (id, user_id, gym_id, name, muscle_group, kind, updated_at)
      values (ex, r.user_id, r.gym_id, btrim(new.name), new.muscle_group, new.kind, clock_timestamp());
    end if;

    -- Um exercicio aparece uma vez por dia (mesma regra do app)
    if not exists (
      select 1 from public.routine_exercises re
       where re.routine_id = r.id and re.exercise_id = ex and re.deleted_at is null
    ) then
      insert into public.routine_exercises
        (id, user_id, gym_id, routine_id, exercise_id, preset_exercise_id, position,
         target_sets, target_reps, target_weight_kg, target_distance_km, target_duration_min, updated_at)
      values
        (gen_random_uuid(), r.user_id, r.gym_id, r.id, ex, new.id, new.position,
         new.target_sets, new.target_reps, 0, new.target_distance_km, new.target_duration_min,
         clock_timestamp());
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.propagate_preset_exercise_changes() from public, anon, authenticated;

create or replace trigger trg_propagate_preset_exercise
  after insert or update on public.gym_preset_exercises
  for each row execute function public.propagate_preset_exercise_changes();

create or replace trigger trg_propagate_preset_exercise_delete
  before delete on public.gym_preset_exercises
  for each row execute function public.propagate_preset_exercise_changes();

-- ------------------------------------------- v16: painel da academia
-- Admins e instrutores de uma academia editam o treino dos alunos dela, um a um
-- ou em lote, por um painel web. Ver plans/18-painel-admin.md.
--
-- A regra que organiza tudo: a academia escreve SO a prescricao (dias,
-- exercicios, ordem, series, reps), e SO por RPC. Nenhuma tabela ganha grant de
-- escrita para a equipe; carga, series feitas, ajuste da semana e peso corporal
-- ficam fora de alcance, e um gatilho recusa se alguma RPC tentar.
--
-- Instalar o app da academia ja vincula: quem tem dados no mundo e aluno dela.
-- O mundo `padrao` nunca tem equipe, senao ela leria a base inteira do Voluma.

-- ------------------------------------------------------------- equipe

create table if not exists public.gym_staff (
  gym_id     text not null references public.gyms (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('admin', 'instructor')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (gym_id, user_id),
  constraint gym_staff_not_padrao check (gym_id <> 'padrao')
);

create index if not exists idx_gym_staff_user on public.gym_staff (user_id);

-- Convite por e-mail: o instrutor pode nunca ter entrado. Vira linha em
-- `gym_staff` quando ele entra no painel (`staff_claim_invites`).
create table if not exists public.gym_staff_invites (
  gym_id     text not null references public.gyms (id) on delete cascade,
  email      text not null check (email = lower(btrim(email)) and email like '%@%'),
  role       text not null default 'instructor' check (role in ('admin', 'instructor')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (gym_id, email),
  constraint gym_staff_invites_not_padrao check (gym_id <> 'padrao')
);

-- Toda escrita do painel: quem, o que e em quantos alunos.
create table if not exists public.prescription_log (
  id                uuid primary key default gen_random_uuid(),
  gym_id            text not null references public.gyms (id) on delete cascade,
  actor_id          uuid references auth.users (id) on delete set null,
  action            text not null,
  params            jsonb not null,
  affected_students int not null default 0,
  affected_rows     int not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists idx_prescription_log_gym on public.prescription_log (gym_id, created_at desc);

-- A marca da prescricao no plano do aluno, par do `preset_id` da v15:
--   prescribed_by preenchido            -> prescrito; os lotes tocam
--   prescribed_by nulo, prescribed_at nao -> o aluno editou depois e desvinculou
--   os dois nulos                       -> plano do proprio aluno
-- Sem FK para auth.users, de proposito: a linha sobe do aparelho do aluno com
-- esses valores, e se a pessoa da equipe sair, a FK recusaria todo push dela
-- dali em diante (o mesmo motivo do "sem FK" do inicio do arquivo).
alter table public.routines add column if not exists prescribed_by uuid;
alter table public.routines add column if not exists prescribed_at timestamptz;

-- ---------------------------------------------------------- papeis

-- `security definer`: leem `gym_staff` por cima do RLS dela, que por sua vez as
-- usa (sem isso, a policy de gym_staff consultando gym_staff seria recursiva).
create or replace function public.my_staff_gyms()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select gym_id from public.gym_staff where user_id = (select auth.uid());
$$;

create or replace function public.my_admin_gyms()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select gym_id from public.gym_staff where user_id = (select auth.uid()) and role = 'admin';
$$;

create or replace function public.staff_role(gym text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.gym_staff where gym_id = gym and user_id = (select auth.uid());
$$;

revoke all on function public.my_staff_gyms() from public, anon;
revoke all on function public.my_admin_gyms() from public, anon;
revoke all on function public.staff_role(text) from public, anon;
grant execute on function public.my_staff_gyms() to authenticated;
grant execute on function public.my_admin_gyms() to authenticated;
grant execute on function public.staff_role(text) to authenticated;

-- Abre toda RPC do painel. Interna: so as RPCs (que rodam como dono) chamam.
create or replace function public.require_staff(gym text, need text default 'instructor')
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r text := public.staff_role(gym);
begin
  if r is null or (need = 'admin' and r <> 'admin') then
    raise exception 'sem permissao na academia %', gym using errcode = '42501';
  end if;
  return r;
end;
$$;

revoke all on function public.require_staff(text, text) from public, anon, authenticated;

-- ------------------------------------------------------------------ RLS

alter table public.gym_staff         enable row level security;
alter table public.gym_staff_invites enable row level security;
alter table public.prescription_log  enable row level security;

-- Leitura so; toda escrita passa pelas RPCs abaixo.
revoke all on public.gym_staff, public.gym_staff_invites, public.prescription_log from anon;
revoke insert, update, delete, truncate on public.gym_staff, public.gym_staff_invites, public.prescription_log
  from authenticated;
grant select on public.gym_staff, public.gym_staff_invites, public.prescription_log to authenticated;

-- Cada um ve a propria linha (e por ela sabe de quais academias e equipe); o
-- admin ve a equipe inteira da academia dele. Convites e log, so o admin.
--
-- Cria so o que falta, em vez de `drop policy` + `create`: sem comando
-- destrutivo, o MCP nao pede confirmacao (ver o v13). Mudar uma destas policies
-- depois pede uma secao nova com o `drop` explicito.
do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'gym_staff' and policyname = 'staff_read') then
    create policy staff_read on public.gym_staff
      for select
      to authenticated
      using (user_id = (select auth.uid()) or gym_id in (select public.my_admin_gyms()));
  end if;

  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'gym_staff_invites' and policyname = 'staff_invites_read') then
    create policy staff_invites_read on public.gym_staff_invites
      for select
      to authenticated
      using (gym_id in (select public.my_admin_gyms()));
  end if;

  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'prescription_log' and policyname = 'prescription_log_read') then
    create policy prescription_log_read on public.prescription_log
      for select
      to authenticated
      using (gym_id in (select public.my_admin_gyms()));
  end if;
end $$;

-- A equipe le o PLANO dos alunos da academia, para o painel montar as telas com
-- consultas simples. So select, somada a `own_rows`, que continua igual. O app
-- nao sente: o pull filtra `user_id = eu`.
--
-- Sessoes, series, peso e ajuste da semana NAO entram: a frequencia sai
-- agregada por `staff_find_students`, nunca em linha crua. `profiles` tambem
-- nao: a linha inteira traria idade, anos de treino e foto, que estao atras do
-- toggle de compartilhamento. Nome e @ saem pelo `staff_find_students`.
do $$
declare
  target text;
begin
  foreach target in array array['routines', 'routine_exercises', 'exercises']
  loop
    continue when exists (select 1 from pg_policies
                           where schemaname = 'public' and tablename = target and policyname = 'staff_select');
    execute format(
      'create policy staff_select on public.%I
         for select
         to authenticated
         using (gym_id in (select public.my_staff_gyms()))',
      target
    );
  end loop;
end $$;

-- ------------------------------------------------------- equipe: RPCs

-- O admin convida um instrutor pelo e-mail Google. Quem ja tem conta entra na
-- hora; quem nao tem fica no convite. Admin novo, so a equipe Voluma cria.
create or replace function public.staff_invite(gym text, member_email text, member_role text default 'instructor')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  mail   text := lower(btrim(member_email));
  member uuid;
begin
  perform public.require_staff(gym, 'admin');
  if member_role <> 'instructor' then
    raise exception 'so a equipe Voluma cria admin' using errcode = '42501';
  end if;
  if mail !~ '^[^@\s]+@[^@\s]+$' then
    raise exception 'e-mail invalido' using errcode = '22023';
  end if;

  select u.id into member from auth.users u where lower(u.email) = mail limit 1;
  if member is not null then
    insert into public.gym_staff (gym_id, user_id, role, invited_by)
    values (gym, member, member_role, me)
    on conflict (gym_id, user_id) do nothing;
    return 'added';
  end if;

  insert into public.gym_staff_invites (gym_id, email, role, invited_by)
  values (gym, mail, member_role, me)
  on conflict (gym_id, email) do nothing;
  return 'invited';
end;
$$;

-- Chamada pelo painel a cada login: transforma os convites do e-mail da conta
-- em equipe. O e-mail sai de `auth.users` (confirmado), nunca do JWT: o
-- `user_metadata` e editavel pelo proprio usuario.
create or replace function public.staff_claim_invites()
returns table (gym_id text, role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me   uuid := (select auth.uid());
  mail text;
begin
  select lower(u.email) into mail
    from auth.users u
   where u.id = me and u.email_confirmed_at is not null;
  if mail is null then
    return;
  end if;

  insert into public.gym_staff (gym_id, user_id, role, invited_by)
  select i.gym_id, me, i.role, i.invited_by
    from public.gym_staff_invites i
   where i.email = mail
  on conflict on constraint gym_staff_pkey do nothing;

  delete from public.gym_staff_invites i where i.email = mail;

  return query
    select s.gym_id, s.role from public.gym_staff s where s.user_id = me order by s.gym_id;
end;
$$;

create or replace function public.staff_revoke_invite(gym text, member_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_staff(gym, 'admin');
  delete from public.gym_staff_invites
   where gym_id = gym and email = lower(btrim(member_email));
end;
$$;

-- O admin tira um instrutor. Admin, so a equipe Voluma tira.
create or replace function public.staff_remove(gym text, member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_staff(gym, 'admin');
  if exists (select 1 from public.gym_staff where gym_id = gym and user_id = member and role = 'admin') then
    raise exception 'so a equipe Voluma tira um admin' using errcode = '42501';
  end if;
  delete from public.gym_staff where gym_id = gym and user_id = member;
end;
$$;

-- A equipe com e-mail, para o admin. O e-mail sai de auth.users, que a equipe
-- nao le direto.
create or replace function public.staff_list(gym text)
returns table (user_id uuid, role text, email text, display_name text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_staff(gym, 'admin');
  return query
    select s.user_id, s.role, u.email::text, p.display_name, s.created_at
      from public.gym_staff s
      join auth.users u on u.id = s.user_id
      left join public.profiles p on p.id = s.user_id and p.gym_id = s.gym_id
     where s.gym_id = gym
     order by s.role, s.created_at;
end;
$$;

-- ------------------------------------------ separacao prescricao x historico

-- Toda RPC do painel que escreve liga este marcador logo antes de escrever e o
-- desliga antes de cada `return`: ele vale so enquanto ela escreve, e nao pega
-- o que vier depois na mesma transacao. Se ela falhar no meio, o Postgres
-- desfaz o `set_config` junto com a (sub)transacao.
--
-- Nao e `set voluma.staff_write = '1'` na declaracao da funcao, que faria o
-- mesmo sozinho: no Supabase o dono das funcoes nao e superusuario, e so
-- superusuario declara parametro proprio ali ("permission denied to set
-- parameter").
-- Com ele ligado, as tabelas do historico recusam qualquer escrita. E a ultima
-- camada: as RPCs ja nao escrevem nelas, e a equipe nao tem grant em nenhuma.
create or replace function public.forbid_staff_history_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('voluma.staff_write', true) = '1' then
    raise exception 'o painel nao escreve historico (%)', tg_table_name using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.forbid_staff_history_write() from public, anon, authenticated;

do $$
declare
  target text;
begin
  foreach target in array array['sessions', 'session_sets', 'week_targets', 'body_weight_logs']
  loop
    execute format(
      'create or replace trigger forbid_staff_history_write
         before insert or update or delete on public.%I
         for each row execute function public.forbid_staff_history_write()',
      target
    );
  end loop;
end $$;

-- ------------------------------------------------------- aluno e exercicio

-- Quem tem qualquer coisa no mundo e aluno dele (decisao do plano 18).
create or replace function public.is_gym_student(gym text, student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = student and gym_id = gym)
      or exists (select 1 from public.routines where user_id = student and gym_id = gym);
$$;

revoke all on function public.is_gym_student(text, uuid) from public, anon, authenticated;

-- O exercicio do aluno com aquele nome no mundo, criado se faltar. Saiu de
-- dentro do gatilho das fichas (v15), que passa a chama-la, para o painel achar
-- o mesmo exercicio pela mesma regra.
create or replace function public.ensure_student_exercise(
  student  uuid,
  gym      text,
  ex_name  text,
  ex_group text,
  ex_kind  text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ex uuid;
begin
  select e.id into ex
    from public.exercises e
   where e.user_id = student
     and e.gym_id = gym
     and e.deleted_at is null
     and public.exercise_name_key(e.name) = public.exercise_name_key(ex_name)
   order by e.updated_at, e.id
   limit 1;

  if ex is null then
    ex := gen_random_uuid();
    insert into public.exercises (id, user_id, gym_id, name, muscle_group, kind, updated_at)
    values (ex, student, gym, btrim(ex_name), ex_group, coalesce(ex_kind, 'strength'), clock_timestamp());
  end if;
  return ex;
end;
$$;

revoke all on function public.ensure_student_exercise(uuid, text, text, text, text) from public, anon, authenticated;

-- O gatilho da v15, agora com o exercicio vindo de `ensure_student_exercise`.
-- Mesmo comportamento: o 16.6-presets.sql continua passando.
create or replace function public.propagate_preset_exercise_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r  record;
  ex uuid;
begin
  if tg_op = 'DELETE' then
    update public.routine_exercises re
       set deleted_at = clock_timestamp(),
           updated_at = clock_timestamp()
      from public.routines ro
     where re.preset_exercise_id = old.id
       and re.deleted_at is null
       and ro.id = re.routine_id
       and ro.preset_id = old.preset_id
       and ro.deleted_at is null;
    return old;
  end if;

  if tg_op = 'UPDATE' and not (old.deleted_at is not null and new.deleted_at is null) then
    update public.routine_exercises re
       set target_sets = new.target_sets,
           target_reps = new.target_reps,
           target_distance_km = new.target_distance_km,
           target_duration_min = new.target_duration_min,
           position = new.position,
           deleted_at = new.deleted_at,
           updated_at = clock_timestamp()
      from public.routines ro
     where re.preset_exercise_id = new.id
       and re.deleted_at is null
       and ro.id = re.routine_id
       and ro.preset_id = new.preset_id
       and ro.deleted_at is null;
    return new;
  end if;

  -- INSERT, ou UPDATE que restaurou um exercicio apagado
  if new.deleted_at is not null then
    return new;
  end if;

  for r in
    select ro.id, ro.user_id, ro.gym_id
      from public.routines ro
     where ro.preset_id = new.preset_id
       and ro.deleted_at is null
       and not exists (
         select 1 from public.routine_exercises re
          where re.routine_id = ro.id
            and re.preset_exercise_id = new.id
            and re.deleted_at is null
       )
  loop
    ex := public.ensure_student_exercise(r.user_id, r.gym_id, new.name, new.muscle_group, new.kind);

    -- Um exercicio aparece uma vez por dia (mesma regra do app)
    if not exists (
      select 1 from public.routine_exercises re
       where re.routine_id = r.id and re.exercise_id = ex and re.deleted_at is null
    ) then
      insert into public.routine_exercises
        (id, user_id, gym_id, routine_id, exercise_id, preset_exercise_id, position,
         target_sets, target_reps, target_weight_kg, target_distance_km, target_duration_min, updated_at)
      values
        (gen_random_uuid(), r.user_id, r.gym_id, r.id, ex, new.id, new.position,
         new.target_sets, new.target_reps, 0, new.target_distance_km, new.target_duration_min,
         clock_timestamp());
    end if;
  end loop;

  return new;
end;
$$;

-- --------------------------------------------------------------- indices
-- O painel busca pela academia inteira, e nao por dono como o pull.

create index if not exists idx_exercises_gym_namekey
  on public.exercises (gym_id, public.exercise_name_key(name)) where deleted_at is null;
create index if not exists idx_routines_gym_user
  on public.routines (gym_id, user_id) where deleted_at is null;
create index if not exists idx_routine_exercises_routine
  on public.routine_exercises (routine_id) where deleted_at is null;
create index if not exists idx_sessions_gym_date
  on public.sessions (gym_id, date) where deleted_at is null;

-- ------------------------------------------------------- prescricao: helpers

-- O carimbo de uma escrita do painel numa linha do aluno: a hora do servidor,
-- mas sempre DEPOIS da versao atual. O `sync_stamp` (v13) descarta em silencio
-- um UPDATE com `updated_at` menor que o da linha, e o `updated_at` vem do
-- relogio do aparelho: com o relogio do aluno adiantado, a prescricao sumiria.
create or replace function public.staff_stamp(ts timestamptz, current_stamp timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select greatest(ts, current_stamp + interval '1 millisecond');
$$;

revoke all on function public.staff_stamp(timestamptz, timestamptz) from public, anon, authenticated;

-- Os numeros de um item do painel dentro do que o app aceita (TargetsEditor):
-- series 1..12, reps 1..100, km 0..200, minutos 0..600.
create or replace function public.check_prescription_item(item jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(item) <> 'object'
     or coalesce(btrim(item ->> 'name'), '') = ''
     or char_length(btrim(item ->> 'name')) > 80
     or coalesce(item ->> 'kind', 'strength') not in ('strength', 'run')
     or coalesce((item ->> 'sets')::int, 3) not between 1 and 12
     or coalesce((item ->> 'reps')::int, 10) not between 1 and 100
     or coalesce((item ->> 'distance_km')::real, 0) not between 0 and 200
     or coalesce((item ->> 'duration_min')::int, 0) not between 0 and 600
  then
    raise exception 'item invalido: %', item using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.check_prescription_item(jsonb) from public, anon, authenticated;

-- ------------------------------------------- prescricao: um aluno, um dia

-- Substitui a composicao do dia inteiro: o painel manda o estado final, na
-- ordem. Itens com `routine_exercise_id` mantem a linha (o `week_targets` do
-- aluno aponta para ela); os sem id acham o exercicio pelo nome ou criam.
-- Nunca muda `target_weight_kg`: a carga e do aluno (resolveTargets vinculado).
--
-- `expected_updated_at` e a concorrencia otimista: o `updated_at` da rotina
-- quando o painel abriu o dia. Se o aluno mexeu depois, erro P0409 e o painel
-- recarrega.
create or replace function public.staff_set_day(
  gym                 text,
  student             uuid,
  day                 smallint,
  day_name            text,
  items               jsonb,
  expected_updated_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  ts     timestamptz := clock_timestamp();
  ro     public.routines%rowtype;
  item   jsonb;
  pos    int;
  slot   uuid;
  ex     uuid;
  kept   uuid[] := '{}';
  used   uuid[] := '{}';
begin
  perform public.require_staff(gym);
  if not public.is_gym_student(gym, student) then
    raise exception 'aluno fora da academia' using errcode = '42501';
  end if;
  if day not between 0 and 6 then
    raise exception 'dia invalido' using errcode = '22023';
  end if;
  if coalesce(btrim(day_name), '') = '' or char_length(btrim(day_name)) > 60 then
    raise exception 'nome do dia invalido' using errcode = '22023';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 30 then
    raise exception 'lista de exercicios invalida' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(items) loop
    perform public.check_prescription_item(item);
  end loop;

  perform set_config('voluma.staff_write', '1', true);

  -- Um dia de um aluno por vez: duas pessoas da equipe criando o mesmo dia
  -- vazio ao mesmo tempo criariam duas rotinas.
  perform pg_advisory_xact_lock(hashtextextended(student::text || '/' || gym || '/' || day, 0));

  select * into ro
    from public.routines r
   where r.user_id = student and r.gym_id = gym and r.weekday = day and r.deleted_at is null
   order by r.position, r.id
   limit 1
   for update;

  if found then
    if expected_updated_at is not null and ro.updated_at > expected_updated_at then
      raise exception 'o dia mudou desde que foi aberto' using errcode = 'P0409';
    end if;
    update public.routines
       set name = btrim(day_name),
           preset_id = null,
           prescribed_by = me,
           prescribed_at = ts,
           updated_at = public.staff_stamp(ts, updated_at)
     where id = ro.id;
  else
    ro.id := gen_random_uuid();
    insert into public.routines
      (id, user_id, gym_id, name, weekday, position, prescribed_by, prescribed_at, updated_at)
    values
      (ro.id, student, gym, btrim(day_name), day, 0, me, ts, ts);
  end if;

  for item, pos in
    select value, (ordinality - 1)::int from jsonb_array_elements(items) with ordinality
  loop
    slot := null;
    if item ? 'routine_exercise_id' and item ->> 'routine_exercise_id' is not null then
      select re.id, re.exercise_id into slot, ex
        from public.routine_exercises re
       where re.id = (item ->> 'routine_exercise_id')::uuid
         and re.routine_id = ro.id
         and re.deleted_at is null;
      if slot is null then
        raise exception 'exercicio % nao e deste dia', item ->> 'routine_exercise_id' using errcode = '22023';
      end if;
    else
      ex := public.ensure_student_exercise(
        student, gym, item ->> 'name', item ->> 'muscle_group', coalesce(item ->> 'kind', 'strength')
      );
      select re.id into slot
        from public.routine_exercises re
       where re.routine_id = ro.id and re.exercise_id = ex and re.deleted_at is null
       order by re.position, re.id
       limit 1;
    end if;

    -- Um exercicio aparece uma vez por dia: o repetido na lista e ignorado.
    continue when ex = any (used);
    used := used || ex;

    if slot is null then
      slot := gen_random_uuid();
      insert into public.routine_exercises
        (id, user_id, gym_id, routine_id, exercise_id, position,
         target_sets, target_reps, target_weight_kg, target_distance_km, target_duration_min, updated_at)
      values
        (slot, student, gym, ro.id, ex, pos,
         coalesce((item ->> 'sets')::int, 3), coalesce((item ->> 'reps')::int, 10), 0,
         coalesce((item ->> 'distance_km')::real, 0), coalesce((item ->> 'duration_min')::int, 0), ts);
    else
      update public.routine_exercises
         set position = pos,
             target_sets = coalesce((item ->> 'sets')::int, target_sets),
             target_reps = coalesce((item ->> 'reps')::int, target_reps),
             target_distance_km = coalesce((item ->> 'distance_km')::real, target_distance_km),
             target_duration_min = coalesce((item ->> 'duration_min')::int, target_duration_min),
             preset_exercise_id = null,
             updated_at = public.staff_stamp(ts, updated_at)
       where id = slot;
    end if;
    kept := kept || slot;
  end loop;

  update public.routine_exercises
     set deleted_at = ts, updated_at = public.staff_stamp(ts, updated_at)
   where routine_id = ro.id and deleted_at is null and not (id = any (kept));

  insert into public.prescription_log (gym_id, actor_id, action, params, affected_students, affected_rows)
  values (gym, me, 'set_day',
          jsonb_build_object('student', student, 'day', day, 'name', day_name, 'items', items),
          1, cardinality(kept));

  perform set_config('voluma.staff_write', '', true);
  return ro.id;
end;
$$;

-- Tira o dia do plano do aluno (soft delete da rotina e dos exercicios).
create or replace function public.staff_clear_day(gym text, student uuid, day smallint)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  ts timestamptz := clock_timestamp();
  n  int;
begin
  perform public.require_staff(gym);
  if not public.is_gym_student(gym, student) then
    raise exception 'aluno fora da academia' using errcode = '42501';
  end if;

  perform set_config('voluma.staff_write', '1', true);

  update public.routine_exercises re
     set deleted_at = ts, updated_at = public.staff_stamp(ts, re.updated_at)
    from public.routines ro
   where ro.id = re.routine_id
     and ro.user_id = student and ro.gym_id = gym and ro.weekday = day
     and ro.deleted_at is null and re.deleted_at is null;

  update public.routines
     set deleted_at = ts, updated_at = public.staff_stamp(ts, updated_at)
   where user_id = student and gym_id = gym and weekday = day and deleted_at is null;
  get diagnostics n = row_count;

  insert into public.prescription_log (gym_id, actor_id, action, params, affected_students, affected_rows)
  values (gym, me, 'clear_day', jsonb_build_object('student', student, 'day', day), 1, n);
  perform set_config('voluma.staff_write', '', true);
  return n;
end;
$$;

-- Devolve o dia ao aluno: o plano fica como esta, mas deixa de ser prescrito.
create or replace function public.staff_release_day(gym text, student uuid, day smallint)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  n  int;
begin
  perform public.require_staff(gym);
  perform set_config('voluma.staff_write', '1', true);

  update public.routines
     set prescribed_by = null, prescribed_at = null,
         updated_at = public.staff_stamp(clock_timestamp(), updated_at)
   where user_id = student and gym_id = gym and weekday = day
     and deleted_at is null and prescribed_by is not null;
  get diagnostics n = row_count;

  insert into public.prescription_log (gym_id, actor_id, action, params, affected_students, affected_rows)
  values (gym, me, 'release_day', jsonb_build_object('student', student, 'day', day), 1, n);
  perform set_config('voluma.staff_write', '', true);
  return n;
end;
$$;

-- -------------------------------------------------------- filtro de alunos

-- Os alunos da academia, com o que o painel precisa para filtrar. Todo filtro
-- nulo e ignorado. A frequencia usa a MESMA regra do dia treinado do app e do
-- `friend_weekly_days`: serie feita com `reps * weight_kg > 0`.
create or replace function public.staff_find_students(
  gym             text,
  preset          uuid    default null,
  has_exercise    text    default null,
  prescribed_only boolean default false,
  weeks           int     default 4,
  min_days        int     default null,
  max_days        int     default null,
  inactive_since  date    default null
)
returns table (
  user_id          uuid,
  display_name     text,
  handle           text,
  preset_ids       uuid[],
  prescribed_days  int,
  self_edited_days int,
  planned_days     int,
  trained_days     int,
  last_trained_on  date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_staff(gym);
  if weeks not between 1 and 52 then
    raise exception 'janela invalida' using errcode = '22023';
  end if;

  return query
  with alunos as (
    select p.id as uid from public.profiles p where p.gym_id = gym
    union
    select r.user_id from public.routines r where r.gym_id = gym and r.deleted_at is null
  ),
  plano as (
    select r.user_id as uid,
           array_agg(distinct r.preset_id) filter (where r.preset_id is not null) as presets,
           count(distinct r.weekday) filter (where r.prescribed_by is not null)::int as prescribed,
           count(distinct r.weekday) filter (where r.prescribed_by is null and r.prescribed_at is not null)::int as self_edited,
           count(distinct r.weekday)::int as planned
      from public.routines r
     where r.gym_id = gym and r.deleted_at is null
     group by r.user_id
  ),
  -- `exists` por sessao, e nao join + distinct: para na primeira serie que
  -- conta, em vez de levar todas as series da academia ate o distinct.
  dias as (
    select distinct s.user_id as uid, s.date
      from public.sessions s
     where s.gym_id = gym
       and s.deleted_at is null
       and exists (
         select 1 from public.session_sets st
          where st.session_id = s.id and st.user_id = s.user_id and st.gym_id = gym
            and st.deleted_at is null and st.done and st.reps * st.weight_kg > 0
       )
  ),
  -- Calculado uma vez para a academia, e nao uma subconsulta por aluno.
  com_exercicio as (
    select distinct r.user_id as uid
      from public.exercises e
      join public.routine_exercises re on re.exercise_id = e.id and re.deleted_at is null
      join public.routines r on r.id = re.routine_id and r.deleted_at is null and r.gym_id = gym
     where has_exercise is not null
       and e.gym_id = gym
       and e.deleted_at is null
       and public.exercise_name_key(e.name) = public.exercise_name_key(has_exercise)
  ),
  freq as (
    select d.uid,
           (count(*) filter (where d.date > current_date - weeks * 7))::int as trained,
           max(d.date) as last_on
      from dias d
     group by d.uid
  )
  select a.uid,
         p.display_name,
         p.handle,
         coalesce(pl.presets, '{}'),
         coalesce(pl.prescribed, 0),
         coalesce(pl.self_edited, 0),
         coalesce(pl.planned, 0),
         coalesce(f.trained, 0),
         f.last_on
    from alunos a
    left join public.profiles p on p.id = a.uid and p.gym_id = gym
    left join plano pl on pl.uid = a.uid
    left join freq f on f.uid = a.uid
   where (preset is null or preset = any (pl.presets))
     and (not prescribed_only or coalesce(pl.prescribed, 0) > 0)
     and (min_days is null or coalesce(f.trained, 0) >= min_days)
     and (max_days is null or coalesce(f.trained, 0) <= max_days)
     and (inactive_since is null or f.last_on is null or f.last_on < inactive_since)
     and (has_exercise is null or a.uid in (select c.uid from com_exercicio c))
   order by lower(coalesce(p.display_name, p.handle, a.uid::text));
end;
$$;

-- ------------------------------------------------------ lote: trocar exercicio

-- Troca um exercicio por outro nos dias PRESCRITOS dos alunos da lista. Dia
-- desvinculado ou do proprio aluno nao e tocado; dia ligado a uma ficha muda
-- pela ficha (`include_presets`).
--
-- A linha velha sai (soft delete) e entra uma nova na mesma posicao, com as
-- mesmas series e reps e carga 0: o ajuste da semana e o historico continuam
-- presos ao exercicio velho, e a carga do novo vem do historico do aluno, se
-- houver. Se o dia ja tem o exercicio novo, so o velho sai.
--
-- `dry_run` (o padrao) so conta. O painel aplica com a mesma lista que mostrou
-- na previa.
create or replace function public.staff_swap_exercise(
  gym             text,
  from_name       text,
  to_name         text,
  to_group        text,
  to_kind         text,
  students        uuid[],
  include_presets boolean default false,
  to_slug         text    default null,
  dry_run         boolean default true
)
returns table (
  students_affected     int,
  rows_affected         int,
  skipped_self_managed  int,
  skipped_preset_linked int,
  skipped_duplicate     int,
  presets_affected      int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me       uuid := (select auth.uid());
  ts       timestamptz := clock_timestamp();
  from_key text := public.exercise_name_key(from_name);
  to_key   text := public.exercise_name_key(to_name);
  n_stu    int;
  n_rows   int;
  n_self   int;
  n_preset int;
  n_dup    int;
  n_pre    int := 0;
  pe       record;
begin
  perform public.require_staff(gym);
  if coalesce(from_key, '') = '' or coalesce(to_key, '') = '' or from_key = to_key then
    raise exception 'troca invalida' using errcode = '22023';
  end if;
  if char_length(btrim(to_name)) > 80 or coalesce(to_kind, 'strength') not in ('strength', 'run') then
    raise exception 'exercicio novo invalido' using errcode = '22023';
  end if;
  if cardinality(students) > 2000 then
    raise exception 'no maximo 2000 alunos por lote' using errcode = '22023';
  end if;
  if include_presets and coalesce(btrim(to_slug), '') = '' then
    raise exception 'a ficha precisa do movement_slug do exercicio novo' using errcode = '22023';
  end if;

  create temporary table if not exists pg_temp.swap_rows (
    re_id uuid, routine_id uuid, user_id uuid, klass text,
    position int, target_sets int, target_reps int, target_distance_km real, target_duration_min int
  ) on commit drop;
  truncate pg_temp.swap_rows;

  insert into pg_temp.swap_rows
  select re.id, ro.id, ro.user_id,
         case
           when ro.prescribed_by is not null then
             case when exists (
               select 1
                 from public.routine_exercises re2
                 join public.exercises e2 on e2.id = re2.exercise_id and e2.deleted_at is null
                where re2.routine_id = ro.id and re2.deleted_at is null
                  and public.exercise_name_key(e2.name) = to_key
             ) then 'dup' else 'swap' end
           when ro.preset_id is not null then 'preset'
           else 'self'
         end,
         re.position, re.target_sets, re.target_reps, re.target_distance_km, re.target_duration_min
    from public.routines ro
    join public.routine_exercises re on re.routine_id = ro.id and re.deleted_at is null
    join public.exercises e on e.id = re.exercise_id and e.deleted_at is null
   where ro.gym_id = gym
     and ro.user_id = any (students)
     and ro.deleted_at is null
     and public.exercise_name_key(e.name) = from_key;

  select count(distinct s.user_id) filter (where s.klass in ('swap', 'dup'))::int,
         count(*) filter (where s.klass in ('swap', 'dup'))::int,
         count(*) filter (where s.klass = 'self')::int,
         count(*) filter (where s.klass = 'preset')::int,
         count(*) filter (where s.klass = 'dup')::int
    into n_stu, n_rows, n_self, n_preset, n_dup
    from pg_temp.swap_rows s;

  if include_presets then
    select count(*)::int into n_pre
      from public.gym_preset_exercises gpe
      join public.gym_presets gp on gp.id = gpe.preset_id and gp.deleted_at is null
     where gpe.gym_id = gym and gpe.deleted_at is null
       and public.exercise_name_key(gpe.name) = from_key;
  end if;

  if dry_run then
    return query select n_stu, n_rows, n_self, n_preset, n_dup, n_pre;
    return;
  end if;

  perform set_config('voluma.staff_write', '1', true);

  -- Trava as rotinas atingidas, sempre na mesma ordem: dois lotes ao mesmo
  -- tempo esperam um pelo outro em vez de travar em deadlock.
  perform 1 from public.routines r
   where r.id in (select s.routine_id from pg_temp.swap_rows s where s.klass in ('swap', 'dup'))
   order by r.id
   for update;

  -- O exercicio novo no catalogo de quem ainda nao tem.
  insert into public.exercises (id, user_id, gym_id, name, muscle_group, kind, updated_at)
  select gen_random_uuid(), u.user_id, gym, btrim(to_name), to_group, coalesce(to_kind, 'strength'), ts
    from (select distinct s.user_id from pg_temp.swap_rows s where s.klass = 'swap') u
   where not exists (
     select 1 from public.exercises e
      where e.user_id = u.user_id and e.gym_id = gym and e.deleted_at is null
        and public.exercise_name_key(e.name) = to_key
   );

  update public.routine_exercises re
     set deleted_at = ts, updated_at = public.staff_stamp(ts, re.updated_at)
    from pg_temp.swap_rows s
   where s.re_id = re.id and s.klass in ('swap', 'dup');

  insert into public.routine_exercises
    (id, user_id, gym_id, routine_id, exercise_id, position,
     target_sets, target_reps, target_weight_kg, target_distance_km, target_duration_min, updated_at)
  select gen_random_uuid(), s.user_id, gym, s.routine_id,
         (select e.id from public.exercises e
           where e.user_id = s.user_id and e.gym_id = gym and e.deleted_at is null
             and public.exercise_name_key(e.name) = to_key
           order by e.updated_at, e.id limit 1),
         s.position, s.target_sets, s.target_reps, 0, s.target_distance_km, s.target_duration_min, ts
    from pg_temp.swap_rows s
   where s.klass = 'swap';

  update public.routines r
     set prescribed_by = me, prescribed_at = ts, updated_at = public.staff_stamp(ts, r.updated_at)
   where r.id in (select s.routine_id from pg_temp.swap_rows s where s.klass in ('swap', 'dup'));

  -- Nas fichas: o velho sai e o novo entra; o gatilho da v15 leva as duas
  -- mudancas para as rotinas vinculadas. Troca de nome no lugar ele nao leva.
  if include_presets then
    for pe in
      select gpe.*
        from public.gym_preset_exercises gpe
        join public.gym_presets gp on gp.id = gpe.preset_id and gp.deleted_at is null
       where gpe.gym_id = gym and gpe.deleted_at is null
         and public.exercise_name_key(gpe.name) = from_key
       order by gpe.id
    loop
      update public.gym_preset_exercises
         set deleted_at = ts, updated_at = ts
       where id = pe.id;

      if not exists (
        select 1 from public.gym_preset_exercises x
         where x.preset_id = pe.preset_id and x.deleted_at is null
           and public.exercise_name_key(x.name) = to_key
      ) then
        insert into public.gym_preset_exercises
          (preset_id, gym_id, movement_slug, name, muscle_group, kind, position,
           target_sets, target_reps, target_distance_km, target_duration_min, updated_at)
        values
          (pe.preset_id, gym, btrim(to_slug), btrim(to_name), to_group, coalesce(to_kind, 'strength'),
           pe.position, pe.target_sets, pe.target_reps, pe.target_distance_km, pe.target_duration_min, ts);
      end if;
    end loop;
  end if;

  insert into public.prescription_log (gym_id, actor_id, action, params, affected_students, affected_rows)
  values (gym, me, 'swap_exercise',
          jsonb_build_object('from', from_name, 'to', to_name, 'students', to_jsonb(students),
                             'include_presets', include_presets),
          n_stu, n_rows);

  perform set_config('voluma.staff_write', '', true);
  return query select n_stu, n_rows, n_self, n_preset, n_dup, n_pre;
end;
$$;

-- ------------------------------------------------------ lote: series e reps

-- Ajusta series e reps nos dias PRESCRITOS dos alunos da lista. Muda a propria
-- linha: o ajuste da semana do aluno continua valendo ate domingo. Corrida nao
-- entra. Filtros nulos sao ignorados; `*_set` ganha de `*_delta`.
create or replace function public.staff_adjust_volume(
  gym         text,
  students    uuid[],
  match_name  text     default null,
  match_group text     default null,
  match_day   smallint default null,
  sets_delta  int      default 0,
  reps_delta  int      default 0,
  sets_set    int      default null,
  reps_set    int      default null,
  dry_run     boolean  default true
)
returns table (
  students_affected     int,
  rows_affected         int,
  skipped_self_managed  int,
  skipped_preset_linked int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  ts     timestamptz := clock_timestamp();
  n_stu  int;
  n_rows int;
  n_self int;
  n_pre  int;
begin
  perform public.require_staff(gym);
  if coalesce(sets_delta, 0) = 0 and coalesce(reps_delta, 0) = 0 and sets_set is null and reps_set is null then
    raise exception 'nada para ajustar' using errcode = '22023';
  end if;
  if sets_set is not null and sets_set not between 1 and 12
     or reps_set is not null and reps_set not between 1 and 100 then
    raise exception 'valor fora do limite' using errcode = '22023';
  end if;
  if cardinality(students) > 2000 then
    raise exception 'no maximo 2000 alunos por lote' using errcode = '22023';
  end if;

  create temporary table if not exists pg_temp.volume_rows (
    re_id uuid, routine_id uuid, user_id uuid, klass text, new_sets int, new_reps int
  ) on commit drop;
  truncate pg_temp.volume_rows;

  insert into pg_temp.volume_rows
  select re.id, ro.id, ro.user_id,
         case
           when ro.prescribed_by is not null then 'adjust'
           when ro.preset_id is not null then 'preset'
           else 'self'
         end,
         greatest(1, least(12, coalesce(sets_set, re.target_sets + coalesce(sets_delta, 0)))),
         greatest(1, least(100, coalesce(reps_set, re.target_reps + coalesce(reps_delta, 0))))
    from public.routines ro
    join public.routine_exercises re on re.routine_id = ro.id and re.deleted_at is null
    join public.exercises e on e.id = re.exercise_id and e.deleted_at is null
   where ro.gym_id = gym
     and ro.user_id = any (students)
     and ro.deleted_at is null
     and e.kind <> 'run'
     and (match_name is null or public.exercise_name_key(e.name) = public.exercise_name_key(match_name))
     and (match_group is null or lower(e.muscle_group) = lower(match_group))
     and (match_day is null or ro.weekday = match_day)
     -- So o que muda de fato: linha igual nao precisa descer para o aparelho.
     and (ro.prescribed_by is null
          or re.target_sets <> greatest(1, least(12, coalesce(sets_set, re.target_sets + coalesce(sets_delta, 0))))
          or re.target_reps <> greatest(1, least(100, coalesce(reps_set, re.target_reps + coalesce(reps_delta, 0)))));

  select count(distinct v.user_id) filter (where v.klass = 'adjust')::int,
         count(*) filter (where v.klass = 'adjust')::int,
         count(*) filter (where v.klass = 'self')::int,
         count(*) filter (where v.klass = 'preset')::int
    into n_stu, n_rows, n_self, n_pre
    from pg_temp.volume_rows v;

  if dry_run then
    return query select n_stu, n_rows, n_self, n_pre;
    return;
  end if;

  perform set_config('voluma.staff_write', '1', true);

  perform 1 from public.routines r
   where r.id in (select v.routine_id from pg_temp.volume_rows v where v.klass = 'adjust')
   order by r.id
   for update;

  update public.routine_exercises re
     set target_sets = v.new_sets, target_reps = v.new_reps,
         updated_at = public.staff_stamp(ts, re.updated_at)
    from pg_temp.volume_rows v
   where v.re_id = re.id and v.klass = 'adjust';

  update public.routines r
     set prescribed_at = ts, prescribed_by = me, updated_at = public.staff_stamp(ts, r.updated_at)
   where r.id in (select v.routine_id from pg_temp.volume_rows v where v.klass = 'adjust');

  insert into public.prescription_log (gym_id, actor_id, action, params, affected_students, affected_rows)
  values (gym, me, 'adjust_volume',
          jsonb_build_object('students', to_jsonb(students), 'match_name', match_name,
                             'match_group', match_group, 'match_day', match_day,
                             'sets_delta', sets_delta, 'reps_delta', reps_delta,
                             'sets_set', sets_set, 'reps_set', reps_set),
          n_stu, n_rows);

  perform set_config('voluma.staff_write', '', true);
  return query select n_stu, n_rows, n_self, n_pre;
end;
$$;

-- ---------------------------------------------------------- fichas no painel

-- Grava uma ficha inteira (declarativa, como `staff_set_day`). Exercicio que
-- troca de nome ou de movimento sai e entra de novo, porque o gatilho da v15 so
-- leva series, reps, posicao e remocao para as rotinas vinculadas.
--   preset = { "id"?: uuid, "name", "position"?, "exercises": [{ "id"?: uuid,
--              "movement_slug", "name", "muscle_group", "kind", "sets", "reps",
--              "distance_km", "duration_min" }] }
create or replace function public.staff_upsert_preset(gym text, preset jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me   uuid := (select auth.uid());
  ts   timestamptz := clock_timestamp();
  pid  uuid := nullif(preset ->> 'id', '')::uuid;
  item jsonb;
  pos  int;
  cur  public.gym_preset_exercises%rowtype;
  kept uuid[] := '{}';
  eid  uuid;
begin
  perform public.require_staff(gym);
  if coalesce(btrim(preset ->> 'name'), '') = '' or char_length(btrim(preset ->> 'name')) > 60 then
    raise exception 'nome da ficha invalido' using errcode = '22023';
  end if;
  if jsonb_typeof(preset -> 'exercises') <> 'array' or jsonb_array_length(preset -> 'exercises') > 30 then
    raise exception 'lista de exercicios invalida' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(preset -> 'exercises') loop
    perform public.check_prescription_item(item);
    if coalesce(btrim(item ->> 'movement_slug'), '') = '' then
      raise exception 'exercicio sem movement_slug: %', item using errcode = '22023';
    end if;
  end loop;

  perform set_config('voluma.staff_write', '1', true);

  if pid is null then
    insert into public.gym_presets (gym_id, name, position, updated_at)
    values (gym, btrim(preset ->> 'name'), coalesce((preset ->> 'position')::int, 0), ts)
    returning id into pid;
  else
    update public.gym_presets
       set name = btrim(preset ->> 'name'),
           position = coalesce((preset ->> 'position')::int, position),
           updated_at = ts
     where id = pid and gym_id = gym and deleted_at is null;
    if not found then
      raise exception 'ficha % nao e desta academia', pid using errcode = '22023';
    end if;
    -- O dia adotado tem o nome da ficha (repo.ts adota assim).
    update public.routines
       set name = btrim(preset ->> 'name'), updated_at = public.staff_stamp(ts, updated_at)
     where preset_id = pid and deleted_at is null and name <> btrim(preset ->> 'name');
  end if;

  for item, pos in
    select value, (ordinality - 1)::int from jsonb_array_elements(preset -> 'exercises') with ordinality
  loop
    eid := nullif(item ->> 'id', '')::uuid;
    cur := null;
    if eid is not null then
      select * into cur from public.gym_preset_exercises
       where id = eid and preset_id = pid and deleted_at is null;
      if cur.id is null then
        raise exception 'exercicio % nao e desta ficha', eid using errcode = '22023';
      end if;
    end if;

    if cur.id is not null
       and public.exercise_name_key(cur.name) = public.exercise_name_key(item ->> 'name')
       and cur.movement_slug = btrim(item ->> 'movement_slug') then
      update public.gym_preset_exercises
         set position = pos,
             muscle_group = item ->> 'muscle_group',
             target_sets = coalesce((item ->> 'sets')::int, 3),
             target_reps = coalesce((item ->> 'reps')::int, 10),
             target_distance_km = coalesce((item ->> 'distance_km')::real, 0),
             target_duration_min = coalesce((item ->> 'duration_min')::int, 0),
             updated_at = ts
       where id = cur.id;
      kept := kept || cur.id;
    else
      insert into public.gym_preset_exercises
        (preset_id, gym_id, movement_slug, name, muscle_group, kind, position,
         target_sets, target_reps, target_distance_km, target_duration_min, updated_at)
      values
        (pid, gym, btrim(item ->> 'movement_slug'), btrim(item ->> 'name'), item ->> 'muscle_group',
         coalesce(item ->> 'kind', 'strength'), pos,
         coalesce((item ->> 'sets')::int, 3), coalesce((item ->> 'reps')::int, 10),
         coalesce((item ->> 'distance_km')::real, 0), coalesce((item ->> 'duration_min')::int, 0), ts)
      returning id into eid;
      kept := kept || eid;
    end if;
  end loop;

  update public.gym_preset_exercises
     set deleted_at = ts, updated_at = ts
   where preset_id = pid and deleted_at is null and not (id = any (kept));

  insert into public.prescription_log (gym_id, actor_id, action, params, affected_students, affected_rows)
  values (gym, me, 'upsert_preset', jsonb_build_object('preset', pid, 'body', preset), 0, cardinality(kept));

  perform set_config('voluma.staff_write', '', true);
  return pid;
end;
$$;

-- Apaga uma ficha sem apagar o treino de quem a adotou: os dias vinculados se
-- desvinculam ANTES (e ficam com os exercicios que tinham), e so depois a ficha
-- e os exercicios dela saem. Na ordem contraria, o gatilho da v15 apagaria os
-- exercicios das rotinas vinculadas.
create or replace function public.staff_delete_preset(gym text, preset uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  ts timestamptz := clock_timestamp();
  n  int;
begin
  perform public.require_staff(gym);
  if not exists (select 1 from public.gym_presets where id = preset and gym_id = gym and deleted_at is null) then
    raise exception 'ficha % nao e desta academia', preset using errcode = '22023';
  end if;

  perform set_config('voluma.staff_write', '1', true);

  update public.routines
     set preset_id = null, updated_at = public.staff_stamp(ts, updated_at)
   where preset_id = preset and deleted_at is null;
  get diagnostics n = row_count;

  update public.gym_preset_exercises
     set deleted_at = ts, updated_at = ts
   where preset_id = preset and deleted_at is null;

  update public.gym_presets
     set deleted_at = ts, updated_at = ts
   where id = preset;

  insert into public.prescription_log (gym_id, actor_id, action, params, affected_students, affected_rows)
  values (gym, me, 'delete_preset', jsonb_build_object('preset', preset), n, n);
  perform set_config('voluma.staff_write', '', true);
  return n;
end;
$$;

-- ------------------------------------------------ conflito com o aluno offline

-- A regra: edicao do aluno ANTERIOR a prescricao perde; posterior desvincula.
-- Linha que ja existe ja e coberta pelo `sync_stamp` (versao mais velha e
-- recusada). Falta a linha NOVA: um exercicio que o aluno pos offline num dia
-- que o instrutor prescreveu depois entraria e misturaria os dois planos. Ela
-- entra ja apagada, com carimbo novo, e o pull do mesmo ciclo apaga no aparelho.
--
-- So linha nova de verdade: o push e um upsert, e o BEFORE INSERT roda tambem
-- quando o conflito vira UPDATE. Sem o `not exists`, uma edicao velha de uma
-- linha existente viraria remocao com carimbo novo, passando pelo `sync_stamp`.
--
-- Os gatilhos BEFORE rodam em ordem alfabetica: este ("reject…") antes do
-- `sync_stamp`, que carimba o `synced_at` por ultimo.
create or replace function public.reject_stale_student_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  stamp timestamptz;
begin
  if current_setting('voluma.staff_write', true) = '1' or new.deleted_at is not null then
    return new;
  end if;
  select r.prescribed_at into stamp
    from public.routines r
   where r.id = new.routine_id and r.prescribed_by is not null;
  if stamp is not null
     and new.updated_at < stamp
     and not exists (select 1 from public.routine_exercises re where re.id = new.id) then
    new.deleted_at := clock_timestamp();
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;

revoke all on function public.reject_stale_student_insert() from public, anon, authenticated;

create or replace trigger reject_stale_student_insert
  before insert on public.routine_exercises
  for each row execute function public.reject_stale_student_insert();

-- -------------------------------------------------------------- permissoes
-- O Postgres da EXECUTE a PUBLIC em toda funcao nova, e `security definer` em
-- `public` vira endpoint da API. Toda RPC do painel: so `authenticated`, e a
-- primeira linha dela confere a academia.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.staff_invite(text, text, text)',
    'public.staff_claim_invites()',
    'public.staff_revoke_invite(text, text)',
    'public.staff_remove(text, uuid)',
    'public.staff_list(text)',
    'public.staff_set_day(text, uuid, smallint, text, jsonb, timestamptz)',
    'public.staff_clear_day(text, uuid, smallint)',
    'public.staff_release_day(text, uuid, smallint)',
    'public.staff_find_students(text, uuid, text, boolean, int, int, int, date)',
    'public.staff_swap_exercise(text, text, text, text, text, uuid[], boolean, text, boolean)',
    'public.staff_adjust_volume(text, uuid[], text, text, smallint, int, int, int, int, boolean)',
    'public.staff_upsert_preset(text, jsonb)',
    'public.staff_delete_preset(text, uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- ------------------------------------------ v17: indices das FKs do painel
-- As FKs da v16 para auth.users com `on delete set null`: apagar uma conta
-- procura as linhas dela nestas tabelas, e o log cresce para sempre. Achado na
-- checagem dos advisors depois de aplicar a v16.
create index if not exists idx_gym_staff_invited_by on public.gym_staff (invited_by);
create index if not exists idx_gym_staff_invites_invited_by on public.gym_staff_invites (invited_by);
create index if not exists idx_prescription_log_actor on public.prescription_log (actor_id);

-- --------------------------------------------- v18: planos da academia
-- Um plano e um programa da semana: cada dia aponta para um treino, e cada
-- treino e uma ficha (`gym_presets`), com o editor e a propagacao que ja
-- existem. Ver plans/20-planos.md.
--
-- Quem esta no plano se le das rotinas do aluno, e nao de uma tabela de
-- membros: um dia SEGUE o plano P quando `plan_id = P` e `preset_id` nao e
-- nulo. O aluno que edita o dia no app zera o `preset_id` (desvincula), e com
-- isso o dia sai do plano mesmo num app que ainda nao conhece o `plan_id`.

create table if not exists public.gym_plans (
  id               uuid primary key default gen_random_uuid(),
  gym_id           text not null references public.gyms (id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 60),
  open_to_students boolean not null default false,
  position         int not null default 0,
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

-- Um dia do plano aponta para um treino. Sem linha viva = descanso.
create table if not exists public.gym_plan_days (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references public.gym_plans (id) on delete cascade,
  gym_id     text not null references public.gyms (id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),
  preset_id  uuid not null references public.gym_presets (id),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_gym_plans_gym on public.gym_plans (gym_id);
create unique index if not exists idx_gym_plan_days_live
  on public.gym_plan_days (plan_id, weekday) where deleted_at is null;
create index if not exists idx_gym_plan_days_preset on public.gym_plan_days (preset_id);

-- O dia do aluno sabe de qual plano veio. Sem FK, pelo mesmo motivo do
-- `prescribed_by`: a linha sobe do aparelho com esse valor.
alter table public.routines add column if not exists plan_id uuid;
create index if not exists idx_routines_plan on public.routines (plan_id) where deleted_at is null;

-- Excecao do instrutor para UM aluno: series, reps, km e minutos proprios, que
-- a ficha nao sobrescreve. Posicao e remocao continuam vindo da ficha.
alter table public.routine_exercises add column if not exists custom_targets boolean not null default false;

-- ------------------------------------------------------------------ RLS
-- Le o plano: o anonimo, so os abertos (o app sem conta escolhe entre eles);
-- quem entrou, os abertos, os da academia em que e equipe e os que segue. O dia
-- do plano aparece quando o plano aparece (a policy dele consulta gym_plans,
-- que passa pelo RLS de gym_plans).

alter table public.gym_plans     enable row level security;
alter table public.gym_plan_days enable row level security;
revoke insert, update, delete, truncate on public.gym_plans, public.gym_plan_days from anon, authenticated;
grant select on public.gym_plans, public.gym_plan_days to anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'gym_plans' and policyname = 'plans_read_open') then
    create policy plans_read_open on public.gym_plans
      for select
      to anon
      using (open_to_students);
  end if;

  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'gym_plans' and policyname = 'plans_read') then
    create policy plans_read on public.gym_plans
      for select
      to authenticated
      using (
        open_to_students
        or gym_id in (select public.my_staff_gyms())
        or exists (select 1 from public.routines r
                    where r.plan_id = gym_plans.id and r.user_id = (select auth.uid()))
      );
  end if;

  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'gym_plan_days' and policyname = 'plan_days_read') then
    create policy plan_days_read on public.gym_plan_days
      for select
      to anon, authenticated
      using (exists (select 1 from public.gym_plans p where p.id = gym_plan_days.plan_id));
  end if;
end $$;

-- ------------------------------------------ propagacao respeita a excecao
-- O gatilho da v16, com uma mudanca: na linha com `custom_targets`, os numeros
-- ficam como o instrutor deixou para aquele aluno.
create or replace function public.propagate_preset_exercise_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r  record;
  ex uuid;
begin
  if tg_op = 'DELETE' then
    update public.routine_exercises re
       set deleted_at = clock_timestamp(),
           updated_at = clock_timestamp()
      from public.routines ro
     where re.preset_exercise_id = old.id
       and re.deleted_at is null
       and ro.id = re.routine_id
       and ro.preset_id = old.preset_id
       and ro.deleted_at is null;
    return old;
  end if;

  if tg_op = 'UPDATE' and not (old.deleted_at is not null and new.deleted_at is null) then
    update public.routine_exercises re
       set target_sets = case when re.custom_targets then re.target_sets else new.target_sets end,
           target_reps = case when re.custom_targets then re.target_reps else new.target_reps end,
           target_distance_km = case when re.custom_targets then re.target_distance_km else new.target_distance_km end,
           target_duration_min = case when re.custom_targets then re.target_duration_min else new.target_duration_min end,
           position = new.position,
           deleted_at = new.deleted_at,
           updated_at = clock_timestamp()
      from public.routines ro
     where re.preset_exercise_id = new.id
       and re.deleted_at is null
       and ro.id = re.routine_id
       and ro.preset_id = new.preset_id
       and ro.deleted_at is null;
    return new;
  end if;

  -- INSERT, ou UPDATE que restaurou um exercicio apagado
  if new.deleted_at is not null then
    return new;
  end if;

  for r in
    select ro.id, ro.user_id, ro.gym_id
      from public.routines ro
     where ro.preset_id = new.preset_id
       and ro.deleted_at is null
       and not exists (
         select 1 from public.routine_exercises re
          where re.routine_id = ro.id
            and re.preset_exercise_id = new.id
            and re.deleted_at is null
       )
  loop
    ex := public.ensure_student_exercise(r.user_id, r.gym_id, new.name, new.muscle_group, new.kind);

    -- Um exercicio aparece uma vez por dia (mesma regra do app)
    if not exists (
      select 1 from public.routine_exercises re
       where re.routine_id = r.id and re.exercise_id = ex and re.deleted_at is null
    ) then
      insert into public.routine_exercises
        (id, user_id, gym_id, routine_id, exercise_id, preset_exercise_id, position,
         target_sets, target_reps, target_weight_kg, target_distance_km, target_duration_min, updated_at)
      values
        (gen_random_uuid(), r.user_id, r.gym_id, r.id, ex, new.id, new.position,
         new.target_sets, new.target_reps, 0, new.target_distance_km, new.target_duration_min,
         clock_timestamp());
    end if;
  end loop;

  return new;
end;
$$;

-- ------------------------------------------------ um treino num dia do aluno

-- Poe o treino (ficha) no dia do aluno, como o `adoptPresetIntoDay` do app: as
-- linhas que o dia tinha saem, as da ficha entram, e o dia fica vinculado a
-- ficha e ao plano. Interna: quem chama confere a academia e liga o marcador.
--
-- O `week_targets` do dia nao e tocado (o guarda proibe): os ajustes da semana
-- ficam presos as linhas que sairam, e ficam inertes.
create or replace function public.apply_preset_to_day(
  student uuid,
  gym     text,
  day     smallint,
  preset  uuid,
  plan    uuid,
  ts      timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid   uuid;
  pname text;
  pe    record;
  ex    uuid;
  used  uuid[] := '{}';
begin
  select p.name into pname
    from public.gym_presets p
   where p.id = preset and p.gym_id = gym and p.deleted_at is null;
  if pname is null then
    raise exception 'treino % nao e desta academia', preset using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(student::text || '/' || gym || '/' || day, 0));

  select r.id into rid
    from public.routines r
   where r.user_id = student and r.gym_id = gym and r.weekday = day and r.deleted_at is null
   order by r.position, r.id
   limit 1
   for update;

  if rid is null then
    rid := gen_random_uuid();
    insert into public.routines (id, user_id, gym_id, name, weekday, position, preset_id, plan_id, updated_at)
    values (rid, student, gym, pname, day, 0, preset, plan, ts);
  else
    update public.routines
       set name = pname,
           preset_id = preset,
           plan_id = plan,
           prescribed_by = null,
           prescribed_at = null,
           updated_at = public.staff_stamp(ts, updated_at)
     where id = rid;
    update public.routine_exercises
       set deleted_at = ts, updated_at = public.staff_stamp(ts, updated_at)
     where routine_id = rid and deleted_at is null;
  end if;

  for pe in
    select x.* from public.gym_preset_exercises x
     where x.preset_id = preset and x.deleted_at is null
     order by x.position, x.id
  loop
    ex := public.ensure_student_exercise(student, gym, pe.name, pe.muscle_group, pe.kind);
    continue when ex = any (used);
    used := used || ex;
    insert into public.routine_exercises
      (id, user_id, gym_id, routine_id, exercise_id, preset_exercise_id, position,
       target_sets, target_reps, target_weight_kg, target_distance_km, target_duration_min, updated_at)
    values
      (gen_random_uuid(), student, gym, rid, ex, pe.id, pe.position,
       pe.target_sets, pe.target_reps, 0, pe.target_distance_km, pe.target_duration_min, ts);
  end loop;

  return rid;
end;
$$;

revoke all on function public.apply_preset_to_day(uuid, text, smallint, uuid, uuid, timestamptz)
  from public, anon, authenticated;

-- O dia como a atribuicao o enxerga: vazio, ja no plano, ou ocupado por quem.
create or replace function public.plan_day_state(student uuid, gym text, day smallint, plan uuid, preset uuid)
returns table (state text, current_name text)
language sql
stable
security definer
set search_path = ''
as $$
  with dia as (
    select r.*
      from public.routines r
     where r.user_id = student and r.gym_id = gym and r.weekday = day and r.deleted_at is null
     order by r.position, r.id
     limit 1
  )
  select case
           when d.id is null
             or not exists (select 1 from public.routine_exercises re
                             where re.routine_id = d.id and re.deleted_at is null) then 'empty'
           when d.plan_id = plan and d.preset_id = preset then 'same_plan'
           when d.plan_id is not null and d.preset_id is not null then 'other_plan'
           when d.preset_id is not null then 'preset'
           when d.prescribed_by is not null then 'instructor'
           else 'own'
         end,
         d.name
    from (select 1) one
    left join dia d on true;
$$;

revoke all on function public.plan_day_state(uuid, text, smallint, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------- plano: editar

-- Grava o plano inteiro: nome, se e aberto no app e os dias (`weekday` ->
-- treino). O que muda chega em quem segue o plano:
--   dia com outro treino -> os alunos que seguem aquele dia recebem o novo;
--   dia novo             -> entra em quem tem o dia vazio; os outros contam em `skipped`;
--   dia tirado           -> o dia do aluno sai do plano e fica como prescrito,
--                           com os exercicios que tinha.
--   plan = { "id"?, "name", "open_to_students"?, "position"?, "days": [{ "weekday", "preset_id" }] }
create or replace function public.staff_upsert_plan(gym text, plan jsonb)
returns table (plan_id uuid, students_updated int, skipped int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  ts      timestamptz := clock_timestamp();
  pid     uuid := nullif(plan ->> 'id', '')::uuid;
  d       jsonb;
  wd      smallint;
  pr      uuid;
  cur     public.gym_plan_days%rowtype;
  m       record;
  n_upd   int := 0;
  n_skip  int := 0;
  kept    smallint[] := '{}';
begin
  perform public.require_staff(gym);
  if coalesce(btrim(plan ->> 'name'), '') = '' or char_length(btrim(plan ->> 'name')) > 60 then
    raise exception 'nome do plano invalido' using errcode = '22023';
  end if;
  if jsonb_typeof(plan -> 'days') <> 'array' or jsonb_array_length(plan -> 'days') > 7 then
    raise exception 'dias do plano invalidos' using errcode = '22023';
  end if;
  for d in select value from jsonb_array_elements(plan -> 'days') loop
    wd := (d ->> 'weekday')::smallint;
    if wd is null or wd not between 0 and 6 or wd = any (kept) then
      raise exception 'dia invalido ou repetido: %', d using errcode = '22023';
    end if;
    kept := kept || wd;
    if not exists (select 1 from public.gym_presets p
                    where p.id = (d ->> 'preset_id')::uuid and p.gym_id = gym and p.deleted_at is null) then
      raise exception 'treino % nao e desta academia', d ->> 'preset_id' using errcode = '22023';
    end if;
  end loop;

  perform set_config('voluma.staff_write', '1', true);

  if pid is null then
    insert into public.gym_plans (gym_id, name, open_to_students, position, updated_at)
    values (gym, btrim(plan ->> 'name'), coalesce((plan ->> 'open_to_students')::boolean, false),
            coalesce((plan ->> 'position')::int, 0), ts)
    returning id into pid;
  else
    update public.gym_plans
       set name = btrim(plan ->> 'name'),
           open_to_students = coalesce((plan ->> 'open_to_students')::boolean, open_to_students),
           position = coalesce((plan ->> 'position')::int, position),
           updated_at = ts
     where id = pid and gym_id = gym and deleted_at is null;
    if not found then
      raise exception 'plano % nao e desta academia', pid using errcode = '22023';
    end if;
  end if;

  -- Dias que sairam do plano: o dia do aluno fica com o que tem, como prescrito.
  for cur in
    select x.* from public.gym_plan_days x
     where x.plan_id = pid and x.deleted_at is null and not (x.weekday = any (kept))
  loop
    update public.gym_plan_days set deleted_at = ts, updated_at = ts where id = cur.id;
    update public.routines r
       set plan_id = null, preset_id = null, prescribed_by = me, prescribed_at = ts,
           updated_at = public.staff_stamp(ts, r.updated_at)
     where r.gym_id = gym and r.plan_id = pid and r.weekday = cur.weekday
       and r.preset_id is not null and r.deleted_at is null;
  end loop;

  for d in select value from jsonb_array_elements(plan -> 'days') loop
    wd := (d ->> 'weekday')::smallint;
    pr := (d ->> 'preset_id')::uuid;
    select x.* into cur from public.gym_plan_days x
     where x.plan_id = pid and x.weekday = wd and x.deleted_at is null;

    if cur.id is not null and cur.preset_id = pr then
      continue;
    end if;

    if cur.id is not null then
      -- Outro treino no dia: quem segue aquele dia recebe o novo.
      update public.gym_plan_days set preset_id = pr, updated_at = ts where id = cur.id;
      for m in
        select r.user_id from public.routines r
         where r.gym_id = gym and r.plan_id = pid and r.weekday = wd
           and r.preset_id = cur.preset_id and r.deleted_at is null
      loop
        perform public.apply_preset_to_day(m.user_id, gym, wd, pr, pid, ts);
        n_upd := n_upd + 1;
      end loop;
    else
      -- Dia novo: entra em quem segue o plano e tem esse dia vazio.
      insert into public.gym_plan_days (plan_id, gym_id, weekday, preset_id, updated_at)
      values (pid, gym, wd, pr, ts);
      for m in
        select distinct r.user_id from public.routines r
         where r.gym_id = gym and r.plan_id = pid and r.preset_id is not null and r.deleted_at is null
      loop
        if (select s.state from public.plan_day_state(m.user_id, gym, wd, pid, pr) s) = 'empty' then
          perform public.apply_preset_to_day(m.user_id, gym, wd, pr, pid, ts);
          n_upd := n_upd + 1;
        else
          n_skip := n_skip + 1;
        end if;
      end loop;
    end if;
    cur := null;
  end loop;

  insert into public.prescription_log (gym_id, actor_id, action, params, affected_students, affected_rows)
  values (gym, me, 'upsert_plan', jsonb_build_object('plan', pid, 'body', plan), n_upd, n_upd);

  perform set_config('voluma.staff_write', '', true);
  return query select pid, n_upd, n_skip;
end;
$$;

-- Apaga o plano sem tirar o treino de ninguem: os dias continuam ligados aos
-- treinos (fichas), so deixam de ser do plano.
create or replace function public.staff_delete_plan(gym text, plan uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  ts timestamptz := clock_timestamp();
  n  int;
begin
  perform public.require_staff(gym);
  if not exists (select 1 from public.gym_plans p where p.id = plan and p.gym_id = gym and p.deleted_at is null) then
    raise exception 'plano % nao e desta academia', plan using errcode = '22023';
  end if;
  perform set_config('voluma.staff_write', '1', true);

  update public.routines r
     set plan_id = null, updated_at = public.staff_stamp(ts, r.updated_at)
   where r.gym_id = gym and r.plan_id = plan and r.deleted_at is null;
  get diagnostics n = row_count;

  update public.gym_plan_days set deleted_at = ts, updated_at = ts where plan_id = plan and deleted_at is null;
  update public.gym_plans set deleted_at = ts, updated_at = ts where id = plan;

  insert into public.prescription_log (gym_id, actor_id, action, params, affected_students, affected_rows)
  values (gym, me, 'delete_plan', jsonb_build_object('plan', plan), n, n);
  perform set_config('voluma.staff_write', '', true);
  return n;
end;
$$;

-- ------------------------------------------------------- plano: atribuir

-- Poe o plano nos alunos da lista. `dry_run` (o padrao) so classifica cada dia
-- de cada aluno; aplicar substitui so o que a previa mostrou e o instrutor
-- marcou:
--   empty      -> entra sempre
--   same_plan  -> nada a fazer
--   own, instructor, preset, other_plan -> so se o par estiver em `replace`
--   replace = [{ "user_id": uuid, "weekday": 0..6 }]
--
-- Lote grande: o painel manda em pedacos (o PostgREST corta a consulta longa).
create or replace function public.staff_assign_plan(
  gym      text,
  plan     uuid,
  students uuid[],
  replace  jsonb   default '[]',
  dry_run  boolean default true
)
returns table (user_id uuid, weekday smallint, current text, current_name text, action text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me    uuid := (select auth.uid());
  ts    timestamptz := clock_timestamp();
  s     uuid;
  d     record;
  st    record;
  act   text;
  n     int := 0;
  pairs text[];
begin
  perform public.require_staff(gym);
  if not exists (select 1 from public.gym_plans p where p.id = plan and p.gym_id = gym and p.deleted_at is null) then
    raise exception 'plano % nao e desta academia', plan using errcode = '22023';
  end if;
  if cardinality(students) > 500 then
    raise exception 'no maximo 500 alunos por chamada' using errcode = '22023';
  end if;
  if jsonb_typeof(replace) <> 'array' then
    raise exception 'replace invalido' using errcode = '22023';
  end if;
  select coalesce(array_agg((x ->> 'user_id') || '/' || (x ->> 'weekday')), '{}') into pairs
    from jsonb_array_elements(replace) x;

  if not dry_run then
    perform set_config('voluma.staff_write', '1', true);
  end if;

  foreach s in array students loop
    continue when not public.is_gym_student(gym, s);
    for d in
      select x.weekday, x.preset_id from public.gym_plan_days x
       where x.plan_id = plan and x.deleted_at is null
       order by x.weekday
    loop
      select * into st from public.plan_day_state(s, gym, d.weekday, plan, d.preset_id);
      act := case
               when st.state = 'same_plan' then 'unchanged'
               when st.state = 'empty' or (s::text || '/' || d.weekday) = any (pairs) then 'apply'
               else 'skip'
             end;
      if not dry_run and act = 'apply' then
        perform public.apply_preset_to_day(s, gym, d.weekday, d.preset_id, plan, ts);
        n := n + 1;
      end if;
      user_id := s;
      weekday := d.weekday;
      current := st.state;
      current_name := st.current_name;
      action := act;
      return next;
    end loop;
  end loop;

  if not dry_run then
    insert into public.prescription_log (gym_id, actor_id, action, params, affected_students, affected_rows)
    values (gym, me, 'assign_plan',
            jsonb_build_object('plan', plan, 'students', to_jsonb(students), 'replace', replace),
            cardinality(students), n);
    perform set_config('voluma.staff_write', '', true);
  end if;
end;
$$;

-- Tira os alunos do plano: os dias deles ficam com os exercicios que tinham,
-- como dias prescritos (os lotes continuam alcancando).
create or replace function public.staff_remove_from_plan(gym text, plan uuid, students uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  ts timestamptz := clock_timestamp();
  n  int;
begin
  perform public.require_staff(gym);
  perform set_config('voluma.staff_write', '1', true);

  update public.routines r
     set plan_id = null, preset_id = null, prescribed_by = me, prescribed_at = ts,
         updated_at = public.staff_stamp(ts, r.updated_at)
   where r.gym_id = gym and r.plan_id = plan and r.user_id = any (students)
     and r.preset_id is not null and r.deleted_at is null;
  get diagnostics n = row_count;

  insert into public.prescription_log (gym_id, actor_id, action, params, affected_students, affected_rows)
  values (gym, me, 'remove_from_plan', jsonb_build_object('plan', plan, 'students', to_jsonb(students)),
          cardinality(students), n);
  perform set_config('voluma.staff_write', '', true);
  return n;
end;
$$;

-- --------------------------------------------- um aluno: excecoes no dia

-- Personaliza um dia que segue um treino (de plano ou ficha) sem tira-lo de la.
-- Mesmo formato do `staff_set_day`; o que difere do treino vira excecao:
--   numeros diferentes dos da ficha -> `custom_targets` (a ficha nao sobrescreve)
--   exercicio novo                  -> linha sem vinculo (a ficha nao toca)
--   exercicio que sumiu da lista    -> soft delete (a ficha nao recria)
-- Dia que nao segue treino nenhum se edita pelo `staff_set_day`.
create or replace function public.staff_customize_day(
  gym                 text,
  student             uuid,
  day                 smallint,
  items               jsonb,
  expected_updated_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me    uuid := (select auth.uid());
  ts    timestamptz := clock_timestamp();
  ro    public.routines%rowtype;
  item  jsonb;
  pos   int;
  slot  uuid;
  ex    uuid;
  base  public.gym_preset_exercises%rowtype;
  rec   public.routine_exercises%rowtype;
  kept  uuid[] := '{}';
  used  uuid[] := '{}';
  ns    int;
  nr    int;
  nd    real;
  nm    int;
begin
  perform public.require_staff(gym);
  if not public.is_gym_student(gym, student) then
    raise exception 'aluno fora da academia' using errcode = '42501';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 30 then
    raise exception 'lista de exercicios invalida' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(items) loop
    perform public.check_prescription_item(item);
  end loop;

  perform set_config('voluma.staff_write', '1', true);
  perform pg_advisory_xact_lock(hashtextextended(student::text || '/' || gym || '/' || day, 0));

  select * into ro
    from public.routines r
   where r.user_id = student and r.gym_id = gym and r.weekday = day and r.deleted_at is null
   order by r.position, r.id
   limit 1
   for update;
  if not found or ro.preset_id is null then
    raise exception 'o dia nao segue um treino; use staff_set_day' using errcode = '22023';
  end if;
  if expected_updated_at is not null and ro.updated_at > expected_updated_at then
    raise exception 'o dia mudou desde que foi aberto' using errcode = 'P0409';
  end if;

  for item, pos in
    select value, (ordinality - 1)::int from jsonb_array_elements(items) with ordinality
  loop
    slot := null;
    if item ? 'routine_exercise_id' and item ->> 'routine_exercise_id' is not null then
      select re.id, re.exercise_id into slot, ex
        from public.routine_exercises re
       where re.id = (item ->> 'routine_exercise_id')::uuid and re.routine_id = ro.id and re.deleted_at is null;
      if slot is null then
        raise exception 'exercicio % nao e deste dia', item ->> 'routine_exercise_id' using errcode = '22023';
      end if;
    else
      ex := public.ensure_student_exercise(
        student, gym, item ->> 'name', item ->> 'muscle_group', coalesce(item ->> 'kind', 'strength'));
      select re.id into slot
        from public.routine_exercises re
       where re.routine_id = ro.id and re.exercise_id = ex and re.deleted_at is null
       order by re.position, re.id
       limit 1;
    end if;

    continue when ex = any (used);
    used := used || ex;

    if slot is null then
      slot := gen_random_uuid();
      insert into public.routine_exercises
        (id, user_id, gym_id, routine_id, exercise_id, position,
         target_sets, target_reps, target_weight_kg, target_distance_km, target_duration_min, updated_at)
      values
        (slot, student, gym, ro.id, ex, pos,
         coalesce((item ->> 'sets')::int, 3), coalesce((item ->> 'reps')::int, 10), 0,
         coalesce((item ->> 'distance_km')::real, 0), coalesce((item ->> 'duration_min')::int, 0), ts);
    else
      select * into rec from public.routine_exercises where id = slot;
      ns := coalesce((item ->> 'sets')::int, rec.target_sets);
      nr := coalesce((item ->> 'reps')::int, rec.target_reps);
      nd := coalesce((item ->> 'distance_km')::real, rec.target_distance_km);
      nm := coalesce((item ->> 'duration_min')::int, rec.target_duration_min);
      base := null;
      if rec.preset_exercise_id is not null then
        select * into base from public.gym_preset_exercises where id = rec.preset_exercise_id;
      end if;
      update public.routine_exercises
         set position = pos,
             target_sets = ns, target_reps = nr, target_distance_km = nd, target_duration_min = nm,
             -- So e excecao o que difere da ficha: voltar aos numeros dela desfaz.
             custom_targets = base.id is not null
                              and (ns <> base.target_sets or nr <> base.target_reps
                                   or nd <> base.target_distance_km or nm <> base.target_duration_min),
             updated_at = public.staff_stamp(ts, updated_at)
       where id = slot;
    end if;
    kept := kept || slot;
  end loop;

  update public.routine_exercises
     set deleted_at = ts, updated_at = public.staff_stamp(ts, updated_at)
   where routine_id = ro.id and deleted_at is null and not (id = any (kept));

  update public.routines set updated_at = public.staff_stamp(ts, updated_at) where id = ro.id;

  insert into public.prescription_log (gym_id, actor_id, action, params, affected_students, affected_rows)
  values (gym, me, 'customize_day',
          jsonb_build_object('student', student, 'day', day, 'items', items), 1, cardinality(kept));

  perform set_config('voluma.staff_write', '', true);
  return ro.id;
end;
$$;

-- "Voltar ao plano": refaz o dia a partir do treino e apaga as excecoes.
create or replace function public.staff_reset_day(gym text, student uuid, day smallint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me  uuid := (select auth.uid());
  ts  timestamptz := clock_timestamp();
  ro  public.routines%rowtype;
  rid uuid;
begin
  perform public.require_staff(gym);
  if not public.is_gym_student(gym, student) then
    raise exception 'aluno fora da academia' using errcode = '42501';
  end if;
  select * into ro
    from public.routines r
   where r.user_id = student and r.gym_id = gym and r.weekday = day and r.deleted_at is null
   order by r.position, r.id
   limit 1;
  if not found or ro.preset_id is null then
    raise exception 'o dia nao segue um treino' using errcode = '22023';
  end if;

  perform set_config('voluma.staff_write', '1', true);
  rid := public.apply_preset_to_day(student, gym, day, ro.preset_id, ro.plan_id, ts);

  insert into public.prescription_log (gym_id, actor_id, action, params, affected_students, affected_rows)
  values (gym, me, 'reset_day', jsonb_build_object('student', student, 'day', day), 1, 1);
  perform set_config('voluma.staff_write', '', true);
  return rid;
end;
$$;

-- ------------------------------------------------------ alunos de um plano

-- Quem segue o plano, e como: quantos dias do plano segue e quantos tem excecao.
create or replace function public.staff_plan_members(gym text, plan uuid)
returns table (
  user_id         uuid,
  display_name    text,
  handle          text,
  plan_days       int,
  following_days  int,
  customized_days int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_staff(gym);
  return query
  with dias_plano as (
    select count(*)::int as n from public.gym_plan_days x where x.plan_id = plan and x.deleted_at is null
  ),
  seguindo as (
    select r.* from public.routines r
     where r.gym_id = gym and r.plan_id = plan and r.preset_id is not null and r.deleted_at is null
  )
  select s.user_id,
         p.display_name,
         p.handle,
         (select n from dias_plano),
         count(distinct s.weekday)::int,
         (count(distinct s.weekday) filter (where public.day_has_exceptions(s.id, s.preset_id)))::int
    from seguindo s
    left join public.profiles p on p.id = s.user_id and p.gym_id = gym
   group by s.user_id, p.display_name, p.handle
   order by lower(coalesce(p.display_name, p.handle, s.user_id::text));
end;
$$;

-- O dia tem excecao: numeros proprios, exercicio a mais, ou exercicio da ficha
-- que saiu so deste aluno.
create or replace function public.day_has_exceptions(routine uuid, preset uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.routine_exercises re
            where re.routine_id = routine and re.deleted_at is null
              and (re.custom_targets or re.preset_exercise_id is null))
      or exists (
           select 1 from public.gym_preset_exercises gpe
            where gpe.preset_id = preset and gpe.deleted_at is null
              and not exists (select 1 from public.routine_exercises re
                               where re.routine_id = routine and re.deleted_at is null
                                 and re.preset_exercise_id = gpe.id));
$$;

revoke all on function public.day_has_exceptions(uuid, uuid) from public, anon, authenticated;

-- ------------------------------------------- filtro de alunos com plano
-- Ganha o filtro por plano (`plan`, ou `no_plan`) e as colunas `plan_ids` e
-- `customized_days`. Muda o retorno, por isso sai e volta (create or replace
-- nao troca o tipo de retorno).
drop function if exists public.staff_find_students(text, uuid, text, boolean, int, int, int, date);

create or replace function public.staff_find_students(
  gym             text,
  preset          uuid    default null,
  has_exercise    text    default null,
  prescribed_only boolean default false,
  weeks           int     default 4,
  min_days        int     default null,
  max_days        int     default null,
  inactive_since  date    default null,
  plan            uuid    default null,
  no_plan         boolean default false
)
returns table (
  user_id          uuid,
  display_name     text,
  handle           text,
  preset_ids       uuid[],
  plan_ids         uuid[],
  prescribed_days  int,
  self_edited_days int,
  customized_days  int,
  planned_days     int,
  trained_days     int,
  last_trained_on  date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_staff(gym);
  if weeks not between 1 and 52 then
    raise exception 'janela invalida' using errcode = '22023';
  end if;

  return query
  with alunos as (
    select p.id as uid from public.profiles p where p.gym_id = gym
    union
    select r.user_id from public.routines r where r.gym_id = gym and r.deleted_at is null
  ),
  plano as (
    select r.user_id as uid,
           array_agg(distinct r.preset_id) filter (where r.preset_id is not null) as presets,
           array_agg(distinct r.plan_id) filter (where r.plan_id is not null and r.preset_id is not null) as plans,
           count(distinct r.weekday) filter (where r.prescribed_by is not null)::int as prescribed,
           count(distinct r.weekday) filter (
             where r.prescribed_by is null and r.prescribed_at is not null and r.preset_id is null)::int as self_edited,
           count(distinct r.weekday) filter (
             where r.preset_id is not null and public.day_has_exceptions(r.id, r.preset_id))::int as customized,
           count(distinct r.weekday)::int as planned
      from public.routines r
     where r.gym_id = gym and r.deleted_at is null
     group by r.user_id
  ),
  -- `exists` por sessao, e nao join + distinct: para na primeira serie que
  -- conta, em vez de levar todas as series da academia ate o distinct.
  dias as (
    select distinct s.user_id as uid, s.date
      from public.sessions s
     where s.gym_id = gym
       and s.deleted_at is null
       and exists (
         select 1 from public.session_sets st
          where st.session_id = s.id and st.user_id = s.user_id and st.gym_id = gym
            and st.deleted_at is null and st.done and st.reps * st.weight_kg > 0
       )
  ),
  -- Calculado uma vez para a academia, e nao uma subconsulta por aluno.
  com_exercicio as (
    select distinct r.user_id as uid
      from public.exercises e
      join public.routine_exercises re on re.exercise_id = e.id and re.deleted_at is null
      join public.routines r on r.id = re.routine_id and r.deleted_at is null and r.gym_id = gym
     where has_exercise is not null
       and e.gym_id = gym
       and e.deleted_at is null
       and public.exercise_name_key(e.name) = public.exercise_name_key(has_exercise)
  ),
  freq as (
    select d.uid,
           (count(*) filter (where d.date > current_date - weeks * 7))::int as trained,
           max(d.date) as last_on
      from dias d
     group by d.uid
  )
  select a.uid,
         p.display_name,
         p.handle,
         coalesce(pl.presets, '{}'),
         coalesce(pl.plans, '{}'),
         coalesce(pl.prescribed, 0),
         coalesce(pl.self_edited, 0),
         coalesce(pl.customized, 0),
         coalesce(pl.planned, 0),
         coalesce(f.trained, 0),
         f.last_on
    from alunos a
    left join public.profiles p on p.id = a.uid and p.gym_id = gym
    left join plano pl on pl.uid = a.uid
    left join freq f on f.uid = a.uid
   where (preset is null or preset = any (pl.presets))
     and (plan is null or plan = any (pl.plans))
     and (not no_plan or coalesce(cardinality(pl.plans), 0) = 0)
     and (not prescribed_only or coalesce(pl.prescribed, 0) > 0)
     and (min_days is null or coalesce(f.trained, 0) >= min_days)
     and (max_days is null or coalesce(f.trained, 0) <= max_days)
     and (inactive_since is null or f.last_on is null or f.last_on < inactive_since)
     and (has_exercise is null or a.uid in (select c.uid from com_exercicio c))
   order by lower(coalesce(p.display_name, p.handle, a.uid::text));
end;
$$;

-- ------------------------------------------ ficha usada num plano nao sai
-- O `staff_delete_preset` da v16, que agora recusa apagar um treino que um
-- plano ainda usa: o dia do plano ficaria apontando para um treino apagado.
create or replace function public.staff_delete_preset(gym text, preset uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  me    uuid := (select auth.uid());
  ts    timestamptz := clock_timestamp();
  n     int;
  plano text;
begin
  perform public.require_staff(gym);
  if not exists (select 1 from public.gym_presets where id = preset and gym_id = gym and deleted_at is null) then
    raise exception 'ficha % nao e desta academia', preset using errcode = '22023';
  end if;
  select p.name into plano
    from public.gym_plan_days d
    join public.gym_plans p on p.id = d.plan_id and p.deleted_at is null
   where d.preset_id = preset and d.deleted_at is null
   limit 1;
  if plano is not null then
    raise exception 'o treino esta no plano "%"; tire do plano antes', plano using errcode = '22023';
  end if;

  perform set_config('voluma.staff_write', '1', true);

  update public.routines
     set preset_id = null, updated_at = public.staff_stamp(ts, updated_at)
   where preset_id = preset and deleted_at is null;
  get diagnostics n = row_count;

  update public.gym_preset_exercises
     set deleted_at = ts, updated_at = ts
   where preset_id = preset and deleted_at is null;

  update public.gym_presets
     set deleted_at = ts, updated_at = ts
   where id = preset;

  insert into public.prescription_log (gym_id, actor_id, action, params, affected_students, affected_rows)
  values (gym, me, 'delete_preset', jsonb_build_object('preset', preset), n, n);
  perform set_config('voluma.staff_write', '', true);
  return n;
end;
$$;

-- -------------------------------------------------------------- permissoes
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.staff_upsert_plan(text, jsonb)',
    'public.staff_delete_plan(text, uuid)',
    'public.staff_assign_plan(text, uuid, uuid[], jsonb, boolean)',
    'public.staff_remove_from_plan(text, uuid, uuid[])',
    'public.staff_customize_day(text, uuid, smallint, jsonb, timestamptz)',
    'public.staff_reset_day(text, uuid, smallint)',
    'public.staff_plan_members(text, uuid)',
    'public.staff_find_students(text, uuid, text, boolean, int, int, int, date, uuid, boolean)',
    'public.staff_delete_preset(text, uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

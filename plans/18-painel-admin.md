# 18 — Painel da academia: backend (v16)

**Arquivos:** `supabase/schema.sql` (v16), `supabase/tests/18-painel.sql` (novo),
`src/db/schema.ts`, `src/db/repo.ts`, telas do Plano, do dia e do onboarding
**Depende de:** [16](16-multi-academia.md)
**Estado:** **18.1 a 18.5 e 18.7 feitas no código** (2026-10-22): v16 no `schema.sql`, `18-painel.sql` e os seis testes SQL anteriores passando num Postgres 18 local com um stub do Supabase, Jest com 649 testes passando. **Falta:** aplicar a v16 no Supabase (produção, com confirmação), o teste no aparelho e a 18.6 (Realtime, opcional). O painel web fica para um plano próprio.

### O que mudou na implementação (em relação ao desenho abaixo)

- **`profiles` ficou fora da leitura da equipe.** A linha inteira traria idade, anos de treino e foto, que estão atrás do toggle de compartilhamento. O painel lê nome e @ pelo `staff_find_students`.
- **O marcador `voluma.staff_write` vai na declaração da função** (`set voluma.staff_write = '1'`), e não num `set_config(..., true)`. Assim ele vale só enquanto a RPC roda; o `set_config` duraria até o fim da transação, e o teste pegou isso (a escrita do aluno logo depois passava como se fosse da equipe).
- **`staff_stamp(ts, updated_at)`:** toda escrita do painel numa linha do aluno usa `greatest(ts, updated_at + 1 ms)`. O `sync_stamp` (v13) descarta em silêncio um UPDATE com `updated_at` menor que o da linha. Com o relógio do aparelho do aluno adiantado, a prescrição sumiria.
- **`prescribed_by` sem FK para `auth.users`:** a linha sobe do aparelho do aluno com esse valor, e se a pessoa da equipe sair, a FK recusaria todo push dele dali em diante.
- **O gatilho de conflito só age em linha nova de verdade** (`not exists` pelo id). O push é um upsert, e o BEFORE INSERT roda também quando o conflito vira UPDATE: sem isso, uma edição velha de uma linha existente viraria remoção com carimbo novo.
- **`staff_delete_preset` desvincula os dias antes de apagar a ficha.** Na ordem contrária, o gatilho da v15 apagaria os exercícios de quem a adotou.
- **O aviso de privacidade ficou no Perfil (Nuvem) e no login, atrás da flag `staff_panel`.** É no login que os dados passam a sair do aparelho; sem conta, a equipe não vê nada. A flag liga quando a academia passa a usar o painel.
- **Desempenho medido localmente** (1.000 alunos, 6 dias com 6 exercícios, 600 mil séries): `staff_find_students` em 0,2 s, a troca de 3.000 exercícios em 0,3 s e o ajuste de 18.000 em 0,6 s.

## Contexto

O Voluma está virando um produto vendido para academias (plano 16): cada academia tem o próprio app e o próprio mundo (`gym_id`), e hoje a academia só fala com o aluno pelas fichas sugeridas, cadastradas pela equipe no SQL Editor. O próximo passo é um **painel web** em que admins e instrutores da academia editam o treino dos alunos, um a um ou em lote. Exemplo de lote: a polia quebrou, então todo mundo que faz "Puxada alta" passa a fazer "Puxada na máquina".

Este plano é **só o backend** (Supabase/Postgres) e as mudanças mínimas no app para ele entender a prescrição. A interface do painel fica para um plano próprio.

### O que já existe e é reaproveitado

| Peça | Onde | Uso aqui |
|---|---|---|
| `gym_id` em toda tabela, FK para `gyms` | `supabase/schema.sql` v11 | escopo de tudo |
| `sync_stamp`: carimba `synced_at` e recusa versão mais velha | v13 | escrita do painel desce no pull sem mudar o engine |
| Vínculo com ficha (`routines.preset_id`) e desvínculo ao editar | v15, `src/db/repo.ts:347` `unlinkRoutineIfLinked` | modelo do vínculo com o instrutor |
| `resolveTargets(..., isLinked)`: séries e reps do instrutor, carga do aluno | `src/domain/targets.ts:73` | já separa prescrição e carga no app |
| Achar ou criar o exercício do aluno pelo nome | `propagate_preset_exercise_changes` + `exercise_name_key` (v15) | vira a função `ensure_student_exercise` |
| Regra do dia treinado (série feita, `reps * weight_kg > 0`) | `friend_weekly_days` (v8+) | filtro por frequência |
| Pull ao voltar para o app | `src/sync/auth.ts:233` `useSyncLifecycle` | gatilho do sync |

### Decisões tomadas nesta conversa (22/10/2026)

1. **Instalar o app da academia já vincula o aluno.** Quem tem dados no mundo é aluno daquela academia, e a equipe vê o plano e a frequência dele. O `gym_id` continua sem verificação (risco já aceito no plano 16): quem forja um mundo só expõe os próprios dados à equipe daquele mundo. O mundo `padrao` **nunca** tem equipe. Quem usa o app sem conta não aparece no painel.
2. **Se o aluno edita um dia prescrito, ele desvincula**, com aviso antes, igual à ficha. Lotes deixam de tocar aquele dia, e o painel mostra "editado pelo aluno".
3. **O ajuste da semana (stepper) vale até domingo.** O painel não toca em `week_targets`. Nos exercícios sem ajuste, a prescrição nova vale na hora.
4. **A equipe Voluma cria o admin** (service_role), e **o admin convida instrutores** pelo e-mail Google. O painel também edita as fichas sugeridas.

### Princípio que organiza o resto

> **A academia escreve só a prescrição, e só por RPC.** Nenhuma tabela ganha policy ou grant de escrita para a equipe. As RPCs mudam um conjunto fechado de colunas. Histórico, cargas, semana e peso corporal não estão nesse conjunto, e um gatilho recusa a escrita se alguma RPC tentar.

---

## 1. Dados e acesso (RBAC + RLS)

### 1.1 Tabelas novas

```sql
-- --------------------------------------------- v16: equipe da academia
create table if not exists public.gym_staff (
  gym_id     text not null references public.gyms (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('admin', 'instructor')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (gym_id, user_id),
  -- O mundo padrao e o Voluma de todo mundo: equipe ali leria a base inteira.
  constraint gym_staff_not_padrao check (gym_id <> 'padrao')
);
create index if not exists idx_gym_staff_user on public.gym_staff (user_id);

-- Convite por e-mail: o instrutor pode nunca ter entrado. Vira linha em
-- gym_staff no primeiro login dele no painel (`staff_claim_invites`).
create table if not exists public.gym_staff_invites (
  gym_id      text not null references public.gyms (id) on delete cascade,
  email       text not null check (email = lower(btrim(email))),
  role        text not null default 'instructor' check (role in ('admin', 'instructor')),
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (gym_id, email),
  constraint gym_staff_invites_not_padrao check (gym_id <> 'padrao')
);

-- Registro de toda escrita do painel: quem, o que, em quantos alunos. Serve
-- para auditoria, para o "editado por" e, depois, para desfazer um lote.
create table if not exists public.prescription_log (
  id         uuid primary key default gen_random_uuid(),
  gym_id     text not null references public.gyms (id) on delete cascade,
  actor_id   uuid not null references auth.users (id),
  action     text not null,          -- 'set_day' | 'clear_day' | 'swap_exercise' | 'adjust_volume' | 'preset'
  params     jsonb not null,
  affected_students int not null default 0,
  affected_rows     int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_prescription_log_gym on public.prescription_log (gym_id, created_at desc);

-- Marca de prescricao no plano do aluno (par do preset_id da v15).
alter table public.routines add column if not exists prescribed_by uuid references auth.users (id) on delete set null;
alter table public.routines add column if not exists prescribed_at timestamptz;
```

O que significa a dupla `prescribed_by` / `prescribed_at`:

| `prescribed_by` | `prescribed_at` | Estado | Lote toca? |
|---|---|---|---|
| preenchido | preenchido | prescrito pelo instrutor | sim |
| nulo | preenchido | **o aluno editou depois** e desvinculou | não |
| nulo | nulo | plano do próprio aluno | não (só a edição individual) |

O app zera só o `prescribed_by`. O `prescribed_at` fica, e é o que permite ao painel mostrar "editado pelo aluno".

### 1.2 Funções de papel

São `security definer` e `stable`. Ficam fora da exposição (`revoke` de `anon`), mas `authenticated` pode chamar, porque as policies usam.

```sql
create or replace function public.my_staff_gyms()
returns setof text language sql stable security definer set search_path = '' as $$
  select gym_id from public.gym_staff where user_id = (select auth.uid());
$$;

create or replace function public.staff_role(gym text)
returns text language sql stable security definer set search_path = '' as $$
  select role from public.gym_staff where gym_id = gym and user_id = (select auth.uid());
$$;

-- Abre toda RPC do painel: erro 42501 se quem chama nao e da equipe.
create or replace function public.require_staff(gym text, need text default 'instructor')
returns text language plpgsql stable security definer set search_path = '' as $$
declare r text := public.staff_role(gym);
begin
  if r is null or (need = 'admin' and r <> 'admin') then
    raise exception 'sem permissao na academia %', gym using errcode = '42501';
  end if;
  return r;
end $$;
```

### 1.3 RLS

- **`gym_staff`:** cada pessoa lê a própria linha, e o admin lê a equipe da academia dele. Sem grant de escrita: tudo passa por RPC.
- **`gym_staff_invites` e `prescription_log`:** leitura só para admin da academia. Sem grant de escrita.
- **Leitura do plano dos alunos**, para o painel montar a tela com PostgREST simples: uma policy `staff_select` só de **select**, somada à `own_rows`, que continua igual, em `routines`, `routine_exercises` e `exercises` (`profiles` ficou de fora, ver acima):

```sql
create policy staff_select on public.routines
  for select to authenticated
  using (gym_id in (select public.my_staff_gyms()));
-- idem routine_exercises e exercises (num bloco `do $$ foreach` como o da v1)
```

- **`sessions`, `session_sets`, `body_weight_logs` e `week_targets` não ganham policy nova.** A frequência sai agregada por RPC, como no ranking de amigos, e nunca em linha crua. As cargas não aparecem no painel na v1. Se o instrutor precisar delas, entra depois como RPC agregada ("última carga por exercício").
- A `my_staff_gyms()` dentro de `(select …)` é avaliada uma vez por consulta (InitPlan), como o `(select auth.uid())` da v4.
- O app não sente a policy nova: o pull filtra `user_id = eu`.

### 1.4 RPCs de equipe

Todas são `security definer` e `set search_path = ''`, com `revoke` de `public, anon` e `grant` para `authenticated`.

- `staff_invite(gym, email, role)`: o admin convida. Por ora, só a equipe Voluma cria `role = 'admin'`, então a RPC recusa `admin` vindo de admin.
- `staff_claim_invites()`: chamada pelo painel no login. Lê `auth.jwt() ->> 'email'` e confere `email_verified`; o Google sempre vem verificado. Move os convites para `gym_staff`.
- `staff_remove(gym, user_id)`: o admin remove um instrutor. Não remove outro admin.
- `staff_list(gym)`: a equipe com nome e e-mail, lidos de `auth.users` pelo `security definer`. **Só para o admin.**

---

## 2. Edição do treino de um aluno

### 2.1 Quem é aluno

```sql
-- Interna (sem grant): o usuario tem qualquer coisa naquele mundo.
create or replace function public.is_gym_student(gym text, student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = student and gym_id = gym)
      or exists (select 1 from public.routines where user_id = student and gym_id = gym);
$$;
```

### 2.2 Achar ou criar o exercício do aluno

O laço de dentro da `propagate_preset_exercise_changes` vira uma função, e o gatilho da v15 passa a chamá-la. O comportamento não muda, e o `16.6-presets.sql` tem que continuar passando.

```sql
create or replace function public.ensure_student_exercise(
  student uuid, gym text, ex_name text, ex_group text, ex_kind text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare ex uuid;
begin
  select e.id into ex from public.exercises e
   where e.user_id = student and e.gym_id = gym and e.deleted_at is null
     and public.exercise_name_key(e.name) = public.exercise_name_key(ex_name)
   order by e.updated_at, e.id limit 1;
  if ex is null then
    ex := gen_random_uuid();
    insert into public.exercises (id, user_id, gym_id, name, muscle_group, kind, updated_at)
    values (ex, student, gym, btrim(ex_name), ex_group, ex_kind, clock_timestamp());
  end if;
  return ex;
end $$;

-- Busca por nome em todos os alunos da academia (lote): indice de expressao.
create index if not exists idx_exercises_gym_namekey
  on public.exercises (gym_id, public.exercise_name_key(name)) where deleted_at is null;
```

### 2.3 `staff_set_day`: o dia inteiro, declarativo

Uma chamada substitui a composição do dia, e o painel manda o estado final: exercícios, ordem, séries e repetições. Isso é mais simples de usar do que dez mutações pequenas, e acontece numa transação só.

```sql
create or replace function public.staff_set_day(
  gym text,
  student uuid,
  day smallint,                 -- 0..6, mesmo `weekday` do app
  day_name text,
  items jsonb,                  -- [{ "routine_exercise_id"?: uuid, "name", "muscle_group", "kind",
                                --    "sets", "reps", "distance_km", "duration_min" }] na ordem
  expected_updated_at timestamptz default null   -- concorrencia otimista
) returns uuid                  -- id da rotina
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  ts timestamptz := clock_timestamp();
  ro public.routines%rowtype;
begin
  perform public.require_staff(gym);
  if not public.is_gym_student(gym, student) then
    raise exception 'aluno fora da academia' using errcode = '42501';
  end if;
  -- o guarda da secao 2.4 vem da declaracao: `set voluma.staff_write = '1'`

  -- Trava a rotina do dia: um push do aluno no mesmo instante espera.
  select * into ro from public.routines
   where user_id = student and gym_id = gym and weekday = day and deleted_at is null
   order by position, id limit 1
   for update;

  if found and expected_updated_at is not null and ro.updated_at > expected_updated_at then
    raise exception 'o dia mudou desde que foi aberto' using errcode = 'P0409';
  end if;

  if not found then
    ro.id := gen_random_uuid();
    insert into public.routines (id, user_id, gym_id, name, weekday, position, updated_at)
    values (ro.id, student, gym, day_name, day, 0, ts);
  end if;

  update public.routines
     set name = day_name, preset_id = null,            -- diverge da ficha: vira prescricao individual
         prescribed_by = me, prescribed_at = ts, updated_at = ts
   where id = ro.id;

  -- 1. Some quem nao esta mais na lista (soft delete).
  -- 2. Atualiza position/target_sets/target_reps/distancia/tempo de quem ficou (por id).
  -- 3. Insere os novos: exercise_id := ensure_student_exercise(...), target_weight_kg = 0.
  --    Mantem a regra "um exercicio por dia" (ignora o repetido).
  -- Tudo com updated_at = ts.

  insert into public.prescription_log (gym_id, actor_id, action, params, affected_students, affected_rows)
  values (gym, me, 'set_day', jsonb_build_object('student', student, 'day', day, 'items', items), 1, jsonb_array_length(items));

  return ro.id;
end $$;
```

E mais:
- `staff_clear_day(gym, student, day)`: soft delete da rotina e dos exercícios dela.
- `staff_release_day(gym, student, day)`: devolve a autonomia. Zera o `prescribed_by` e não muda o plano.
- **Rotina ligada a uma ficha:** a edição individual tira o `preset_id` e prescreve. A ficha continua valendo para os outros alunos.

### 2.4 Separação entre prescrição e histórico

O que garante a separação, em camadas:

1. **Grants:** a equipe não tem escrita em tabela nenhuma (§1.3).
2. **Colunas fechadas nas RPCs:**
   - `routines`: `name`, `weekday`, `position`, `preset_id`, `prescribed_*`, `deleted_at`;
   - `routine_exercises`: `exercise_id` (só no insert), `position`, `target_sets`, `target_reps`, `target_distance_km`, `target_duration_min`, `deleted_at`;
   - `exercises`: só insert.
   - **`target_weight_kg` nunca muda.** Quando o aluno já treinou, a carga vem do histórico dele (`resolveTargets` vinculado); quando é exercício novo, começa em 0.
3. **Guarda no banco:** toda RPC do painel que escreve declara `set voluma.staff_write = '1'`, que só vale enquanto ela roda. Um gatilho `BEFORE INSERT OR UPDATE OR DELETE` em `sessions`, `session_sets`, `week_targets` e `body_weight_logs` recusa a escrita com esse GUC ligado:

```sql
create or replace function public.forbid_staff_history_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_setting('voluma.staff_write', true) = '1' then
    raise exception 'o painel nao escreve historico (%)', tg_table_name using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
```

4. **Teste SQL** (§5): roda cada RPC e compara o `md5` agregado das quatro tabelas antes e depois.

---

## 3. Lotes e filtros

O fluxo do painel tem sempre três passos: **filtrar → prévia (`dry_run`) → aplicar**. O aplicar recebe a **lista explícita de ids** que a prévia devolveu (no máximo 2000). Assim, o que se aplica é o que o instrutor viu na prévia, e não o resultado de um filtro reexecutado um minuto depois.

### 3.1 `staff_find_students`

```sql
create or replace function public.staff_find_students(
  gym text,
  preset uuid default null,            -- ficha atual (routines.preset_id)
  has_exercise text default null,      -- nome; compara por exercise_name_key
  prescribed_only boolean default false,
  weeks int default 4,                 -- janela da frequencia
  min_days int default null, max_days int default null,  -- dias treinados na janela
  inactive_since date default null     -- sem dia treinado desde
) returns table (
  user_id uuid, display_name text, handle text,
  preset_ids uuid[], prescribed_days int, self_edited_days int, planned_days int,
  trained_days int, last_trained_on date
) language sql stable security definer set search_path = '' as $$
  with alunos as (... perfis + donos de rotina no mundo ...),
  dias as (
    -- MESMA regra do dia treinado (memoria decisao-dia-treinado / friend_weekly_days)
    select distinct s.user_id, s.date
      from public.sessions s
      join public.session_sets st on st.session_id = s.id and st.user_id = s.user_id
     where s.gym_id = gym and st.gym_id = gym
       and s.deleted_at is null and st.deleted_at is null
       and st.done and st.reps * st.weight_kg > 0
       and s.date >= current_date - weeks * 7
  ),
  ...
$$;
-- O corpo abre com `public.require_staff(gym)`; por isso e plpgsql com `return query`.
```

Índices novos: `sessions (gym_id, date) where deleted_at is null`, `routine_exercises (routine_id) where deleted_at is null` e `routines (gym_id, user_id) where deleted_at is null`.

### 3.2 `staff_swap_exercise`: trocar um exercício por outro

```sql
staff_swap_exercise(
  gym text,
  from_name text,                                  -- "Puxada alta"
  to_name text, to_group text, to_kind text,       -- "Puxada na maquina"
  students uuid[],                                 -- da previa
  include_presets boolean default false,
  dry_run boolean default true
) returns table (students_affected int, rows_affected int,
                 skipped_self_managed int, skipped_preset_linked int, skipped_duplicate int)
```

- **Alcance:** só rotinas com `prescribed_by is not null`. As desvinculadas e as do próprio aluno entram em `skipped_self_managed`. As ligadas a uma ficha entram em `skipped_preset_linked`, porque elas mudam pela ficha.
- **`include_presets = true`:** troca também na ficha. Faz soft delete do `gym_preset_exercises` velho e insere o novo, e o gatilho da v15 propaga para as rotinas vinculadas. O gatilho não trata troca de nome, por isso é soft delete + insert.
- **A troca não reaproveita a linha:** faz soft delete do `routine_exercises` velho e insere um novo na mesma posição, com as mesmas séries e reps e carga 0. Assim, o `week_targets` da semana (com a carga do exercício antigo) fica inerte sozinho, e o histórico do exercício antigo continua intacto. Se o aluno já fez o exercício novo antes, o `resolveTargets` puxa a carga dele.
- **Se o dia já tem o exercício de destino**, aplica só o soft delete do velho e conta em `skipped_duplicate` (regra "um exercício por dia").
- **Execução por conjuntos, sem laço por linha:**
  1. `insert … select` dos exercícios que faltam no catálogo de cada aluno;
  2. `update … from` para o soft delete;
  3. `insert … select` das linhas novas.

  Antes, trava com `select … for update` das rotinas atingidas, `order by id` para não dar deadlock com outro lote, e define `set local statement_timeout = '15s'`.
- **No `dry_run`**, roda tudo e termina com `raise` controlado, que desfaz a transação, ou então só calcula as contagens com os mesmos CTEs. Fica a segunda opção: é mais simples e não gasta escrita.

### 3.3 `staff_adjust_volume`: séries e reps em lote

```sql
staff_adjust_volume(
  gym text, students uuid[],
  match_name text default null, match_group text default null, match_day smallint default null,
  sets_delta int default 0, reps_delta int default 0,   -- ou:
  sets_set int default null, reps_set int default null,
  dry_run boolean default true
) returns table (students_affected int, rows_affected int, skipped_self_managed int)
```

- Muda a mesma linha (`update`), com `greatest(1, least(…, 10))` para séries e `greatest(1, least(…, 50))` para reps.
- Mesmo alcance: só as rotinas prescritas.
- O ajuste da semana do aluno continua valendo até domingo (decisão 3).
- Ignora exercício de corrida (`kind = 'run'`).

### 3.4 Fichas pelo painel

`staff_upsert_preset(gym, preset jsonb)` e `staff_delete_preset(gym, preset_id)`: escrita declarativa em `gym_presets` / `gym_preset_exercises`, por id. A propagação continua com o gatilho da v15. Admin e instrutor podem usar.

### 3.5 Transação e desempenho

- Cada RPC é uma transação; uma falha desfaz tudo, inclusive o `prescription_log`.
- Um lote grande vira três comandos por conjunto, e não N chamadas. O porte de referência é 2.000 alunos × 7 dias × 6 exercícios = 84 mil `routine_exercises`.
- `clock_timestamp()` como `updated_at`: a escrita do painel fica mais nova do que qualquer edição do aluno feita antes dela (§4).
- Depois da migração: `get_advisors` de segurança e performance pelo MCP, e `explain analyze` da `staff_find_students` com dados semeados.

---

## 4. Sincronização: painel → Supabase → SQLite

### 4.1 O caminho, sem mudar o engine

A RPC grava com `updated_at = clock_timestamp()`. O gatilho `sync_stamp` carimba o `synced_at`. O pull do aluno (`src/sync/engine.ts:253`, por `user_id + gym_id + synced_at`) recebe a linha no próximo ciclo, e o `applyRemoteRows` aplica, porque ela é mais nova. Depois do sync, a `useDataVersion` faz as telas recarregarem. Não há cache para invalidar além disso: no app, a semana nunca é materializada (`targetsForWeek`).

### 4.2 Quando o aluno puxa

- **Já existe:** o app puxa ao voltar para primeiro plano (`useSyncLifecycle`) e ao sair do treino. Isso cobre o caso principal: o aluno abre o app na academia.
- **Etapa opcional (18.6), Realtime:** a RPC chama `realtime.send(payload, 'prescription', 'user:' || student, true)`, num canal privado, com uma policy em `realtime.messages` que só libera `topic = 'user:' || auth.uid()`. O app, em primeiro plano, assina o canal e chama `runSync()`. Só faz sentido se a espera até a próxima abertura do app incomodar no teste.

### 4.3 Conflitos: aluno offline × instrutor

A regra é: **edição do aluno anterior à prescrição perde; edição posterior desvincula.**

| Cenário | O que acontece | Mecanismo |
|---|---|---|
| Aluno edita uma linha offline (T1) e o instrutor prescreve depois (T2 > T1). O aluno sobe | Recusada, e o aparelho adota a versão do servidor | já existe: `sync_stamp` + `adoptServerRows` |
| Aluno **adiciona** um exercício offline (linha nova, T1) num dia que o instrutor prescreveu em T2 > T1 | Sem tratamento, a linha nova entraria e misturaria os dois planos. **Novo gatilho:** grava a linha como apagada, com `updated_at = clock_timestamp()`. O pull do mesmo ciclo apaga a linha no aparelho | `reject_stale_student_insert` (abaixo) |
| Aluno desvincula offline (T1) e o instrutor prescreve depois (T2) | A rotina do aluno é recusada (mais velha). Continua prescrita | `sync_stamp` |
| Aluno edita **depois** da prescrição (T3 > T2) | Aceita. `prescribed_by = null` e o painel mostra "editado pelo aluno"; os lotes pulam o dia | LWW + §1.1 |
| Instrutor muda o dia com um treino aberto | Séries feitas ficam no histórico (a RPC não toca em `session_sets`). O treino mostra a composição nova depois do pull | guarda da §2.4 |
| Painel editando um dia que o aluno mudou desde que foi aberto | Erro `P0409`, e o painel recarrega | `expected_updated_at` |
| Relógio do aparelho adiantado | Uma edição velha pode parecer nova e desvincular. É a limitação de sempre do LWW, aceita | — |

```sql
-- Linha NOVA do aluno num dia prescrito depois dela: entra ja apagada.
create or replace function public.reject_stale_student_insert()
returns trigger language plpgsql set search_path = '' as $$
declare stamp timestamptz;
begin
  if current_setting('voluma.staff_write', true) = '1' then return new; end if;
  select prescribed_at into stamp from public.routines
   where id = new.routine_id and prescribed_by is not null;
  if stamp is not null and new.updated_at < stamp and new.deleted_at is null then
    new.deleted_at := clock_timestamp();
    new.updated_at := clock_timestamp();
  end if;
  return new;
end $$;
-- BEFORE INSERT em routine_exercises. Roda antes do sync_stamp, em ordem alfabetica: "reject" < "sync".
```

### 4.4 Mudanças no app (pequenas, por OTA)

- **Migração do SQLite:** `routines.prescribed_by TEXT` e `routines.prescribed_at TEXT`, em `src/db/schema.ts`, depois da v6.
- **`src/db/repo.ts`:**
  - `isLinked = Boolean(preset_id || prescribed_by)` em `targetsForWeek` e onde mais o `preset_id` decide o vínculo;
  - `unlinkRoutineIfLinked` passa a zerar também o `prescribed_by` e mantém o `prescribed_at`.
- **Telas:**
  - origem "do instrutor" onde hoje aparece "da academia";
  - o aviso antes de desvincular passa a valer para dia prescrito, reaproveitando o da 16.7;
  - **aviso de privacidade** no Perfil e no login, atrás da flag `staff_panel`: "A equipe da academia vê seu plano e sua frequência". Ele é consequência da decisão 1 e precisa estar nos termos.
- **App antigo:** nenhum app de academia está na loja ainda (a 16.8 é a primeira), então todo aparelho de mundo de academia já vai ter esse código. Se precisar ligar por academia, use a flag `staff_panel` em `gym_flags`.

---

## 5. Etapas, skills e verificação

| Etapa | O que | Skills a carregar antes |
|---|---|---|
| 18.0 | Gravar este documento como `plans/18-painel-admin.md`, linha na tabela de `plans/README.md`, decisões em `DECISIONS.md` | `meu-projeto-conventions` |
| 18.1 | v16, parte 1: `gym_staff`, convites, log, funções de papel, RLS de leitura, RPCs de equipe | `supabase`, `supabase-postgres-best-practices`, `auth-implementation-patterns`, `database-design` |
| 18.2 | `ensure_student_exercise` (refatorando o gatilho da v15), `staff_set_day` / `clear_day` / `release_day`, guarda do histórico | `supabase`, `supabase-postgres-best-practices` |
| 18.3 | `staff_find_students`, `staff_swap_exercise`, `staff_adjust_volume`, RPCs de ficha, índices | `supabase-postgres-best-practices`, `sql-optimization-patterns`, `postgresql-optimization` |
| 18.4 | Gatilho de conflito `reject_stale_student_insert` | `supabase` |
| 18.5 | App: migração do SQLite, `isLinked`, desvínculo, "do instrutor", aviso de privacidade | `meu-projeto-conventions`, `react-native-architecture`, `testing-patterns`, `jest-skill` |
| 18.6 | (opcional) Realtime por usuário | `supabase`, `expo:expo-data-fetching` |
| 18.7 | Revisão de segurança da v16 antes de produção | `security-audit` |

Cada parte SQL entra no `supabase/schema.sql` como `-- v16: …`, idempotente, no estilo do arquivo (`create or replace`, `if not exists`, sem `drop` destrutivo). **O banco é de produção:** aplicar pelo MCP só com a sua confirmação e depois de o teste SQL passar.

### Verificação

- **`supabase/tests/18-painel.sql`** (`begin … rollback`, no padrão do `16.6-presets.sql`), com os personagens: admin e instrutor da `zztx`, instrutor de outra academia, aluno da `zztx`, aluno da `padrao` e um anônimo. Casos:
  1. Instrutor de outra academia e anônimo recebem `42501` em todas as RPCs.
  2. Ninguém cria equipe no mundo `padrao`.
  3. O instrutor lê o plano do aluno da `zztx` e não lê o do aluno da `padrao`; ninguém da equipe lê `session_sets`.
  4. O `md5` de `sessions` / `session_sets` / `week_targets` / `body_weight_logs` não muda depois de cada RPC.
  5. `staff_set_day` cria, atualiza, remove e mantém os ids; `target_weight_kg` fica como estava.
  6. A troca pula os dias desvinculados e os ligados à ficha, respeita "um exercício por dia", e o `dry_run` não escreve.
  7. Gatilho de conflito: insert do aluno com `updated_at` anterior ao `prescribed_at` entra apagado; posterior entra vivo.
  8. O `expected_updated_at` velho dá `P0409`.
  9. O `16.6-presets.sql`, o `16-multi-academia.sql` e o `17-relogio-do-servidor.sql` continuam passando.
- **`npm test` e `npm run typecheck`:**
  - `resolveTargets` / `targetsForWeek` com rotina prescrita (séries e reps do instrutor, carga do histórico);
  - `unlinkRoutineIfLinked` zerando o `prescribed_by` e mantendo o `prescribed_at`;
  - `keepColumns` com as colunas novas.
- **No aparelho (app `teste`):**
  1. Promover uma conta a admin da `teste` pelo SQL.
  2. Chamar `staff_set_day` pelo SQL Editor com o JWT dela.
  3. Abrir o app: o dia aparece prescrito, com a carga do aluno.
  4. Editar o dia no app: aparece o aviso e ele desvincula.
  5. Pelo SQL, `prescribed_by` é nulo e `prescribed_at` continua preenchido.
  6. Repetir offline para ver a linha antiga sumir no sync.
- Rodar os advisors de segurança depois da migração.

> Implementar qualquer etapa depende de pedido explícito. A aprovação deste plano cobre só a 18.0 (registrar o documento e as decisões).

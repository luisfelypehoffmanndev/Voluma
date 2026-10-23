-- Teste dos planos da academia (v18): montar, atribuir com previa, excecoes
-- por aluno, mudancas no plano, saida do plano e RLS.
--
-- Cole no SQL Editor DEPOIS do schema.sql e rode. Tudo dentro de `begin …
-- rollback`: nada fica no banco. Chegar ao `select 'ok'` e passar.
--
-- Personagens: c002 instrutor da zztx, c003 instrutor da zzty,
-- c011 Ana (semana vazia), c012 Bia (treino proprio na terca e na quarta),
-- c013 Caio (ja num outro plano na segunda).

begin;

insert into public.gyms (id, name) values ('zztx', 'Academia X'), ('zzty', 'Academia Y')
on conflict (id) do nothing;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000c002', 'instrutor@cx.voluma'),
  ('00000000-0000-4000-8000-00000000c003', 'instrutor@cy.voluma'),
  ('00000000-0000-4000-8000-00000000c011', 'ana@cx.voluma'),
  ('00000000-0000-4000-8000-00000000c012', 'bia@cx.voluma'),
  ('00000000-0000-4000-8000-00000000c013', 'caio@cx.voluma')
on conflict (id) do nothing;

insert into public.gym_staff (gym_id, user_id, role) values
  ('zztx', '00000000-0000-4000-8000-00000000c002', 'instructor'),
  ('zzty', '00000000-0000-4000-8000-00000000c003', 'instructor');

insert into public.profiles (id, gym_id, handle, display_name) values
  ('00000000-0000-4000-8000-00000000c011', 'zztx', 'anacx', 'Ana'),
  ('00000000-0000-4000-8000-00000000c012', 'zztx', 'biacx', 'Bia'),
  ('00000000-0000-4000-8000-00000000c013', 'zztx', 'caiocx', 'Caio');

-- A Bia tem treino proprio na terca (2) e na quarta (3), e historico.
do $$
declare
  bia constant uuid := '00000000-0000-4000-8000-00000000c012';
  ts  constant timestamptz := now() - interval '1 day';
  ex  uuid := gen_random_uuid();
  s1  uuid := gen_random_uuid();
begin
  insert into public.exercises (id, user_id, gym_id, name, updated_at) values (ex, bia, 'zztx', 'Corrida leve', ts);
  insert into public.routines (id, user_id, gym_id, name, weekday, updated_at) values
    ('00000000-0000-4000-8000-0000000c0b02', bia, 'zztx', 'Meu treino', 2, ts),
    ('00000000-0000-4000-8000-0000000c0b03', bia, 'zztx', 'Meu treino', 3, ts);
  insert into public.routine_exercises (id, user_id, gym_id, routine_id, exercise_id, position, updated_at) values
    (gen_random_uuid(), bia, 'zztx', '00000000-0000-4000-8000-0000000c0b02', ex, 0, ts),
    (gen_random_uuid(), bia, 'zztx', '00000000-0000-4000-8000-0000000c0b03', ex, 0, ts);
  insert into public.sessions (id, user_id, gym_id, date, started_at, updated_at)
  values (s1, bia, 'zztx', current_date - 3, now() - interval '3 days', ts);
  insert into public.session_sets (id, user_id, gym_id, session_id, exercise_id, set_index, reps, weight_kg, done, updated_at)
  values (gen_random_uuid(), bia, 'zztx', s1, ex, 1, 10, 20, true, ts);
end $$;

create temporary table t_ids (k text primary key, v uuid);
grant all on t_ids to authenticated;

create temporary table t_history as
select md5(coalesce((select string_agg(to_jsonb(x)::text, '' order by x.id) from public.sessions x), '')
        || coalesce((select string_agg(to_jsonb(x)::text, '' order by x.id) from public.session_sets x), '')
        || coalesce((select string_agg(to_jsonb(x)::text, '' order by x.id) from public.week_targets x), '')) as h;

-- 1. O instrutor monta os treinos e dois planos
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000c002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  ta uuid; tb uuid; tc uuid; p uuid; p2 uuid;
  rec record;
begin
  ta := public.staff_upsert_preset('zztx', '{"name": "Treino A", "exercises": [
    {"movement_slug": "bench-press", "name": "Supino reto", "sets": 4, "reps": 8},
    {"movement_slug": "barbell-row", "name": "Remada curvada", "sets": 4, "reps": 10}]}');
  tb := public.staff_upsert_preset('zztx', '{"name": "Treino B", "exercises": [
    {"movement_slug": "squat", "name": "Agachamento livre", "sets": 4, "reps": 8}]}');
  tc := public.staff_upsert_preset('zztx', '{"name": "Treino C", "exercises": [
    {"movement_slug": "barbell-curl", "name": "Rosca direta", "sets": 3, "reps": 12}]}');

  select * into rec from public.staff_upsert_plan('zztx', jsonb_build_object(
    'name', 'Hipertrofia', 'open_to_students', true, 'days', jsonb_build_array(
      jsonb_build_object('weekday', 1, 'preset_id', ta),
      jsonb_build_object('weekday', 3, 'preset_id', tb),
      jsonb_build_object('weekday', 5, 'preset_id', tc))));
  p := rec.plan_id;
  select * into rec from public.staff_upsert_plan('zztx', jsonb_build_object(
    'name', 'Fechado', 'days', jsonb_build_array(jsonb_build_object('weekday', 1, 'preset_id', tc))));
  p2 := rec.plan_id;

  begin
    perform public.staff_upsert_plan('zztx', jsonb_build_object('name', 'X', 'days', jsonb_build_array(
      jsonb_build_object('weekday', 1, 'preset_id', ta), jsonb_build_object('weekday', 1, 'preset_id', tb))));
    raise exception 'aceitou dia repetido';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.staff_upsert_plan('zztx', jsonb_build_object('name', 'X', 'days', jsonb_build_array(
      jsonb_build_object('weekday', 1, 'preset_id', gen_random_uuid()))));
    raise exception 'aceitou treino de fora';
  exception when sqlstate '22023' then null;
  end;

  -- O Caio entra no plano fechado (segunda = Treino C)
  perform * from public.staff_assign_plan('zztx', p2, array['00000000-0000-4000-8000-00000000c013'::uuid], dry_run => false);

  insert into t_ids values ('ta', ta), ('tb', tb), ('tc', tc), ('p', p), ('p2', p2);
end $$;

-- 2. Previa e atribuicao com substituicao parcial
do $$
declare
  ana  constant uuid := '00000000-0000-4000-8000-00000000c011';
  bia  constant uuid := '00000000-0000-4000-8000-00000000c012';
  caio constant uuid := '00000000-0000-4000-8000-00000000c013';
  p    uuid := (select v from t_ids where k = 'p');
  p2   uuid := (select v from t_ids where k = 'p2');
  n    int;
  rec  record;
begin
  -- A previa nao escreve e classifica cada dia
  select string_agg(format('%s:%s:%s', left(x.user_id::text, 0) || case x.user_id when ana then 'ana' when bia then 'bia' else 'caio' end,
                           x.weekday, x.current), ' ' order by x.user_id, x.weekday) into rec
    from public.staff_assign_plan('zztx', p, array[ana, bia, caio]) x;
  assert rec.string_agg = 'ana:1:empty ana:3:empty ana:5:empty bia:1:empty bia:3:own bia:5:empty caio:1:other_plan caio:3:empty caio:5:empty',
    format('previa errada: %s', rec.string_agg);
  select count(*) into n from public.routines where gym_id = 'zztx' and plan_id = p;
  assert n = 0, 'a previa escreveu';

  -- Aplicar: so a quarta da Bia e substituida; a segunda do Caio fica no outro plano
  select count(*) filter (where x.action = 'apply'), count(*) filter (where x.action = 'skip') into rec
    from public.staff_assign_plan('zztx', p, array[ana, bia, caio],
           jsonb_build_array(jsonb_build_object('user_id', bia, 'weekday', 3)), dry_run => false) x;
  assert rec.count = 8, format('devia aplicar 8 dias; aplicou %s', rec.count);

  select plan_id into rec from public.routines where user_id = caio and weekday = 1 and deleted_at is null;
  assert rec.plan_id = p2, 'a segunda do Caio devia continuar no outro plano';
  select r.name, r.plan_id, r.preset_id is not null as ficha into rec
    from public.routines r where r.id = '00000000-0000-4000-8000-0000000c0b03';
  assert rec.name = 'Treino B' and rec.plan_id = p and rec.ficha, format('quarta da Bia nao entrou no plano: %s', to_jsonb(rec));
  select count(*) into n from public.routine_exercises re join public.exercises e on e.id = re.exercise_id
   where re.routine_id = '00000000-0000-4000-8000-0000000c0b03' and re.deleted_at is null and e.name = 'Corrida leve';
  assert n = 0, 'o exercicio proprio da quarta devia ter saido';

  -- De novo: nada muda
  select count(*) into n from public.staff_assign_plan('zztx', p, array[ana, bia], dry_run => false) x
   where x.action <> 'unchanged';
  assert n = 0, format('reaplicar mudou %s dia(s)', n);

  select count(*) into n from public.staff_plan_members('zztx', p);
  assert n = 3, format('o plano devia ter 3 alunos; tem %s', n);
  select following_days into n from public.staff_plan_members('zztx', p) where user_id = caio;
  assert n = 2, format('o Caio segue 2 dos 3 dias; veio %s', n);
  select count(*) into n from public.staff_find_students('zztx', plan => p);
  assert n = 3, 'filtro por plano';
  select count(*) into n from public.staff_find_students('zztx', no_plan => true);
  assert n = 0, 'todos estao em algum plano';
end $$;

-- 3. Excecoes da Ana sobrevivem as mudancas do treino
do $$
declare
  ana uuid := '00000000-0000-4000-8000-00000000c011';
  bia uuid := '00000000-0000-4000-8000-00000000c012';
  ta  uuid := (select v from t_ids where k = 'ta');
  p   uuid := (select v from t_ids where k = 'p');
  seg uuid := (select id from public.routines where user_id = '00000000-0000-4000-8000-00000000c011' and weekday = 1 and deleted_at is null);
  sup uuid;
  rec record;
  n   int;
begin
  sup := (select re.id from public.routine_exercises re join public.exercises e on e.id = re.exercise_id
           where re.routine_id = seg and re.deleted_at is null and e.name = 'Supino reto');

  -- Supino 5 series so para ela, sem a Remada, com Crucifixo a mais
  perform public.staff_customize_day('zztx', ana, 1::smallint, jsonb_build_array(
    jsonb_build_object('routine_exercise_id', sup, 'name', 'Supino reto', 'sets', 5),
    jsonb_build_object('name', 'Crucifixo', 'sets', 3, 'reps', 15)));
  select plan_id, preset_id into rec from public.routines where id = seg;
  assert rec.plan_id = p and rec.preset_id = ta, 'personalizar tirou o dia do plano';
  select customized_days into n from public.staff_plan_members('zztx', p) where user_id = ana;
  assert n = 1, format('a Ana tem 1 dia com excecao; veio %s', n);

  -- O instrutor muda o Treino A: Supino 3x12, Remada 3x8, e entra Desenvolvimento
  perform public.staff_upsert_preset('zztx', jsonb_build_object('id', ta, 'name', 'Treino A', 'exercises', jsonb_build_array(
    jsonb_build_object('id', (select id from public.gym_preset_exercises where preset_id = ta and name = 'Supino reto'),
                       'movement_slug', 'bench-press', 'name', 'Supino reto', 'sets', 3, 'reps', 12),
    jsonb_build_object('id', (select id from public.gym_preset_exercises where preset_id = ta and name = 'Remada curvada'),
                       'movement_slug', 'barbell-row', 'name', 'Remada curvada', 'sets', 3, 'reps', 8),
    jsonb_build_object('movement_slug', 'overhead-press', 'name', 'Desenvolvimento', 'sets', 3, 'reps', 10))));

  select target_sets, target_reps into rec from public.routine_exercises where id = sup;
  assert rec.target_sets = 5 and rec.target_reps = 8, format('a excecao da Ana foi sobrescrita: %s', to_jsonb(rec));
  select re.target_sets, re.target_reps into rec
    from public.routine_exercises re join public.exercises e on e.id = re.exercise_id
    join public.routines r on r.id = re.routine_id
   where r.user_id = bia and r.weekday = 1 and r.deleted_at is null and re.deleted_at is null and e.name = 'Supino reto';
  assert rec.target_sets = 3 and rec.target_reps = 12, 'a Bia (sem excecao) devia receber o 3x12';
  select count(*) into n from public.routine_exercises re join public.exercises e on e.id = re.exercise_id
   where re.routine_id = seg and re.deleted_at is null and e.name in ('Remada curvada', 'Crucifixo', 'Desenvolvimento');
  assert n = 2, format('Ana: sem Remada, com Crucifixo e Desenvolvimento; veio %s', n);

  -- Voltar aos numeros da ficha desfaz a excecao
  perform public.staff_customize_day('zztx', ana, 1::smallint, jsonb_build_array(
    jsonb_build_object('routine_exercise_id', sup, 'name', 'Supino reto', 'sets', 3, 'reps', 12)));
  select custom_targets into rec from public.routine_exercises where id = sup;
  assert not rec.custom_targets, 'voltar aos numeros da ficha devia tirar a excecao';

  -- Voltar ao plano: o dia fica igual ao treino
  perform public.staff_reset_day('zztx', ana, 1::smallint);
  select customized_days into n from public.staff_plan_members('zztx', p) where user_id = ana;
  assert n = 0, 'voltar ao plano devia limpar as excecoes';
  select count(*) into n from public.routine_exercises where routine_id = seg and deleted_at is null;
  assert n = 3, format('o dia da Ana devia ter os 3 exercicios do treino; tem %s', n);

  begin
    perform public.staff_customize_day('zztx', bia, 2::smallint, '[]');
    raise exception 'personalizou dia que nao segue treino';
  exception when sqlstate '22023' then null;
  end;
end $$;

-- 4. Mudancas no plano: troca de treino, dia novo, dia tirado
do $$
declare
  ana uuid := '00000000-0000-4000-8000-00000000c011';
  bia uuid := '00000000-0000-4000-8000-00000000c012';
  ta  uuid := (select v from t_ids where k = 'ta');
  tb  uuid := (select v from t_ids where k = 'tb');
  tc  uuid := (select v from t_ids where k = 'tc');
  p   uuid := (select v from t_ids where k = 'p');
  rec record;
begin
  -- Sexta passa de C para A; entra terca C; sai quarta
  select * into rec from public.staff_upsert_plan('zztx', jsonb_build_object(
    'id', p, 'name', 'Hipertrofia', 'days', jsonb_build_array(
      jsonb_build_object('weekday', 1, 'preset_id', ta),
      jsonb_build_object('weekday', 2, 'preset_id', tc),
      jsonb_build_object('weekday', 5, 'preset_id', ta))));
  -- sexta: Ana, Bia, Caio (3); terca: Ana e Caio vazios (2); Bia tem treino proprio na terca (1 pulado)
  assert rec.students_updated = 5 and rec.skipped = 1, format('mudanca no plano errada: %s', to_jsonb(rec));

  select name, preset_id into rec from public.routines where user_id = ana and weekday = 5 and deleted_at is null;
  assert rec.preset_id = ta, 'a sexta da Ana devia virar Treino A';
  select preset_id, plan_id into rec from public.routines where id = '00000000-0000-4000-8000-0000000c0b02';
  assert rec.preset_id is null and rec.plan_id is null, 'a terca propria da Bia nao devia ser tocada';
  select plan_id, preset_id, prescribed_by into rec from public.routines where user_id = ana and weekday = 3 and deleted_at is null;
  assert rec.plan_id is null and rec.preset_id is null and rec.prescribed_by is not null,
    format('a quarta tirada do plano devia ficar prescrita: %s', to_jsonb(rec));
end $$;
reset role;

-- 5. O aluno edita um dia no app: so aquele dia sai do plano
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000c011","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  n int;
begin
  -- Como o app antigo: zera so o preset_id (o plan_id fica)
  update public.routines set preset_id = null, updated_at = clock_timestamp()
   where user_id = '00000000-0000-4000-8000-00000000c011' and weekday = 5 and deleted_at is null;

  -- O aluno ve o plano aberto, e o fechado so quem segue
  select count(*) into n from public.gym_plans where gym_id = 'zztx';
  assert n = 1, format('a Ana devia ver so o plano aberto; viu %s', n);
  select count(*) into n from public.gym_plan_days d join public.gym_plans p on p.id = d.plan_id
   where p.name = 'Hipertrofia' and d.deleted_at is null;
  assert n = 3, format('a Ana devia ver os 3 dias do plano; viu %s', n);
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000c013","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  n int;
begin
  select count(*) into n from public.gym_plans where gym_id = 'zztx';
  assert n = 2, format('o Caio segue o plano fechado e devia ver os 2; viu %s', n);
end $$;
reset role;

set local role anon;
do $$
declare
  n int;
begin
  select count(*) into n from public.gym_plans where gym_id = 'zztx';
  assert n = 1, format('anonimo so ve plano aberto; viu %s', n);
  begin
    insert into public.gym_plans (gym_id, name) values ('zztx', 'Invasor');
    raise exception 'anon criou plano';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 6. Sair do plano, apagar plano, ficha em uso e outra academia
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000c002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  ana  uuid := '00000000-0000-4000-8000-00000000c011';
  bia  uuid := '00000000-0000-4000-8000-00000000c012';
  caio uuid := '00000000-0000-4000-8000-00000000c013';
  ta   uuid := (select v from t_ids where k = 'ta');
  tc   uuid := (select v from t_ids where k = 'tc');
  p    uuid := (select v from t_ids where k = 'p');
  p2   uuid := (select v from t_ids where k = 'p2');
  rec  record;
  n    int;
begin
  select following_days into n from public.staff_plan_members('zztx', p) where user_id = ana;
  assert n = 2, format('a Ana editou a sexta e segue 2 dias; veio %s', n);

  n := public.staff_remove_from_plan('zztx', p, array[bia]);
  assert n = 2, format('a Bia segue segunda e sexta; tirou %s', n);
  select count(*) into n from public.routines where user_id = bia and plan_id = p and preset_id is not null and deleted_at is null;
  assert n = 0, 'a Bia continuou no plano';
  select count(*) into n from public.routines r
   where r.user_id = bia and r.weekday = 1 and r.deleted_at is null and r.prescribed_by is not null
     and exists (select 1 from public.routine_exercises re where re.routine_id = r.id and re.deleted_at is null);
  assert n = 1, 'sair do plano devia deixar o treino como prescrito';

  begin
    perform public.staff_delete_preset('zztx', ta);
    raise exception 'apagou treino em uso no plano';
  exception when sqlstate '22023' then null;
  end;

  perform public.staff_delete_plan('zztx', p2);
  select plan_id, preset_id into rec from public.routines where user_id = caio and weekday = 1 and deleted_at is null;
  assert rec.plan_id is null and rec.preset_id = tc, 'apagar o plano devia manter o treino do Caio';
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000c003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  p uuid := (select v from t_ids where k = 'p');
begin
  begin
    perform * from public.staff_plan_members('zztx', p);
    raise exception 'instrutor de outra academia leu o plano';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.staff_assign_plan('zztx', p, array['00000000-0000-4000-8000-00000000c011'::uuid]);
    raise exception 'instrutor de outra academia atribuiu';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.staff_reset_day('zztx', '00000000-0000-4000-8000-00000000c011', 1::smallint);
    raise exception 'instrutor de outra academia resetou';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 7. O historico ficou como estava
do $$
begin
  assert (select h from t_history) = md5(
            coalesce((select string_agg(to_jsonb(x)::text, '' order by x.id) from public.sessions x), '')
         || coalesce((select string_agg(to_jsonb(x)::text, '' order by x.id) from public.session_sets x), '')
         || coalesce((select string_agg(to_jsonb(x)::text, '' order by x.id) from public.week_targets x), '')),
    'os planos mexeram no historico';
end $$;

select 'ok' as resultado;

rollback;

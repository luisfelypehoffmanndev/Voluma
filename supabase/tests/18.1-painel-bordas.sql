-- Bordas do painel (v16) que o 18-painel.sql nao cobre: convites, validacao,
-- dia vazio, filtros do lote, troca de nome na ficha e o gatilho de conflito
-- em dia nao prescrito.
--
-- Cole no SQL Editor DEPOIS do schema.sql e rode. Tudo dentro de `begin …
-- rollback`: nada fica no banco. Chegar ao `select 'ok'` e passar.
--
-- Personagens: b001 admin da zztx, b002 instrutor da zztx, b011 aluno da zztx,
-- b012 aluno do padrao, b021 conta com convite mas sem e-mail confirmado.

begin;

insert into public.gyms (id, name) values ('zztx', 'Academia X'), ('zzty', 'Academia Y')
on conflict (id) do nothing;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-00000000b001', 'admin@bx.voluma', now()),
  ('00000000-0000-4000-8000-00000000b002', 'instrutor@bx.voluma', now()),
  ('00000000-0000-4000-8000-00000000b011', 'ana@bx.voluma', now()),
  ('00000000-0000-4000-8000-00000000b012', 'bia@bx.voluma', now()),
  ('00000000-0000-4000-8000-00000000b021', 'sem.confirmar@bx.voluma', null)
on conflict (id) do nothing;

insert into public.gym_staff (gym_id, user_id, role) values
  ('zztx', '00000000-0000-4000-8000-00000000b001', 'admin'),
  ('zztx', '00000000-0000-4000-8000-00000000b002', 'instructor');

insert into public.profiles (id, gym_id, handle) values
  ('00000000-0000-4000-8000-00000000b011', 'zztx', 'anabx'),
  ('00000000-0000-4000-8000-00000000b012', 'padrao', 'biabx');

-- A Ana tem uma corrida e uma rosca num dia que o instrutor vai prescrever, e
-- um dia so dela (sexta). O ajuste de volume nao pode pegar a corrida.
do $$
declare
  ana constant uuid := '00000000-0000-4000-8000-00000000b011';
  ts  constant timestamptz := now() - interval '1 day';
begin
  insert into public.exercises (id, user_id, gym_id, name, muscle_group, kind, updated_at) values
    ('00000000-0000-4000-8000-0000000b0e01', ana, 'zztx', 'Rosca direta', 'biceps', 'strength', ts),
    ('00000000-0000-4000-8000-0000000b0e02', ana, 'zztx', 'Esteira', null, 'run', ts),
    ('00000000-0000-4000-8000-0000000b0e03', ana, 'zztx', 'Supino reto', 'peito', 'strength', ts);
  insert into public.routines (id, user_id, gym_id, name, weekday, updated_at) values
    ('00000000-0000-4000-8000-0000000b0a05', ana, 'zztx', 'Meu dia', 5, ts);
  insert into public.routine_exercises (id, user_id, gym_id, routine_id, exercise_id, position, updated_at) values
    ('00000000-0000-4000-8000-0000000b0c51', ana, 'zztx', '00000000-0000-4000-8000-0000000b0a05',
     '00000000-0000-4000-8000-0000000b0e03', 0, ts);
end $$;

-- 1. Convites: so admin le e revoga; sem e-mail confirmado nao vira equipe
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  n int;
begin
  perform public.staff_invite('zztx', 'sem.confirmar@bx.voluma');  -- tem conta: entra direto
  perform public.staff_remove('zztx', '00000000-0000-4000-8000-00000000b021');
  perform public.staff_invite('zztx', 'futuro@bx.voluma');
  perform public.staff_invite('zztx', 'futuro@bx.voluma');           -- repetir nao duplica
  select count(*) into n from public.gym_staff_invites where gym_id = 'zztx';
  assert n = 1, format('convite repetido duplicou (%s)', n);
  perform public.staff_revoke_invite('zztx', ' FUTURO@bx.voluma ');
  select count(*) into n from public.gym_staff_invites where gym_id = 'zztx';
  assert n = 0, 'revogar nao apagou o convite';
  begin
    perform public.staff_invite('zztx', 'sem-arroba');
    raise exception 'aceitou e-mail invalido';
  exception when sqlstate '22023' then null;
  end;
end $$;
reset role;

-- O convite pendente de quem ainda nao confirmou o e-mail nao e resgatado
insert into public.gym_staff_invites (gym_id, email, role) values ('zztx', 'sem.confirmar@bx.voluma', 'instructor');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b021","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  n int;
begin
  select count(*) into n from public.staff_claim_invites();
  assert n = 0, 'resgatou convite sem e-mail confirmado';
end $$;
reset role;

-- 2. Instrutor: sem as RPCs de admin; validacao e dia vazio
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  ana constant uuid := '00000000-0000-4000-8000-00000000b011';
  rid uuid;
  rec record;
  n   int;
begin
  begin
    perform * from public.staff_list('zztx');
    raise exception 'instrutor listou a equipe';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.staff_remove('zztx', '00000000-0000-4000-8000-00000000b001');
    raise exception 'instrutor tirou o admin';
  exception when insufficient_privilege then null;
  end;

  -- Validacao: dia fora de 0..6, mais de 30 itens, exercicio de outro dia, kind invalido
  begin
    perform public.staff_set_day('zztx', ana, 7::smallint, 'X', '[]');
    raise exception 'aceitou dia 7';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.staff_set_day('zztx', ana, 1::smallint, 'X',
      (select jsonb_agg(jsonb_build_object('name', 'Ex ' || g)) from generate_series(1, 31) g));
    raise exception 'aceitou 31 exercicios';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.staff_set_day('zztx', ana, 1::smallint, 'X',
      '[{"routine_exercise_id": "00000000-0000-4000-8000-0000000b0c51", "name": "Supino reto"}]');
    raise exception 'aceitou exercicio de outro dia';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.staff_set_day('zztx', ana, 1::smallint, 'X', '[{"name": "Voo", "kind": "swim"}]');
    raise exception 'aceitou kind invalido';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.staff_clear_day('zztx', '00000000-0000-4000-8000-00000000b012', 1::smallint);
    raise exception 'tirou dia de aluno do padrao';
  exception when insufficient_privilege then null;
  end;

  -- Dia vazio: a rotina nasce prescrita, com corrida e rosca reaproveitadas do catalogo
  rid := public.staff_set_day('zztx', ana, 1::smallint, 'Segunda', '[
    {"name": "rosca direta", "sets": 4, "reps": 10},
    {"name": "Esteira", "kind": "run", "distance_km": 5, "duration_min": 30}]');
  select * into rec from public.routines where id = rid;
  assert rec.weekday = 1 and rec.prescribed_by = '00000000-0000-4000-8000-00000000b002' and rec.position = 0,
    format('dia vazio mal criado: %s', to_jsonb(rec));
  select count(*) into n from public.exercises
   where user_id = ana and public.exercise_name_key(name) in ('rosca direta', 'esteira');
  assert n = 2, format('dia vazio duplicou exercicio do catalogo (%s)', n);
  select count(*) into n from public.routine_exercises re join public.exercises e on e.id = re.exercise_id
   where re.routine_id = rid and re.deleted_at is null and e.name = 'Esteira' and re.target_distance_km = 5;
  assert n = 1, 'a corrida nao entrou com a distancia';

  -- 3. Volume: filtros por dia, grupo e nome; corrida fica de fora
  select * into rec from public.staff_adjust_volume('zztx', array[ana], match_day => 5::smallint, reps_set => 6);
  assert rec.rows_affected = 0 and rec.skipped_self_managed = 1, format('filtro por dia errado: %s', to_jsonb(rec));
  select * into rec from public.staff_adjust_volume('zztx', array[ana], match_group => 'BICEPS', reps_set => 6);
  assert rec.rows_affected = 1, format('filtro por grupo errado: %s', to_jsonb(rec));
  select * into rec from public.staff_adjust_volume('zztx', array[ana], match_name => 'Esteira', sets_delta => 1);
  assert rec.rows_affected = 0, 'o ajuste pegou a corrida';
  perform public.staff_adjust_volume('zztx', array[ana], reps_set => 6, dry_run => false);
  select re.target_reps into n from public.routine_exercises re join public.exercises e on e.id = re.exercise_id
   where re.routine_id = rid and e.name = 'Rosca direta' and re.deleted_at is null;
  assert n = 6, format('reps_set nao aplicou (%s)', n);
  begin
    perform public.staff_adjust_volume('zztx', array[ana]);
    raise exception 'aceitou ajuste vazio';
  exception when sqlstate '22023' then null;
  end;

  -- 4. Filtro de alunos: ficha, max_days e janela invalida
  select count(*) into n from public.staff_find_students('zztx', max_days => 0);
  assert n = 1, format('max_days 0 devia trazer a Ana (sem treino); veio %s', n);
  select count(*) into n from public.staff_find_students('zztx', preset => gen_random_uuid());
  assert n = 0, 'filtro por ficha inexistente trouxe alguem';
  begin
    perform * from public.staff_find_students('zztx', weeks => 0);
    raise exception 'aceitou janela 0';
  exception when sqlstate '22023' then null;
  end;

  -- 5. Troca: nomes invalidos e a ficha sem slug
  begin
    perform * from public.staff_swap_exercise('zztx', 'Rosca', 'rosca', null, 'strength', array[ana]);
    raise exception 'aceitou trocar pelo mesmo';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform * from public.staff_swap_exercise('zztx', 'Rosca', 'Martelo', null, 'strength', array[ana], include_presets => true);
    raise exception 'aceitou troca na ficha sem movement_slug';
  exception when sqlstate '22023' then null;
  end;
end $$;

-- 6. Fichas: renomear um exercicio (mesmo id) sai e entra de novo; ficha de outra academia
do $$
declare
  pid uuid;
  pe  uuid;
  n   int;
begin
  pid := public.staff_upsert_preset('zztx', '{"name": "Ficha B", "exercises": [
    {"movement_slug": "barbell-curl", "name": "Rosca direta", "sets": 3, "reps": 12}]}');
  pe := (select id from public.gym_preset_exercises where preset_id = pid);
  perform public.staff_upsert_preset('zztx', jsonb_build_object('id', pid, 'name', 'Ficha B', 'exercises', jsonb_build_array(
    jsonb_build_object('id', pe, 'movement_slug', 'hammer-curl', 'name', 'Rosca martelo', 'sets', 3, 'reps', 12))));
  select count(*) into n from public.gym_preset_exercises where id = pe and deleted_at is not null;
  assert n = 1, 'trocar o nome devia tirar o exercicio velho da ficha';
  select count(*) into n from public.gym_preset_exercises where preset_id = pid and deleted_at is null and name = 'Rosca martelo';
  assert n = 1, 'trocar o nome devia pôr o exercicio novo na ficha';
  begin
    perform public.staff_upsert_preset('zztx', jsonb_build_object('id', pid, 'name', 'X', 'exercises', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'movement_slug', 'x', 'name', 'X'))));
    raise exception 'aceitou exercicio de outra ficha';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.staff_upsert_preset('zztx', '{"name": "Sem slug", "exercises": [{"name": "Supino"}]}');
    raise exception 'aceitou ficha sem movement_slug';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.staff_delete_preset('zzty', pid);
    raise exception 'apagou ficha pela academia errada';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 7. Gatilho de conflito: dia que nao e prescrito aceita qualquer linha nova;
--    o guarda tambem barra insert em week_targets
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b011","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  ana constant uuid := '00000000-0000-4000-8000-00000000b011';
  novo uuid := gen_random_uuid();
  rec record;
begin
  insert into public.routine_exercises (id, user_id, gym_id, routine_id, exercise_id, position, updated_at)
  values (novo, ana, 'zztx', '00000000-0000-4000-8000-0000000b0a05', '00000000-0000-4000-8000-0000000b0e01', 1,
          now() - interval '10 days');
  select * into rec from public.routine_exercises where id = novo;
  assert rec.deleted_at is null, 'linha velha num dia do proprio aluno nao devia entrar apagada';

  -- O aluno nunca liga o marcador pelo app, mas se ligasse, so barraria a si mesmo
  perform set_config('voluma.staff_write', '1', true);
  begin
    insert into public.week_targets (id, user_id, gym_id, week_start, routine_exercise_id, target_sets, target_reps, target_weight_kg)
    values (gen_random_uuid(), ana, 'zztx', current_date, novo, 3, 10, 20);
    raise exception 'o guarda deixou inserir ajuste da semana';
  exception when insufficient_privilege then null;
  end;
  perform set_config('voluma.staff_write', '', true);
end $$;
reset role;

select 'ok' as resultado;

rollback;

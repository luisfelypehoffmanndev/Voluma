-- Teste do painel da academia (v16): equipe, RLS, prescricao, lotes, fichas e
-- o conflito com o aluno offline.
--
-- Cole no SQL Editor DEPOIS do schema.sql e rode. Tudo dentro de `begin …
-- rollback`: nada fica no banco. Qualquer `assert` que falhar aborta com a
-- mensagem do caso; chegar ao `select 'ok'` e passar.
--
-- Personagens (sufixo do uuid):
--   a001 admin da zztx        a002 instrutor da zztx    a003 instrutor da zzty
--   a004 instrutor convidado por e-mail, entra depois
--   a011 aluno da zztx (prescrito)  a012 aluno do padrao  a013 aluno da zztx (plano proprio)

begin;

insert into public.gyms (id, name) values ('zztx', 'Academia X'), ('zzty', 'Academia Y')
on conflict (id) do nothing;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a001', 'admin@x.voluma'),
  ('00000000-0000-4000-8000-00000000a002', 'instrutor@x.voluma'),
  ('00000000-0000-4000-8000-00000000a003', 'instrutor@y.voluma'),
  ('00000000-0000-4000-8000-00000000a011', 'ana@aluno.voluma'),
  ('00000000-0000-4000-8000-00000000a012', 'bia@aluno.voluma'),
  ('00000000-0000-4000-8000-00000000a013', 'caio@aluno.voluma')
on conflict (id) do nothing;

-- O admin e o instrutor da outra academia sao cadastrados pela equipe Voluma.
insert into public.gym_staff (gym_id, user_id, role) values
  ('zztx', '00000000-0000-4000-8000-00000000a001', 'admin'),
  ('zzty', '00000000-0000-4000-8000-00000000a003', 'instructor');

-- Ids que passam de um bloco para outro (os blocos rodam com papeis diferentes).
create temporary table t_ids (k text primary key, v uuid);
grant all on t_ids to authenticated;

-- 0. Ninguem e equipe do mundo padrao
do $$
begin
  begin
    insert into public.gym_staff (gym_id, user_id, role)
    values ('padrao', '00000000-0000-4000-8000-00000000a001', 'admin');
    raise exception 'criou equipe no padrao';
  exception when check_violation then null;
  end;
end $$;

-- Dados dos alunos, como o app os sobe.
do $$
declare
  ana  constant uuid := '00000000-0000-4000-8000-00000000a011';
  bia  constant uuid := '00000000-0000-4000-8000-00000000a012';
  caio constant uuid := '00000000-0000-4000-8000-00000000a013';
  ts   constant timestamptz := now() - interval '1 day';
  ex_puxada uuid := gen_random_uuid();
  ex_rosca  uuid := gen_random_uuid();
  ex_maq    uuid := gen_random_uuid();
  r_seg     uuid := gen_random_uuid();
  r_qua     uuid := gen_random_uuid();
  r_sex     uuid := gen_random_uuid();
  re_rosca  uuid := gen_random_uuid();
  s1        uuid := gen_random_uuid();
  c_puxada  uuid := gen_random_uuid();
  c_seg     uuid := gen_random_uuid();
begin
  insert into public.profiles (id, gym_id, handle, display_name) values
    (ana, 'zztx', 'ana', 'Ana'), (bia, 'padrao', 'bia', 'Bia'), (caio, 'zztx', 'caio', 'Caio');

  insert into public.exercises (id, user_id, gym_id, name, muscle_group, updated_at) values
    (ex_puxada, ana, 'zztx', 'Puxada alta', 'costas', ts),
    (ex_rosca,  ana, 'zztx', 'Rosca direta', 'biceps', ts),
    (ex_maq,    ana, 'zztx', 'Puxada na máquina', 'costas', ts),
    (c_puxada,  caio, 'zztx', 'Puxada alta', 'costas', ts),
    (gen_random_uuid(), bia, 'padrao', 'Puxada alta', 'costas', ts);

  -- Ana: segunda (vai ser prescrita), quarta e sexta (prescritas depois)
  insert into public.routines (id, user_id, gym_id, name, weekday, updated_at) values
    (r_seg, ana, 'zztx', 'Pull', 1, ts),
    (r_qua, ana, 'zztx', 'Costas', 3, ts),
    (r_sex, ana, 'zztx', 'Costas 2', 5, ts),
    (c_seg, caio, 'zztx', 'Meu treino', 1, ts);

  insert into public.routine_exercises
    (id, user_id, gym_id, routine_id, exercise_id, position, target_sets, target_reps, target_weight_kg, updated_at)
  values
    (gen_random_uuid(), ana, 'zztx', r_seg, ex_puxada, 0, 3, 10, 50, ts),
    (re_rosca,          ana, 'zztx', r_seg, ex_rosca,  1, 3, 12, 14, ts),
    (gen_random_uuid(), ana, 'zztx', r_qua, ex_puxada, 0, 4, 10, 50, ts),
    (gen_random_uuid(), ana, 'zztx', r_sex, ex_puxada, 0, 4, 10, 50, ts),
    (gen_random_uuid(), ana, 'zztx', r_sex, ex_maq,    1, 3, 12, 40, ts),
    (gen_random_uuid(), caio, 'zztx', c_seg, c_puxada, 0, 3, 10, 45, ts);

  -- Historico da Ana: um dia treinado (serie com carga) e um treino aberto e largado
  insert into public.sessions (id, user_id, gym_id, routine_id, date, started_at, updated_at) values
    (s1, ana, 'zztx', r_seg, current_date - 2, now() - interval '2 days', ts),
    (gen_random_uuid(), ana, 'zztx', r_seg, current_date - 1, now() - interval '1 day', ts);
  insert into public.session_sets (id, user_id, gym_id, session_id, exercise_id, set_index, reps, weight_kg, done, updated_at)
  values (gen_random_uuid(), ana, 'zztx', s1, ex_rosca, 1, 12, 14, true, ts);
  insert into public.week_targets (id, user_id, gym_id, week_start, routine_exercise_id, target_sets, target_reps, target_weight_kg, updated_at)
  values (gen_random_uuid(), ana, 'zztx', current_date - extract(dow from current_date)::int, re_rosca, 5, 5, 16, ts);
  insert into public.body_weight_logs (id, user_id, gym_id, logged_at, weight_kg, updated_at)
  values (gen_random_uuid(), ana, 'zztx', ts, 61.5, ts);

  insert into t_ids values ('r_seg', r_seg), ('r_qua', r_qua), ('r_sex', r_sex), ('re_rosca', re_rosca),
                           ('c_seg', c_seg), ('ex_rosca', ex_rosca);
end $$;

-- A foto do historico, para provar no fim que o painel nao tocou nele.
create temporary table t_history as
select 'sessions' as t, md5(string_agg(to_jsonb(x)::text, '' order by x.id)) as h from public.sessions x
union all
select 'session_sets', md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from public.session_sets x
union all
select 'week_targets', md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from public.week_targets x
union all
select 'body_weight_logs', md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from public.body_weight_logs x;

-- 1. Anonimo nao chama nada
set local role anon;
do $$
begin
  begin
    perform public.staff_find_students('zztx');
    raise exception 'anon chamou staff_find_students';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.staff_set_day('zztx', '00000000-0000-4000-8000-00000000a011', 1::smallint, 'x', '[]');
    raise exception 'anon chamou staff_set_day';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 2. Instrutor de OUTRA academia
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  n int;
begin
  begin
    perform public.staff_set_day('zztx', '00000000-0000-4000-8000-00000000a011', 1::smallint, 'x', '[]');
    raise exception 'instrutor da zzty prescreveu na zztx';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.staff_find_students('zztx');
    raise exception 'instrutor da zzty listou alunos da zztx';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.routines where gym_id = 'zztx';
  assert n = 0, format('instrutor da zzty viu %s rotinas da zztx', n);
end $$;
reset role;

-- 3. Admin monta a equipe
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  r text;
  n int;
begin
  r := public.staff_invite('zztx', ' Instrutor@X.voluma ');
  assert r = 'added', format('instrutor com conta devia entrar na hora; veio %s', r);
  r := public.staff_invite('zztx', 'novo@x.voluma');
  assert r = 'invited', format('instrutor sem conta devia ficar no convite; veio %s', r);
  begin
    perform public.staff_invite('zztx', 'outro@x.voluma', 'admin');
    raise exception 'admin criou outro admin';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.gym_staff (gym_id, user_id, role)
    values ('zztx', '00000000-0000-4000-8000-00000000a013', 'admin');
    raise exception 'admin escreveu direto em gym_staff';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.staff_list('zztx');
  assert n = 2, format('staff_list devia ter 2 pessoas; tem %s', n);
  select count(*) into n from public.gym_staff_invites;
  assert n = 1, format('admin devia ver 1 convite; viu %s', n);
end $$;
reset role;

-- O convidado cria a conta e entra no painel
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000a004', 'novo@x.voluma');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a004","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  n int;
begin
  select count(*) into n from public.staff_claim_invites() where gym_id = 'zztx' and role = 'instructor';
  assert n = 1, 'o convite nao virou equipe';
end $$;
reset role;

-- 4. Instrutor: le o plano, nao le historico, nao escreve direto
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  n int;
begin
  select count(*) into n from public.routines where user_id = '00000000-0000-4000-8000-00000000a011';
  assert n = 3, format('instrutor devia ver as 3 rotinas da Ana; viu %s', n);
  select count(*) into n from public.routines where user_id = '00000000-0000-4000-8000-00000000a012';
  assert n = 0, 'instrutor viu o plano de aluno do padrao';
  -- Idade, anos de treino e foto estao atras do toggle: o painel le nome e @
  -- pelo staff_find_students, nunca a linha do perfil
  select count(*) into n from public.profiles where gym_id = 'zztx';
  assert n = 0, format('instrutor leu %s perfis da zztx', n);
  select count(*) into n from public.sessions;
  assert n = 0, 'instrutor leu sessoes';
  select count(*) into n from public.session_sets;
  assert n = 0, 'instrutor leu series';
  select count(*) into n from public.week_targets;
  assert n = 0, 'instrutor leu o ajuste da semana';
  select count(*) into n from public.body_weight_logs;
  assert n = 0, 'instrutor leu o peso';
  select count(*) into n from public.prescription_log;
  assert n = 0, 'instrutor leu o log (so admin)';

  update public.routines set name = 'hack' where user_id = '00000000-0000-4000-8000-00000000a011';
  get diagnostics n = row_count;
  assert n = 0, 'instrutor escreveu direto numa rotina';

  begin
    perform public.staff_invite('zztx', 'x@x.voluma');
    raise exception 'instrutor convidou';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 5. staff_set_day
do $$
declare
  ana      constant uuid := '00000000-0000-4000-8000-00000000a011';
  r_seg    uuid := (select v from t_ids where k = 'r_seg');
  re_rosca uuid := (select v from t_ids where k = 're_rosca');
  rid      uuid;
  stamp    timestamptz;
  rec      record;
  n        int;
begin
  rid := public.staff_set_day('zztx', ana, 1::smallint, 'Pull A', jsonb_build_array(
    jsonb_build_object('routine_exercise_id', re_rosca, 'name', 'Rosca direta', 'sets', 4, 'reps', 8),
    jsonb_build_object('name', 'Remada curvada', 'muscle_group', 'costas', 'sets', 3, 'reps', 10),
    jsonb_build_object('name', 'ROSCA DIRETA', 'sets', 5, 'reps', 5)   -- repetida: ignorada
  ));
  assert rid = r_seg, 'staff_set_day devia reaproveitar a rotina da segunda';

  select * into rec from public.routines where id = r_seg;
  assert rec.prescribed_by = '00000000-0000-4000-8000-00000000a002', 'rotina nao ficou prescrita';
  assert rec.prescribed_at is not null and rec.name = 'Pull A' and rec.preset_id is null, 'rotina mal prescrita';

  select * into rec from public.routine_exercises where id = re_rosca;
  assert rec.deleted_at is null and rec.position = 0 and rec.target_sets = 4 and rec.target_reps = 8,
    format('rosca mal atualizada: %s', to_jsonb(rec));
  assert rec.target_weight_kg = 14, 'o painel mudou a carga do aluno';

  select count(*) into n from public.routine_exercises re
    join public.exercises e on e.id = re.exercise_id
   where re.routine_id = r_seg and re.deleted_at is null;
  assert n = 2, format('segunda devia ter 2 exercicios vivos; tem %s', n);

  select re.position, re.target_weight_kg into rec
    from public.routine_exercises re join public.exercises e on e.id = re.exercise_id
   where re.routine_id = r_seg and re.deleted_at is null and e.name = 'Remada curvada';
  assert rec.position = 1 and rec.target_weight_kg = 0, 'remada entrou errada';

  -- A puxada saiu do dia
  select count(*) into n from public.routine_exercises re
    join public.exercises e on e.id = re.exercise_id
   where re.routine_id = r_seg and e.name = 'Puxada alta' and re.deleted_at is not null;
  assert n = 1, 'a puxada devia ter saido da segunda';

  -- Concorrencia otimista
  stamp := (select updated_at from public.routines where id = r_seg) - interval '1 second';
  begin
    perform public.staff_set_day('zztx', ana, 1::smallint, 'Pull A', '[]', stamp);
    raise exception 'staff_set_day aceitou expected_updated_at velho';
  exception when sqlstate 'P0409' then null;
  end;

  -- Validacao
  begin
    perform public.staff_set_day('zztx', ana, 1::smallint, 'Pull A', '[{"name": "Supino", "sets": 50}]');
    raise exception 'aceitou 50 series';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.staff_set_day('zztx', '00000000-0000-4000-8000-00000000a012', 1::smallint, 'x', '[]');
    raise exception 'prescreveu para aluno do padrao';
  exception when insufficient_privilege then null;
  end;

  -- Quarta e sexta prescritas como estao (a troca em lote vai atuar nelas)
  perform public.staff_set_day('zztx', ana, 3::smallint, 'Costas', '[{"name": "Puxada alta", "sets": 4, "reps": 10}]');
  perform public.staff_set_day('zztx', ana, 5::smallint, 'Costas 2',
    '[{"name": "Puxada alta", "sets": 4, "reps": 10}, {"name": "Puxada na maquina", "sets": 3, "reps": 12}]');
  select count(*) into n from public.routine_exercises
   where routine_id = (select v from t_ids where k = 'r_sex') and deleted_at is null;
  assert n = 2, format('sexta devia manter 2 exercicios (acento nao conta); tem %s', n);
end $$;
reset role;

-- 6. Conflito: o aluno sobe edicoes feitas offline
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a011","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  ana      constant uuid := '00000000-0000-4000-8000-00000000a011';
  r_seg    uuid := (select v from t_ids where k = 'r_seg');
  re_rosca uuid := (select v from t_ids where k = 're_rosca');
  ex_rosca uuid := (select v from t_ids where k = 'ex_rosca');
  stamp    timestamptz := (select prescribed_at from public.routines where id = r_seg);
  velho    uuid := gen_random_uuid();
  novo     uuid := gen_random_uuid();
  rec      record;
begin
  -- Exercicio que ela pos offline ANTES da prescricao: entra apagado
  insert into public.routine_exercises (id, user_id, gym_id, routine_id, exercise_id, position, updated_at)
  values (velho, ana, 'zztx', r_seg, ex_rosca, 9, stamp - interval '1 hour');
  select * into rec from public.routine_exercises where id = velho;
  assert rec.deleted_at is not null and rec.updated_at > stamp, 'linha nova velha devia entrar apagada e com carimbo novo';

  -- DEPOIS da prescricao: entra viva (o app desvincula junto)
  insert into public.routine_exercises (id, user_id, gym_id, routine_id, exercise_id, position, updated_at)
  values (novo, ana, 'zztx', r_seg, ex_rosca, 9, stamp + interval '1 hour');
  select * into rec from public.routine_exercises where id = novo;
  assert rec.deleted_at is null, 'linha nova posterior a prescricao devia entrar viva';

  -- Edicao velha de linha que ja existe, como upsert do push: o servidor fica
  -- com a dele, e a linha NAO vira remocao
  insert into public.routine_exercises (id, user_id, gym_id, routine_id, exercise_id, position, target_sets, updated_at)
  values (re_rosca, ana, 'zztx', r_seg, ex_rosca, 0, 9, stamp - interval '1 hour')
  on conflict (id) do update
    set target_sets = excluded.target_sets, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at;
  select * into rec from public.routine_exercises where id = re_rosca;
  assert rec.deleted_at is null and rec.target_sets = 4, format('upsert velho mexeu na linha: %s', to_jsonb(rec));

  -- O aluno desvincula pelo app (zera so o prescribed_by)
  update public.routines set prescribed_by = null, updated_at = clock_timestamp() where id = r_seg;
end $$;
reset role;

-- 7. Lotes (instrutor)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  ana   constant uuid := '00000000-0000-4000-8000-00000000a011';
  caio  constant uuid := '00000000-0000-4000-8000-00000000a013';
  r_qua uuid := (select v from t_ids where k = 'r_qua');
  r_sex uuid := (select v from t_ids where k = 'r_sex');
  c_seg uuid := (select v from t_ids where k = 'c_seg');
  rec   record;
  n     int;
begin
  -- Filtro
  select count(*) into n from public.staff_find_students('zztx');
  assert n = 2, format('a zztx tem 2 alunos; veio %s', n);
  select * into rec from public.staff_find_students('zztx') where user_id = ana;
  assert rec.trained_days = 1, format('Ana treinou 1 dia (o treino largado nao conta); veio %s', rec.trained_days);
  assert rec.last_trained_on = current_date - 2, 'ultimo dia treinado errado';
  assert rec.prescribed_days = 2 and rec.self_edited_days = 1 and rec.planned_days = 3,
    format('contagem de dias errada: %s', to_jsonb(rec));
  select count(*) into n from public.staff_find_students('zztx', prescribed_only => true);
  assert n = 1, 'prescribed_only devia trazer so a Ana';
  select count(*) into n from public.staff_find_students('zztx', has_exercise => 'puxada ALTA');
  assert n = 2, format('os dois tem puxada alta; veio %s', n);
  select count(*) into n from public.staff_find_students('zztx', min_days => 1);
  assert n = 1, 'min_days 1 devia trazer so a Ana';
  select count(*) into n from public.staff_find_students('zztx', inactive_since => current_date);
  assert n = 2, 'os dois estao sem treino hoje';

  -- Troca: previa nao escreve
  select * into rec from public.staff_swap_exercise('zztx', 'Puxada alta', 'Puxada na máquina', 'costas', 'strength',
                                                     array[ana, caio]);
  assert rec.rows_affected = 2 and rec.students_affected = 1 and rec.skipped_self_managed = 1
     and rec.skipped_duplicate = 1 and rec.skipped_preset_linked = 0,
    format('previa da troca errada: %s', to_jsonb(rec));
  select count(*) into n from public.routine_exercises re join public.exercises e on e.id = re.exercise_id
   where re.routine_id in (r_qua, r_sex) and re.deleted_at is null and e.name = 'Puxada alta';
  assert n = 2, 'a previa escreveu';

  -- Troca: aplicar
  perform public.staff_swap_exercise('zztx', 'Puxada alta', 'Puxada na máquina', 'costas', 'strength',
                                     array[ana, caio], dry_run => false);
  select re.position, re.target_sets, re.target_reps, re.target_weight_kg into rec
    from public.routine_exercises re join public.exercises e on e.id = re.exercise_id
   where re.routine_id = r_qua and re.deleted_at is null;
  assert rec.position = 0 and rec.target_sets = 4 and rec.target_reps = 10 and rec.target_weight_kg = 0,
    format('troca da quarta errada: %s', to_jsonb(rec));
  select count(*) into n from public.routine_exercises where routine_id = r_qua and deleted_at is null;
  assert n = 1, 'quarta devia ter so o exercicio novo';
  select count(*) into n from public.routine_exercises where routine_id = r_sex and deleted_at is null;
  assert n = 1, 'sexta (ja tinha o novo) devia ficar so com ele';
  select count(*) into n from public.routine_exercises where routine_id = c_seg and deleted_at is null;
  assert n = 1, 'o plano proprio do Caio foi tocado';
  select count(*) into n from public.exercises e
   where e.user_id = ana and public.exercise_name_key(e.name) = public.exercise_name_key('Puxada na maquina');
  assert n = 1, format('a troca duplicou o exercicio no catalogo da Ana (%s)', n);

  -- Volume: so os dias prescritos, so o que muda
  select * into rec from public.staff_adjust_volume('zztx', array[ana, caio], sets_delta => 1);
  -- puladas: os 3 da segunda da Ana (desvinculada no caso 6) e o 1 do Caio
  assert rec.rows_affected = 2 and rec.skipped_self_managed = 4,
    format('previa do volume errada: %s', to_jsonb(rec));
  perform public.staff_adjust_volume('zztx', array[ana, caio], sets_delta => 20, dry_run => false);
  select max(target_sets) into n from public.routine_exercises where routine_id in (r_qua, r_sex) and deleted_at is null;
  assert n = 12, format('series devia parar em 12; ficou %s', n);
  select target_sets into n from public.routine_exercises where routine_id = c_seg and deleted_at is null;
  assert n = 3, 'o volume mexeu no plano do Caio';
  begin
    perform public.staff_adjust_volume('zztx', array[ana], sets_set => 99);
    raise exception 'aceitou 99 series';
  exception when sqlstate '22023' then null;
  end;
end $$;

-- 8. Fichas pelo painel
do $$
declare
  caio constant uuid := '00000000-0000-4000-8000-00000000a013';
  c_seg uuid := (select v from t_ids where k = 'c_seg');
  pid  uuid;
  n    int;
begin
  pid := public.staff_upsert_preset('zztx', '{"name": "Treino A", "exercises": [
    {"movement_slug": "lat-pulldown", "name": "Puxada alta", "muscle_group": "costas", "sets": 3, "reps": 12}]}');
  insert into t_ids values ('pid', pid);
end $$;
reset role;

-- O Caio adota a ficha (o app faz isso localmente e sobe a rotina vinculada)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a013","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  caio constant uuid := '00000000-0000-4000-8000-00000000a013';
  pid  uuid := (select v from t_ids where k = 'pid');
  rid  uuid := gen_random_uuid();
  ex   uuid := (select id from public.exercises where user_id = caio and name = 'Puxada alta');
  pe   uuid := (select id from public.gym_preset_exercises where preset_id = pid);
begin
  insert into public.routines (id, user_id, gym_id, name, weekday, preset_id, updated_at)
  values (rid, caio, 'zztx', 'Treino A', 2, pid, clock_timestamp());
  insert into public.routine_exercises (id, user_id, gym_id, routine_id, exercise_id, preset_exercise_id, position, target_sets, target_reps, updated_at)
  values (gen_random_uuid(), caio, 'zztx', rid, ex, pe, 0, 3, 12, clock_timestamp());
  insert into t_ids values ('c_ter', rid);
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  caio  constant uuid := '00000000-0000-4000-8000-00000000a013';
  pid   uuid := (select v from t_ids where k = 'pid');
  c_ter uuid := (select v from t_ids where k = 'c_ter');
  pe    uuid := (select id from public.gym_preset_exercises where preset_id = pid);
  rec   record;
  n     int;
begin
  -- A ficha muda series e ganha um exercicio: o dia vinculado do Caio acompanha
  perform public.staff_upsert_preset('zztx', jsonb_build_object('id', pid, 'name', 'Treino A1', 'exercises', jsonb_build_array(
    jsonb_build_object('id', pe, 'movement_slug', 'lat-pulldown', 'name', 'Puxada alta', 'muscle_group', 'costas', 'sets', 4, 'reps', 10),
    jsonb_build_object('movement_slug', 'barbell-curl', 'name', 'Rosca direta', 'muscle_group', 'biceps', 'sets', 3, 'reps', 12))));
  select count(*) into n from public.routine_exercises where routine_id = c_ter and deleted_at is null;
  assert n = 2, format('o dia vinculado devia ter 2 exercicios; tem %s', n);
  select name into rec from public.routines where id = c_ter;
  assert rec.name = 'Treino A1', 'o dia vinculado nao acompanhou o nome da ficha';

  -- Troca com as fichas: a ficha troca e o dia vinculado acompanha
  select * into rec from public.staff_swap_exercise('zztx', 'Puxada alta', 'Puxada na máquina', 'costas', 'strength',
                                                     array[caio], include_presets => true, to_slug => 'machine-pulldown',
                                                     dry_run => false);
  assert rec.presets_affected = 1 and rec.skipped_preset_linked = 1, format('troca com ficha errada: %s', to_jsonb(rec));
  select count(*) into n from public.routine_exercises re join public.exercises e on e.id = re.exercise_id
   where re.routine_id = c_ter and re.deleted_at is null and e.name = 'Puxada na máquina';
  assert n = 1, 'o dia vinculado nao recebeu o exercicio novo da ficha';
  select count(*) into n from public.routine_exercises re join public.exercises e on e.id = re.exercise_id
   where re.routine_id = c_ter and re.deleted_at is null and e.name = 'Puxada alta';
  assert n = 0, 'o dia vinculado ficou com o exercicio velho';

  -- Apagar a ficha desvincula, sem apagar o treino de quem adotou
  perform public.staff_delete_preset('zztx', pid);
  select preset_id into rec from public.routines where id = c_ter;
  assert rec.preset_id is null, 'o dia nao se desvinculou da ficha apagada';
  select count(*) into n from public.routine_exercises where routine_id = c_ter and deleted_at is null;
  assert n = 2, format('apagar a ficha apagou o treino do Caio (%s vivos)', n);
end $$;

-- 9. Relogio do aluno adiantado: a prescricao nao some no sync_stamp
reset role;
update public.routines set updated_at = now() + interval '1 day'
 where id = (select v from t_ids where k = 'r_qua');
set local role authenticated;
do $$
declare
  r_qua uuid := (select v from t_ids where k = 'r_qua');
  rec   record;
begin
  perform public.staff_set_day('zztx', '00000000-0000-4000-8000-00000000a011', 3::smallint, 'Costas B', '[]');
  select * into rec from public.routines where id = r_qua;
  assert rec.name = 'Costas B' and rec.updated_at > now() + interval '1 day',
    format('com relogio adiantado a prescricao sumiu: %s', to_jsonb(rec));
end $$;

-- 10. Devolver e tirar o dia
do $$
declare
  ana   constant uuid := '00000000-0000-4000-8000-00000000a011';
  r_qua uuid := (select v from t_ids where k = 'r_qua');
  r_sex uuid := (select v from t_ids where k = 'r_sex');
  rec   record;
  n     int;
begin
  perform public.staff_release_day('zztx', ana, 3::smallint);
  select * into rec from public.routines where id = r_qua;
  assert rec.prescribed_by is null and rec.prescribed_at is null, 'release devia devolver o dia ao aluno';

  perform public.staff_clear_day('zztx', ana, 5::smallint);
  select count(*) into n from public.routine_exercises where routine_id = r_sex and deleted_at is null;
  assert n = 0, 'clear_day deixou exercicio vivo';
  select count(*) into n from public.routines where id = r_sex and deleted_at is not null;
  assert n = 1, 'clear_day nao apagou a rotina';
end $$;
reset role;

-- 11. O guarda do historico
do $$
begin
  perform set_config('voluma.staff_write', '1', true);
  begin
    update public.session_sets set reps = 99;
    raise exception 'o guarda deixou o painel escrever serie';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.body_weight_logs;
    raise exception 'o guarda deixou o painel apagar peso';
  exception when insufficient_privilege then null;
  end;
  perform set_config('voluma.staff_write', '', true);
end $$;

-- 12. O historico ficou exatamente como estava
do $$
declare
  rec record;
begin
  for rec in
    select t.t, t.h as antes, n.h as depois
      from t_history t
      join (
        select 'sessions' as t, md5(string_agg(to_jsonb(x)::text, '' order by x.id)) as h from public.sessions x
        union all
        select 'session_sets', md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from public.session_sets x
        union all
        select 'week_targets', md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from public.week_targets x
        union all
        select 'body_weight_logs', md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from public.body_weight_logs x
      ) n on n.t = t.t
  loop
    assert rec.antes = rec.depois, format('o painel mexeu em %s', rec.t);
  end loop;
end $$;

-- 13. O admin le o log e tira um instrutor
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  n int;
begin
  select count(*) into n from public.prescription_log where gym_id = 'zztx';
  assert n >= 10, format('o log devia ter as escritas do painel; tem %s', n);
  select count(*) into n from public.prescription_log where gym_id <> 'zztx';
  assert n = 0, 'admin viu log de outra academia';

  perform public.staff_remove('zztx', '00000000-0000-4000-8000-00000000a002');
  begin
    perform public.staff_remove('zztx', '00000000-0000-4000-8000-00000000a001');
    raise exception 'admin tirou um admin';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  n int;
begin
  begin
    perform * from public.staff_find_students('zztx');
    raise exception 'instrutor removido continuou com acesso';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.routines where gym_id = 'zztx';
  assert n = 0, 'instrutor removido continuou lendo o plano';
end $$;
reset role;

select 'ok' as resultado;

rollback;

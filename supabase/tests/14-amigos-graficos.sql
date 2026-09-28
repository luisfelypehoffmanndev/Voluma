-- Teste de privacidade e de contagem das RPCs da aba Amigos (v8):
-- `friend_weekly_days` e `friend_monthly_distance`.
--
-- Cole no SQL Editor DEPOIS do schema.sql e rode. Tudo dentro de uma transacao
-- que termina em `rollback`: nada fica no banco. Qualquer `assert` que falhar
-- aborta com a mensagem do caso; chegar ao `select 'ok'` e passar.
--
-- Substitui o `13-ranking.sql`: a RPC da v7 foi removida na v8, e os casos de
-- privacidade dela foram trazidos para ca.
--
-- Intervalo: semanas de 13/09, 20/09 e 27/09/2026 (datas de 13/09 a 03/10);
-- mes: setembro/2026.
--
-- Pessoas:
--   eu    — quem olha; nao compartilha
--   bia   — amiga aceita, compartilha; treinos, corrida e rotinas
--   carla — amiga aceita, NAO compartilha, treinou e correu
--   fabi  — amiga aceita, compartilha, nunca treinou
--   duda  — pedido pendente, compartilha
--   edu   — ninguem para `eu`; dono de uma serie "intrusa" na sessao da bia

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'eu@teste.voluma'),
  ('00000000-0000-4000-8000-0000000000b1', 'bia@teste.voluma'),
  ('00000000-0000-4000-8000-0000000000c1', 'carla@teste.voluma'),
  ('00000000-0000-4000-8000-0000000000a1', 'fabi@teste.voluma'),
  ('00000000-0000-4000-8000-0000000000d1', 'duda@teste.voluma'),
  ('00000000-0000-4000-8000-0000000000f1', 'edu@teste.voluma');

insert into public.profiles (id, handle, shares_stats) values
  ('00000000-0000-4000-8000-0000000000e1', 'zzt_eu', false),
  ('00000000-0000-4000-8000-0000000000b1', 'zzt_bia', true),
  ('00000000-0000-4000-8000-0000000000c1', 'zzt_carla', false),
  ('00000000-0000-4000-8000-0000000000a1', 'zzt_fabi', true),
  ('00000000-0000-4000-8000-0000000000d1', 'zzt_duda', true),
  ('00000000-0000-4000-8000-0000000000f1', 'zzt_edu', true);

insert into public.friendships (requester_id, addressee_id, status) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000b1', 'accepted'),
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000e1', 'accepted'),
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000a1', 'accepted'),
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000d1', 'pending');

-- Rotinas da bia: segunda duas vezes (conta uma), quarta, e uma sexta apagada.
-- Meta esperada: 2 dias. A carla tem rotina, mas nao compartilha.
insert into public.routines (id, user_id, name, weekday, deleted_at) values
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000b1', 'A', 1, null),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000b1', 'A2', 1, null),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000b1', 'B', 3, null),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000b1', 'C', 5, now()),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000c1', 'A', 2, null),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000d1', 'A', 2, null);

-- Sessoes. Os comentarios dizem o que cada uma deve render para a bia.
insert into public.sessions (id, user_id, date, started_at, deleted_at) values
  -- semana 13/09: seg 14 conta
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b1', '2026-09-14', now(), null),
  -- semana 13/09: ter 15, dois treinos no mesmo dia contam um
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000b1', '2026-09-15', now(), null),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-0000000000b1', '2026-09-15', now(), null),
  -- semana 13/09: qua 16 so corrida (reps e kg zero) — km sim, dia treinado nao
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-0000000000b1', '2026-09-16', now(), null),
  -- semana 20/09: nada — a semana nao deve vir
  -- semana 27/09: seg 28 conta
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-0000000000b1', '2026-09-28', now(), null),
  -- semana 27/09: ter 29 sessao apagada — nada conta, nem a corrida dela
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-0000000000b1', '2026-09-29', now(), now()),
  -- semana 27/09: qua 30 so 0 kg, nao concluida e a serie intrusa do edu
  ('10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-0000000000b1', '2026-09-30', now(), null),
  -- fora do intervalo: sab 12/09 (antes) e dom 04/10 (depois)
  ('10000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-0000000000b1', '2026-09-12', now(), null),
  ('10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-0000000000b1', '2026-10-04', now(), null),
  -- corrida em outubro: fora do mes de setembro
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000b1', '2026-10-01', now(), null),
  -- a carla treinou e correu, mas nao compartilha
  ('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000c1', '2026-09-14', now(), null),
  -- a duda treinou, mas o pedido esta pendente
  ('10000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-0000000000d1', '2026-09-14', now(), null);

insert into public.session_sets
  (id, user_id, session_id, exercise_id, set_index, reps, weight_kg, distance_km, done, deleted_at)
values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000001', gen_random_uuid(), 0, 10, 50, 0, true, null),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000002', gen_random_uuid(), 0, 10, 50, 0, true, null),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000003', gen_random_uuid(), 0, 8, 40, 0, true, null),
  -- corrida valida: 5,25 km
  ('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000004', gen_random_uuid(), 0, 0, 0, 5.25, true, null),
  -- corrida nao concluida e corrida apagada: nao somam
  ('20000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000004', gen_random_uuid(), 1, 0, 0, 3, false, null),
  ('20000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000004', gen_random_uuid(), 2, 0, 0, 7, true, now()),
  ('20000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000005', gen_random_uuid(), 0, 10, 50, 0, true, null),
  -- sessao apagada: a serie esta viva, mas a sessao nao
  ('20000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000006', gen_random_uuid(), 0, 10, 50, 2, true, null),
  ('20000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000007', gen_random_uuid(), 0, 15, 0, 0, true, null),
  ('20000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000007', gen_random_uuid(), 1, 10, 50, 0, false, null),
  ('20000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000008', gen_random_uuid(), 0, 10, 50, 0, true, null),
  ('20000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000009', gen_random_uuid(), 0, 10, 50, 0, true, null),
  ('20000000-0000-4000-8000-00000000000d', '00000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-00000000000a', gen_random_uuid(), 0, 0, 0, 4, true, null),
  ('20000000-0000-4000-8000-00000000000e', '00000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-00000000000b', gen_random_uuid(), 0, 10, 50, 6, true, null),
  ('20000000-0000-4000-8000-00000000000f', '00000000-0000-4000-8000-0000000000d1', '10000000-0000-4000-8000-00000000000c', gen_random_uuid(), 0, 10, 50, 0, true, null),
  -- Intrusa: serie do edu pendurada na sessao de 30/09 da bia, com carga e km.
  -- Sem o filtro `st.user_id`, a bia ganharia um dia e 9 km que nao fez.
  ('20000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-000000000007', gen_random_uuid(), 0, 10, 50, 9, true, null);

-- ------------------------------------------------------------ vendo como eu
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  n int;
  r record;
begin
  assert to_regprocedure('public.friend_weekly_frequency(date, date)') is null,
    'a RPC da v7 devia ter sido removida na v8';

  -- bia: semanas 13/09 (2 dias) e 27/09 (1 dia); a de 20/09 nao vem.
  select count(*) into n from public.friend_weekly_days('2026-09-13', '2026-09-27')
    where handle = 'zzt_bia';
  assert n = 2, format('bia: esperava 2 semanas com treino, vieram %s', n);

  select * into r from public.friend_weekly_days('2026-09-13', '2026-09-27')
    where handle = 'zzt_bia' and week_start = '2026-09-13';
  assert r.days = 2, format('bia 13/09: esperava 2 dias (14 e 15), veio %s', r.days);
  assert r.shares, 'bia compartilha';
  assert r.planned_days = 2, format('bia: meta devia ser 2 (seg e qua), veio %s', r.planned_days);

  select * into r from public.friend_weekly_days('2026-09-13', '2026-09-27')
    where handle = 'zzt_bia' and week_start = '2026-09-27';
  assert r.days = 1, format('bia 27/09: esperava 1 dia (28), veio %s', r.days);

  -- carla: uma linha so, tudo nulo alem do handle e do `shares` falso.
  select count(*) into n from public.friend_weekly_days('2026-09-13', '2026-09-27')
    where handle = 'zzt_carla';
  assert n = 1, format('carla: esperava 1 linha, vieram %s', n);
  select * into r from public.friend_weekly_days('2026-09-13', '2026-09-27')
    where handle = 'zzt_carla';
  assert not r.shares, 'carla nao compartilha';
  assert r.planned_days is null and r.week_start is null and r.days is null,
    'carla nao compartilha: meta, semana e dias deviam ser nulos';

  -- fabi: compartilha e nunca treinou — aparece, com meta 0 e sem semana.
  select * into r from public.friend_weekly_days('2026-09-13', '2026-09-27')
    where handle = 'zzt_fabi';
  assert r.shares and r.planned_days = 0 and r.week_start is null,
    format('fabi: esperava shares, meta 0 e semana nula; veio %s', r);

  assert not exists (
    select 1 from public.friend_weekly_days('2026-09-13', '2026-09-27')
    where handle in ('zzt_duda', 'zzt_edu')
  ), 'pedido pendente e nao-amigo nao deviam aparecer';

  -- km: so a corrida valida da bia em setembro, arredondada.
  select km into r from public.friend_monthly_distance('2026-09-01', '2026-09-30')
    where handle = 'zzt_bia';
  assert r.km = 5.3::real, format('bia: esperava 5,3 km, veio %s', r.km);

  select km into r from public.friend_monthly_distance('2026-09-01', '2026-09-30')
    where handle = 'zzt_carla';
  assert r.km is null, format('carla nao compartilha: km devia ser nulo, veio %s', r.km);

  select km into r from public.friend_monthly_distance('2026-09-01', '2026-09-30')
    where handle = 'zzt_fabi';
  assert r.km = 0, format('fabi compartilha e nao correu: esperava 0, veio %s', r.km);

  select count(*) into n from public.friend_monthly_distance('2026-09-01', '2026-09-30');
  assert n = 3, format('km: so bia, carla e fabi (aceitas), vieram %s linhas', n);

  select km into r from public.friend_monthly_distance('2026-10-01', '2026-10-31')
    where handle = 'zzt_bia';
  assert r.km = 4::real, format('bia em outubro: esperava 4 km, veio %s', r.km);
end
$$;

reset role;

-- --------------------------------------------------- vendo como a bia
-- O consentimento e de cada lado: a bia compartilha, eu nao.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  r record;
begin
  select * into r from public.friend_weekly_days('2026-09-13', '2026-09-27')
    where handle = 'zzt_eu';
  assert found, 'a bia devia me ver';
  assert not r.shares and r.days is null, 'eu nao compartilho: a bia devia ver nulo';

  select * into r from public.friend_monthly_distance('2026-09-01', '2026-09-30')
    where handle = 'zzt_eu';
  assert found and r.km is null, 'eu nao compartilho: a bia devia ver km nulo';
end
$$;

reset role;

-- --------------------------------------------------------------- anonimo
set local role anon;

do $$
begin
  begin
    perform public.friend_weekly_days('2026-09-13', '2026-09-27');
    raise exception 'anon conseguiu executar friend_weekly_days';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.friend_monthly_distance('2026-09-01', '2026-09-30');
    raise exception 'anon conseguiu executar friend_monthly_distance';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

reset role;

select 'ok' as resultado;

rollback;

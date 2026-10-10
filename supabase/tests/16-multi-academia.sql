-- Teste do multi-academia (v11): mundos isolados no mesmo banco.
--
-- Cole no SQL Editor DEPOIS do schema.sql e rode. Tudo dentro de `begin …
-- rollback`: nada fica no banco nem no Storage (as linhas de
-- `storage.objects` sao so metadados, nenhum arquivo e enviado). Qualquer
-- `assert` que falhar aborta com a mensagem do caso; chegar ao `select 'ok'` e
-- passar.
--
-- Dois mundos: 'padrao' (o app padrao) e 'zztx' (uma academia de teste).
-- Pessoas, vistas por `eu`:
--   bia  — amiga aceita nos DOIS mundos, e treina nos dois
--   caio — so existe no zztx
--   dana — so existe no padrao, e me mandou um pedido la

begin;

insert into public.gyms (id, name) values ('zztx', 'Academia Teste');

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'eu@teste.voluma'),
  ('00000000-0000-4000-8000-0000000000b1', 'bia@teste.voluma'),
  ('00000000-0000-4000-8000-0000000000c1', 'caio@teste.voluma'),
  ('00000000-0000-4000-8000-0000000000d1', 'dana@teste.voluma');

-- O mesmo @ em dois mundos pode: sao dois perfis independentes. A foto da bia
-- no padrao esta no formato antigo, sem a pasta do mundo, como as que ja estao
-- no bucket.
insert into public.profiles (id, gym_id, handle, shares_stats, avatar_path) values
  ('00000000-0000-4000-8000-0000000000e1', 'padrao', 'zzt_eu', false, null),
  ('00000000-0000-4000-8000-0000000000e1', 'zztx', 'zzt_eu', false, null),
  ('00000000-0000-4000-8000-0000000000b1', 'padrao', 'zzt_bia', true,
    '00000000-0000-4000-8000-0000000000b1/1.jpg'),
  ('00000000-0000-4000-8000-0000000000b1', 'zztx', 'zzt_bia', true,
    '00000000-0000-4000-8000-0000000000b1/zztx/1.jpg'),
  ('00000000-0000-4000-8000-0000000000c1', 'zztx', 'zzt_caio', true,
    '00000000-0000-4000-8000-0000000000c1/zztx/1.jpg'),
  ('00000000-0000-4000-8000-0000000000d1', 'padrao', 'zzt_dana', true,
    '00000000-0000-4000-8000-0000000000d1/1.jpg');

-- O que o banco recusa, como dono do banco (antes de qualquer RLS).
do $$
declare
  caminho text;
begin
  -- O mesmo @ duas vezes no MESMO mundo.
  begin
    insert into public.profiles (id, gym_id, handle)
      values ('00000000-0000-4000-8000-0000000000d1', 'zztx', 'zzt_caio');
    raise exception 'aceitou o @ do caio duas vezes no zztx';
  exception
    when unique_violation then null;
  end;

  -- Foto fora da pasta do mundo: sem a pasta (so vale no padrao), do mundo
  -- errado, ou na pasta de outra pessoa.
  foreach caminho in array array[
    '00000000-0000-4000-8000-0000000000e1/1.jpg',
    '00000000-0000-4000-8000-0000000000e1/padrao/1.jpg',
    '00000000-0000-4000-8000-0000000000b1/zztx/1.jpg'
  ] loop
    begin
      update public.profiles set avatar_path = caminho
       where id = '00000000-0000-4000-8000-0000000000e1' and gym_id = 'zztx';
      raise exception 'avatar_path aceitou % no zztx', caminho;
    exception
      when check_violation then null;
    end;
  end loop;

  -- Mundo que nao existe: um build com slug errado nao cria mundo fantasma.
  begin
    insert into public.exercises (id, user_id, name, gym_id)
      values (gen_random_uuid(), '00000000-0000-4000-8000-0000000000e1', 'Supino', 'nao-existe');
    raise exception 'aceitou um gym_id que nao esta em gyms';
  exception
    when foreign_key_violation then null;
  end;

  -- O app instalado nao manda gym_id: a linha cai no padrao.
  insert into public.exercises (id, user_id, name)
    values ('00000000-0000-4000-8000-0000000001e1', '00000000-0000-4000-8000-0000000000e1', 'Agachamento');
  assert (select gym_id from public.exercises where id = '00000000-0000-4000-8000-0000000001e1') = 'padrao',
    'linha sem gym_id devia cair no padrao';
end
$$;

-- Eu e a bia somos amigos nos dois mundos (no zztx foi ela quem pediu); a
-- dana me pediu no padrao.
insert into public.friendships (requester_id, addressee_id, status, gym_id) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000b1', 'accepted', 'padrao'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000e1', 'accepted', 'zztx'),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e1', 'pending', 'padrao');

-- Mas no mesmo mundo continua um par, uma linha, em qualquer direcao.
do $$
begin
  begin
    insert into public.friendships (requester_id, addressee_id, status, gym_id) values
      ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000e1', 'pending', 'padrao');
    raise exception 'aceitou um segundo pedido entre eu e a bia no padrao';
  exception
    when unique_violation then null;
  end;
end
$$;

-- A bia treina nos dois mundos. Padrao: 1 dia na semana de 2026-09-13, 1 dia
-- planejado e 3 km. zztx: 2 dias, 2 planejados e 5 km.
insert into public.routines (id, user_id, gym_id, name, weekday) values
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000b1', 'padrao', 'A', 1),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000b1', 'zztx', 'A', 2),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000b1', 'zztx', 'B', 3);

insert into public.sessions (id, user_id, gym_id, date, started_at) values
  ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000b1', 'padrao', '2026-09-14', '2026-09-14 10:00+00'),
  ('00000000-0000-4000-8000-0000000005a2', '00000000-0000-4000-8000-0000000000b1', 'zztx', '2026-09-15', '2026-09-15 10:00+00'),
  ('00000000-0000-4000-8000-0000000005a3', '00000000-0000-4000-8000-0000000000b1', 'zztx', '2026-09-16', '2026-09-16 10:00+00');

insert into public.session_sets
  (id, user_id, gym_id, session_id, exercise_id, set_index, reps, weight_kg, distance_km, done) values
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000b1', 'padrao', '00000000-0000-4000-8000-0000000005a1', gen_random_uuid(), 1, 10, 50, 0, true),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000b1', 'padrao', '00000000-0000-4000-8000-0000000005a1', gen_random_uuid(), 1, 0, 0, 3, true),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000b1', 'zztx', '00000000-0000-4000-8000-0000000005a2', gen_random_uuid(), 1, 10, 50, 0, true),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000b1', 'zztx', '00000000-0000-4000-8000-0000000005a2', gen_random_uuid(), 1, 0, 0, 5, true),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000b1', 'zztx', '00000000-0000-4000-8000-0000000005a3', gen_random_uuid(), 1, 10, 50, 0, true);

-- A dana nao esta no zztx, mas subiu um arquivo la (a pasta e dela, entao o
-- Storage deixa). O pedido dela e no padrao: nao pode liberar a foto do zztx.
insert into storage.objects (bucket_id, name) values
  ('avatars', '00000000-0000-4000-8000-0000000000b1/1.jpg'),
  ('avatars', '00000000-0000-4000-8000-0000000000b1/zztx/1.jpg'),
  ('avatars', '00000000-0000-4000-8000-0000000000c1/zztx/1.jpg'),
  ('avatars', '00000000-0000-4000-8000-0000000000d1/1.jpg'),
  ('avatars', '00000000-0000-4000-8000-0000000000d1/zztx/1.jpg');

-- ------------------------------------------------------------ vendo como eu
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  r record;
  nomes text[];
  n int;
begin
  -- Busca por @: so no mundo pedido. Sem `gym`, o padrao (o app instalado).
  assert not exists (select 1 from public.find_profile_by_handle('zzt_caio')),
    'o caio so existe no zztx: nao devia ser achado no padrao';
  select * into r from public.find_profile_by_handle('zzt_caio', 'zztx');
  assert r.id = '00000000-0000-4000-8000-0000000000c1', 'devia achar o caio no zztx';

  assert public.request_friendship('zzt_caio') = 'not-found',
    'pedir o caio no padrao devia dar not-found';
  assert public.request_friendship('zzt_dana', 'zztx') = 'not-found',
    'pedir a dana no zztx devia dar not-found';
  assert public.request_friendship('zzt_caio', 'zztx') = 'ok',
    'pedir o caio no zztx devia funcionar';

  -- A lista de amigos e do mundo.
  select array_agg(handle order by handle) into nomes from public.list_friends();
  assert nomes = array['zzt_bia', 'zzt_dana'],
    format('no padrao esperava bia e dana; veio %s', nomes);
  select array_agg(handle order by handle) into nomes from public.list_friends('zztx');
  assert nomes = array['zzt_bia', 'zzt_caio'],
    format('no zztx esperava bia e caio; veio %s', nomes);

  -- O ranking e a corrida so contam os treinos do mundo.
  select * into r from public.friend_weekly_days('2026-09-13', '2026-09-13') where handle = 'zzt_bia';
  assert r.days = 1 and r.planned_days = 1,
    format('bia no padrao: esperava 1 dia de 1 planejado; veio %s de %s', r.days, r.planned_days);
  select * into r from public.friend_weekly_days('2026-09-13', '2026-09-13', 'zztx') where handle = 'zzt_bia';
  assert r.days = 2 and r.planned_days = 2,
    format('bia no zztx: esperava 2 dias de 2 planejados; veio %s de %s', r.days, r.planned_days);

  select * into r from public.friend_monthly_distance('2026-09-01', '2026-09-30') where handle = 'zzt_bia';
  assert r.km = 3, format('bia no padrao: esperava 3 km; veio %s', r.km);
  select * into r from public.friend_monthly_distance('2026-09-01', '2026-09-30', 'zztx') where handle = 'zzt_bia';
  assert r.km = 5, format('bia no zztx: esperava 5 km; veio %s', r.km);

  -- Fotos: a da bia nos dois mundos (aceita nos dois), a da dana so no padrao
  -- (o pedido dela e de la), e nenhuma do caio (eu pedi, ele nao aceitou).
  select array_agg(name order by name) into nomes from storage.objects where bucket_id = 'avatars';
  assert nomes = array[
    '00000000-0000-4000-8000-0000000000b1/1.jpg',
    '00000000-0000-4000-8000-0000000000b1/zztx/1.jpg',
    '00000000-0000-4000-8000-0000000000d1/1.jpg'
  ], format('fotos visiveis erradas: %s', nomes);

  -- Amizade forjada: quem recebe o pedido nao troca quem pediu, nem o mundo.
  begin
    update public.friendships
       set requester_id = '00000000-0000-4000-8000-0000000000c1', status = 'accepted'
     where requester_id = '00000000-0000-4000-8000-0000000000d1'
       and addressee_id = '00000000-0000-4000-8000-0000000000e1';
    raise exception 'consegui trocar o requester_id de um pedido que recebi';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.friendships set gym_id = 'zztx'
     where requester_id = '00000000-0000-4000-8000-0000000000d1'
       and addressee_id = '00000000-0000-4000-8000-0000000000e1';
    raise exception 'consegui mudar um pedido de mundo';
  exception
    when insufficient_privilege then null;
  end;

  -- Aceitar, como o app faz, continua funcionando.
  update public.friendships set status = 'accepted', updated_at = now()
   where requester_id = '00000000-0000-4000-8000-0000000000d1'
     and addressee_id = '00000000-0000-4000-8000-0000000000e1';
  get diagnostics n = row_count;
  assert n = 1, 'aceitar o pedido da dana devia atualizar 1 linha';

  -- O app nao le a lista de academias...
  begin
    perform 1 from public.gyms;
    raise exception 'authenticated conseguiu ler gyms';
  exception
    when insufficient_privilege then null;
  end;

  -- ...mas grava no proprio mundo: a FK confere sem precisar ler gyms.
  insert into public.exercises (id, user_id, name, gym_id)
    values (gen_random_uuid(), '00000000-0000-4000-8000-0000000000e1', 'Remada', 'zztx');
end
$$;

reset role;

-- ---------------------------------------------------- vendo como o caio
-- O meu pedido foi feito no zztx: aparece la, e nao no padrao.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  r record;
begin
  select * into r from public.list_friends('zztx') where handle = 'zzt_eu';
  assert found and r.direction = 'incoming', 'caio devia ver meu pedido no zztx';
  assert not exists (select 1 from public.list_friends()),
    'caio nao tem nada no padrao: a lista devia vir vazia';
end
$$;

reset role;

-- --------------------------------------------------------------- anonimo
set local role anon;

do $$
begin
  begin
    perform 1 from public.gyms;
    raise exception 'anon conseguiu ler gyms';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

reset role;

select 'ok' as resultado;

rollback;

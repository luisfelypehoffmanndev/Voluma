-- Teste da foto de perfil (v9): policies do bucket `avatars`, a foto e o
-- `since` no `list_friends`, e o `id` nas RPCs dos graficos.
--
-- Cole no SQL Editor DEPOIS do schema.sql e rode. Tudo dentro de `begin …
-- rollback`: nada fica no banco nem no Storage (as linhas de
-- `storage.objects` sao so metadados — nenhum arquivo e enviado). Qualquer
-- `assert` que falhar aborta com a mensagem do caso; chegar ao `select 'ok'` e
-- passar.
--
-- Pessoas, vistas por `eu`:
--   bia   — amiga aceita          → vejo a foto
--   carla — me mandou um pedido    → vejo a foto (ela escolheu se mostrar)
--   duda  — eu mandei um pedido    → NAO vejo a foto dela (ela nao aceitou)
--   edu   — nenhuma relacao        → NAO vejo a foto

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'eu@teste.voluma'),
  ('00000000-0000-4000-8000-0000000000b1', 'bia@teste.voluma'),
  ('00000000-0000-4000-8000-0000000000c1', 'carla@teste.voluma'),
  ('00000000-0000-4000-8000-0000000000d1', 'duda@teste.voluma'),
  ('00000000-0000-4000-8000-0000000000f1', 'edu@teste.voluma');

insert into public.profiles (id, handle, shares_stats, avatar_path, display_name) values
  ('00000000-0000-4000-8000-0000000000e1', 'zzt_eu', false, '00000000-0000-4000-8000-0000000000e1/1.jpg', 'Eu Teste'),
  ('00000000-0000-4000-8000-0000000000b1', 'zzt_bia', true, '00000000-0000-4000-8000-0000000000b1/1.jpg', 'Bia Teste'),
  ('00000000-0000-4000-8000-0000000000c1', 'zzt_carla', true, '00000000-0000-4000-8000-0000000000c1/1.jpg', 'Carla Teste'),
  ('00000000-0000-4000-8000-0000000000d1', 'zzt_duda', true, '00000000-0000-4000-8000-0000000000d1/1.jpg', 'Duda Teste'),
  ('00000000-0000-4000-8000-0000000000f1', 'zzt_edu', true, '00000000-0000-4000-8000-0000000000f1/1.jpg', 'Edu Teste');

-- Nome vazio, so espaco ou um paragrafo: o banco recusa.
do $$
declare
  nome text;
begin
  foreach nome in array array['', '   ', repeat('a', 41)] loop
    begin
      update public.profiles set display_name = nome
       where id = '00000000-0000-4000-8000-0000000000e1';
      raise exception 'display_name aceitou %', quote_literal(nome);
    exception
      when check_violation then null;
    end;
  end loop;
end
$$;

insert into public.friendships (requester_id, addressee_id, status) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000b1', 'accepted'),
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000e1', 'pending'),
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000d1', 'pending');

insert into storage.objects (bucket_id, name) values
  ('avatars', '00000000-0000-4000-8000-0000000000e1/1.jpg'),
  ('avatars', '00000000-0000-4000-8000-0000000000b1/1.jpg'),
  ('avatars', '00000000-0000-4000-8000-0000000000c1/1.jpg'),
  ('avatars', '00000000-0000-4000-8000-0000000000d1/1.jpg'),
  ('avatars', '00000000-0000-4000-8000-0000000000f1/1.jpg');

-- O caminho da foto tem que estar na pasta do dono: apontar para a foto de
-- outra pessoa faria os seus amigos verem o rosto dela como se fosse o seu.
do $$
begin
  begin
    update public.profiles
       set avatar_path = '00000000-0000-4000-8000-0000000000b1/1.jpg'
     where id = '00000000-0000-4000-8000-0000000000e1';
    raise exception 'avatar_path aceitou a foto de outra pessoa';
  exception
    when check_violation then null;
  end;
end
$$;

-- ------------------------------------------------------------ vendo como eu
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  visiveis text[];
  r record;
  n int;
begin
  select array_agg(split_part(name, '-', 5) order by name) into visiveis
    from storage.objects where bucket_id = 'avatars';
  assert visiveis = array['0000000000b1/1.jpg', '0000000000c1/1.jpg', '0000000000e1/1.jpg'],
    format('eu devia ver so a minha, a da bia (aceita) e a da carla (me pediu); vi %s', visiveis);

  -- Escrever na pasta de outra pessoa.
  begin
    insert into storage.objects (bucket_id, name)
      values ('avatars', '00000000-0000-4000-8000-0000000000b1/2.jpg');
    raise exception 'consegui gravar na pasta da bia';
  exception
    when insufficient_privilege then null;
  end;

  -- Na propria pasta pode.
  insert into storage.objects (bucket_id, name)
    values ('avatars', '00000000-0000-4000-8000-0000000000e1/2.jpg');

  -- Apagar a foto de outra pessoa nao apaga nada. Dois jeitos de dar certo: o
  -- RLS devolve 0 linhas, ou o Supabase recusa o comando antes (42501). A
  -- segunda e a `protect_objects_delete`, que a plataforma passou a instalar
  -- depois deste teste ser escrito: um gatilho POR COMANDO que barra todo
  -- `delete` direto em storage.objects, mesmo sem linha visivel.
  begin
    delete from storage.objects where name = '00000000-0000-4000-8000-0000000000b1/1.jpg';
    get diagnostics n = row_count;
    assert n = 0, 'consegui apagar a foto da bia';
  exception
    when insufficient_privilege then null;
  end;

  -- list_friends: a foto segue a mesma regra do Storage.
  select * into r from public.list_friends() where handle = 'zzt_bia';
  assert r.avatar_path = '00000000-0000-4000-8000-0000000000b1/1.jpg', 'bia (aceita): devia vir a foto';
  assert r.since is not null, 'bia: devia vir o since';

  select * into r from public.list_friends() where handle = 'zzt_carla';
  assert r.avatar_path is not null, 'carla (me pediu): devia vir a foto';

  select * into r from public.list_friends() where handle = 'zzt_duda';
  assert found and r.avatar_path is null, 'duda (eu pedi, ela nao aceitou): a foto devia vir nula';
  assert r.display_name is null, 'duda (eu pedi, ela nao aceitou): o nome devia vir nulo';

  -- O nome segue a regra da foto: aceita, ou pedido recebido.
  select * into r from public.list_friends() where handle = 'zzt_bia';
  assert r.display_name = 'Bia Teste', format('bia (aceita): esperava o nome, veio %s', r.display_name);

  select * into r from public.list_friends() where handle = 'zzt_carla';
  assert r.display_name = 'Carla Teste', 'carla (me pediu): devia vir o nome';

  select id into r from public.friend_weekly_days('2026-09-13', '2026-09-27') where handle = 'zzt_bia';
  assert r.id = '00000000-0000-4000-8000-0000000000b1', 'friend_weekly_days devia trazer o id';

  select id into r from public.friend_monthly_distance('2026-09-01', '2026-09-30') where handle = 'zzt_bia';
  assert r.id = '00000000-0000-4000-8000-0000000000b1', 'friend_monthly_distance devia trazer o id';
end
$$;

reset role;

-- ---------------------------------------------------- vendo como a duda
-- Eu pedi a duda: ela ve a minha foto para decidir se aceita.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  assert exists (
    select 1 from storage.objects where name = '00000000-0000-4000-8000-0000000000e1/1.jpg'
  ), 'duda recebeu meu pedido: devia ver a minha foto';

  assert not exists (
    select 1 from storage.objects where name = '00000000-0000-4000-8000-0000000000b1/1.jpg'
  ), 'duda nao tem relacao com a bia: nao devia ver a foto dela';

  -- A carla pediu a MIM. O pedido dela libera a foto so para quem recebeu —
  -- nao para qualquer pessoa, so porque existe um pedido pendente dela.
  assert not exists (
    select 1 from storage.objects where name = '00000000-0000-4000-8000-0000000000c1/1.jpg'
  ), 'o pedido da carla foi para mim: a duda nao devia ver a foto dela';
end
$$;

reset role;

-- --------------------------------------------------------------- anonimo
set local role anon;

do $$
begin
  assert not exists (select 1 from storage.objects where bucket_id = 'avatars'),
    'anon nao devia ver foto nenhuma';
end
$$;

reset role;

select 'ok' as resultado;

rollback;

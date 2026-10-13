-- Teste das feature flags (v14): tabela `gym_flags` e regras de RLS.
--
-- Cole no SQL Editor DEPOIS do schema.sql e rode. Tudo dentro de `begin …
-- rollback`: nada fica no banco. Qualquer `assert` que falhar aborta com a
-- mensagem do caso; chegar ao `select 'ok'` e passar.

begin;

-- Garante que as academias de teste existem
insert into public.gyms (id, name) values ('zztx', 'Academia Teste')
on conflict (id) do nothing;

-- 1. Insercao de flags como superusuario / equipe
insert into public.gym_flags (gym_id, key, enabled)
values
  ('padrao', 'suggested_workouts', true),
  ('padrao', 'experimental_timer', false),
  ('zztx', 'suggested_workouts', false)
on conflict (gym_id, key) do update
  set enabled = excluded.enabled, updated_at = now();

-- 2. FK check: academia inexistente deve ser recusada
do $$
begin
  insert into public.gym_flags (gym_id, key, enabled)
  values ('inexistente', 'flag_teste', true);
  raise exception 'deveria ter recusado gym_id inexistente';
exception
  when foreign_key_violation then null;
end $$;

-- 3. Leitura e tentativa de escrita como ANON
set local role anon;

do $$
declare
  n int;
begin
  select count(*) into n from public.gym_flags where gym_id = 'padrao';
  assert n = 2, format('anon devia enxergar 2 flags no padrao; viu %s', n);

  select count(*) into n from public.gym_flags
   where gym_id = 'zztx' and key = 'suggested_workouts' and enabled = false;
  assert n = 1, format('anon devia enxergar a flag desligada no zztx; viu %s', n);

  -- Anon nao pode inserir
  begin
    insert into public.gym_flags (gym_id, key, enabled) values ('padrao', 'hacker', true);
    raise exception 'anon conseguiu inserir flag';
  exception
    when insufficient_privilege then null;
  end;

  -- Anon nao pode alterar
  begin
    update public.gym_flags set enabled = false where gym_id = 'padrao';
    raise exception 'anon conseguiu atualizar flag';
  exception
    when insufficient_privilege then null;
  end;

  -- Anon nao pode deletar
  begin
    delete from public.gym_flags where gym_id = 'padrao';
    raise exception 'anon conseguiu deletar flag';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- 4. Leitura e tentativa de escrita como AUTHENTICATED
-- Volta ao papel do SQL Editor: como anon, o insert em auth.users seria recusado.
reset role;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000f1', 'aluno@teste.voluma')
on conflict (id) do nothing;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  n int;
begin
  select count(*) into n from public.gym_flags where gym_id = 'padrao';
  assert n = 2, format('authenticated devia enxergar 2 flags no padrao; viu %s', n);

  -- Authenticated nao pode inserir
  begin
    insert into public.gym_flags (gym_id, key, enabled) values ('padrao', 'hacker', true);
    raise exception 'authenticated conseguiu inserir flag';
  exception
    when insufficient_privilege then null;
  end;

  -- Authenticated nao pode alterar
  begin
    update public.gym_flags set enabled = false where gym_id = 'padrao';
    raise exception 'authenticated conseguiu atualizar flag';
  exception
    when insufficient_privilege then null;
  end;

  -- Authenticated nao pode deletar
  begin
    delete from public.gym_flags where gym_id = 'padrao';
    raise exception 'authenticated conseguiu deletar flag';
  exception
    when insufficient_privilege then null;
  end;
end $$;

select 'ok' as resultado;

rollback;

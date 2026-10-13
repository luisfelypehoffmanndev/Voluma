-- Teste dos treinos sugeridos (v15): tabelas, RLS e gatilho de propagacao.
--
-- Cole no SQL Editor DEPOIS do schema.sql e rode. Tudo dentro de `begin …
-- rollback`: nada fica no banco. Qualquer `assert` que falhar aborta com a
-- mensagem do caso; chegar ao `select 'ok'` e passar.

begin;

-- Garante academia de teste
insert into public.gyms (id, name) values ('zztx', 'Academia Teste')
on conflict (id) do nothing;

-- Cria usuario de teste
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'aluno@teste.voluma')
on conflict (id) do nothing;

do $$
declare
  u        constant uuid := '00000000-0000-4000-8000-0000000000e1';
  p_id     constant uuid := '00000000-0000-4000-8000-000000000101';
  pe_id    constant uuid := '00000000-0000-4000-8000-000000000102';
  ex_id    constant uuid := '00000000-0000-4000-8000-000000000103';
  r_vinc   constant uuid := '00000000-0000-4000-8000-000000000104';
  re_vinc  constant uuid := '00000000-0000-4000-8000-000000000105';
  r_desv   constant uuid := '00000000-0000-4000-8000-000000000106';
  re_desv  constant uuid := '00000000-0000-4000-8000-000000000107';
  pe_agach constant uuid := '00000000-0000-4000-8000-000000000108';
  pe_rem   constant uuid := '00000000-0000-4000-8000-000000000109';
  ex_rem   constant uuid := '00000000-0000-4000-8000-000000000110';
  r record;
  n int;
begin
  -- 1. Equipe cria a ficha com um exercicio
  insert into public.gym_presets (id, gym_id, name, position)
  values (p_id, 'zztx', 'Treino A', 0);

  insert into public.gym_preset_exercises
    (id, preset_id, gym_id, movement_slug, name, position, target_sets, target_reps)
  values
    (pe_id, p_id, 'zztx', 'bench-press', 'Supino reto', 0, 3, 10);

  -- 2. Aluno: exercicios, rotina vinculada e rotina que ja foi desvinculada
  --    (o preset_id da rotina foi limpo, mas o exercicio ainda guarda o
  --    preset_exercise_id — e o caso que o gatilho NAO pode tocar)
  insert into public.exercises (id, user_id, gym_id, name)
  values
    (ex_id, u, 'zztx', 'Supino Reto'),
    (ex_rem, u, 'zztx', 'Remada Cúrvada');

  insert into public.routines (id, user_id, gym_id, name, weekday, preset_id)
  values
    (r_vinc, u, 'zztx', 'Treino A', 1, p_id),
    (r_desv, u, 'zztx', 'Meu treino', 3, null);

  insert into public.routine_exercises
    (id, user_id, gym_id, routine_id, exercise_id, position, target_sets, target_reps, preset_exercise_id)
  values
    (re_vinc, u, 'zztx', r_vinc, ex_id, 0, 3, 10, pe_id),
    (re_desv, u, 'zztx', r_desv, ex_id, 0, 3, 12, pe_id);

  -- 3. Instrutor muda para 4x8: so a rotina vinculada acompanha
  update public.gym_preset_exercises
     set target_sets = 4, target_reps = 8, updated_at = now()
   where id = pe_id;

  select target_sets, target_reps into r from public.routine_exercises where id = re_vinc;
  assert r.target_sets = 4 and r.target_reps = 8,
    format('rotina vinculada devia ir para 4x8; ficou %sx%s', r.target_sets, r.target_reps);

  select target_sets, target_reps into r from public.routine_exercises where id = re_desv;
  assert r.target_sets = 3 and r.target_reps = 12,
    format('rotina desvinculada nao devia mudar; ficou %sx%s', r.target_sets, r.target_reps);

  -- 4. Instrutor adiciona um exercicio que o aluno nao tem: cria o exercicio
  --    e poe na rotina vinculada, nao na desvinculada
  insert into public.gym_preset_exercises
    (id, preset_id, gym_id, movement_slug, name, muscle_group, position, target_sets, target_reps)
  values
    (pe_agach, p_id, 'zztx', 'squat', 'Agachamento livre', 'Pernas', 1, 5, 5);

  select re.position, re.target_sets, re.target_reps, e.name, e.muscle_group into r
    from public.routine_exercises re
    join public.exercises e on e.id = re.exercise_id
   where re.routine_id = r_vinc and re.preset_exercise_id = pe_agach and re.deleted_at is null;
  assert r.name = 'Agachamento livre' and r.muscle_group = 'Pernas'
     and r.position = 1 and r.target_sets = 5 and r.target_reps = 5,
    format('exercicio novo devia entrar na rotina vinculada; veio %s', r);

  select count(*) into n from public.routine_exercises
   where routine_id = r_desv and deleted_at is null;
  assert n = 1, format('rotina desvinculada nao devia ganhar exercicio; tem %s', n);

  -- 5. Exercicio novo que o aluno ja tem (nome com caixa/acento diferentes):
  --    reaproveita, sem criar outro
  insert into public.gym_preset_exercises
    (id, preset_id, gym_id, movement_slug, name, position)
  values
    (pe_rem, p_id, 'zztx', 'barbell-row', 'remada curvada', 2);

  select count(*) into n from public.routine_exercises
   where routine_id = r_vinc and preset_exercise_id = pe_rem
     and exercise_id = ex_rem and deleted_at is null;
  assert n = 1, 'devia reaproveitar a "Remada Cúrvada" do aluno';

  select count(*) into n from public.exercises
   where user_id = u and public.exercise_name_key(name) = 'remada curvada';
  assert n = 1, format('nao devia criar outra remada; existem %s', n);

  -- 6. Soft delete na ficha: sai da rotina vinculada
  update public.gym_preset_exercises
     set deleted_at = now(), updated_at = now()
   where id = pe_agach;

  select count(*) into n from public.routine_exercises
   where routine_id = r_vinc and preset_exercise_id = pe_agach and deleted_at is null;
  assert n = 0, 'soft delete na ficha devia tirar o exercicio da rotina vinculada';

  -- 7. Restaurar o soft delete: volta para a rotina vinculada
  update public.gym_preset_exercises
     set deleted_at = null, updated_at = now()
   where id = pe_agach;

  select count(*) into n from public.routine_exercises
   where routine_id = r_vinc and preset_exercise_id = pe_agach and deleted_at is null;
  assert n = 1, 'restaurar na ficha devia devolver o exercicio a rotina vinculada';

  -- 8. Delete de verdade: propaga mesmo com a FK zerando o vinculo
  delete from public.gym_preset_exercises where id = pe_id;

  select deleted_at into r from public.routine_exercises where id = re_vinc;
  assert r.deleted_at is not null, 'delete na ficha devia apagar o exercicio da rotina vinculada';

  select deleted_at, preset_exercise_id into r from public.routine_exercises where id = re_desv;
  assert r.deleted_at is null, 'delete na ficha nao devia apagar da rotina desvinculada';
  assert r.preset_exercise_id is null, 'a FK devia zerar o vinculo da rotina desvinculada';
end $$;

-- 9. RLS como ANON e AUTHENTICATED: so leitura
set local role anon;

do $$
declare
  n int;
begin
  select count(*) into n from public.gym_presets where gym_id = 'zztx';
  assert n = 1, format('anon devia enxergar 1 preset; viu %s', n);

  begin
    insert into public.gym_presets (gym_id, name) values ('zztx', 'Invasor');
    raise exception 'anon conseguiu inserir preset';
  exception
    when insufficient_privilege then null;
  end;

  begin
    delete from public.gym_preset_exercises where gym_id = 'zztx';
    raise exception 'anon conseguiu apagar exercicio da ficha';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  n int;
begin
  select count(*) into n from public.gym_preset_exercises where gym_id = 'zztx';
  assert n = 2, format('authenticated devia enxergar 2 exercicios da ficha; viu %s', n);

  begin
    update public.gym_presets set name = 'Hacked' where gym_id = 'zztx';
    raise exception 'authenticated conseguiu alterar preset';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.gym_preset_exercises set target_sets = 99 where gym_id = 'zztx';
    raise exception 'authenticated conseguiu alterar exercicio da ficha';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;

select 'ok' as resultado;

rollback;

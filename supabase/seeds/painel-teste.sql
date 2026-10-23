-- Dados de mentira na academia `teste`, para experimentar o painel e os planos
-- com o backend de verdade. Desfaz com painel-teste-limpar.sql.
--
-- Os alunos sao contas falsas (@painel.voluma), com perfil, treinos proprios e
-- historico. Os treinos e planos sao criados pelas RPCs do painel, como admin
-- da `teste` (a conta que ja e admin dela).

begin;

-- Alunos
insert into auth.users (id, email)
select ('00000000-0000-4000-8000-0000000ee0' || lpad(g::text, 2, '0'))::uuid, 'aluno' || lpad(g::text, 2, '0') || '@painel.voluma'
  from generate_series(1, 10) g
on conflict (id) do nothing;

insert into public.profiles (id, gym_id, handle, display_name)
select ('00000000-0000-4000-8000-0000000ee0' || lpad(n::text, 2, '0'))::uuid, 'teste', h, d
  from (values (1, 'ana.souza', 'Ana Souza'), (2, 'brunolima', 'Bruno Lima'), (3, 'carla.m', 'Carla Mendes'),
               (4, 'diegorocha', 'Diego Rocha'), (5, 'eva.m', 'Eva Martins'), (6, 'felipec', 'Felipe Costa'),
               (7, 'gabif', 'Gabi Ferreira'), (8, 'henrique.a', 'Henrique Alves'), (9, 'isanog', 'Isa Nogueira'),
               (10, 'jp.santos', 'João Pedro')) v(n, h, d)
on conflict do nothing;

-- Treinos proprios (conflitos para a atribuicao) e historico
do $$
declare
  u   uuid;
  ex  uuid;
  rid uuid;
  sid uuid;
  ago int;
  plano record;
begin
  -- aluno, dia, nome do dia, exercicio
  for plano in
    select * from (values
      (4, 1, 'Meu push', 'Supino reto'), (4, 3, 'Costas', 'Barra fixa'),
      (5, 2, 'Funcional', 'Agachamento livre'), (6, 5, 'Pernas', 'Leg press'),
      (9, 1, 'Treino da Isa', 'Rosca direta')) v(n, wd, dia, exercicio)
  loop
    u := ('00000000-0000-4000-8000-0000000ee0' || lpad(plano.n::text, 2, '0'))::uuid;
    ex := public.ensure_student_exercise(u, 'teste', plano.exercicio, null, 'strength');
    rid := gen_random_uuid();
    insert into public.routines (id, user_id, gym_id, name, weekday, updated_at)
    values (rid, u, 'teste', plano.dia, plano.wd, now() - interval '5 days');
    insert into public.routine_exercises (id, user_id, gym_id, routine_id, exercise_id, position, target_sets, target_reps, updated_at)
    values (gen_random_uuid(), u, 'teste', rid, ex, 0, 3, 10, now() - interval '5 days');
  end loop;

  -- Frequencia: dias atras em que cada aluno treinou (serie feita com carga)
  for plano in
    select * from (values
      (1, array[1, 3, 5, 8, 10, 12, 15, 17, 19, 22]), (2, array[2, 4, 9, 11, 16, 23]),
      (3, array[1, 2, 4, 6, 8, 9, 11, 13, 15, 16, 18, 20]), (4, array[3, 10, 17]), (5, array[21, 25]),
      (6, array[1, 5, 12]), (8, array[2, 3, 6, 9, 13, 14, 20, 27]), (9, array[4, 11, 18, 25]),
      (10, array[1, 2, 3, 8, 9, 10])) v(n, dias)
  loop
    u := ('00000000-0000-4000-8000-0000000ee0' || lpad(plano.n::text, 2, '0'))::uuid;
    ex := public.ensure_student_exercise(u, 'teste', 'Supino reto', 'Peito', 'strength');
    foreach ago in array plano.dias loop
      sid := gen_random_uuid();
      insert into public.sessions (id, user_id, gym_id, date, started_at, finished_at, updated_at)
      values (sid, u, 'teste', current_date - ago, now() - make_interval(days => ago), now() - make_interval(days => ago), now());
      insert into public.session_sets (id, user_id, gym_id, session_id, exercise_id, set_index, reps, weight_kg, done, updated_at)
      values (gen_random_uuid(), u, 'teste', sid, ex, 1, 10, 40 + ago, true, now());
    end loop;
  end loop;
end $$;

-- Treinos e planos, pelo painel (como o admin da `teste`)
select set_config('request.jwt.claims', '{"sub":"9f0cc84b-c3b7-4abc-b919-df02d6a70cb3","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  aluno  constant text := '00000000-0000-4000-8000-0000000ee0';
  ta uuid; tb uuid; tc uuid; p1 uuid; p2 uuid;
  rec record;
begin
  ta := public.staff_upsert_preset('teste', '{"name": "Treino A · Peito e tríceps", "exercises": [
    {"movement_slug": "bench-press", "name": "Supino reto", "muscle_group": "Peito", "sets": 4, "reps": 8},
    {"movement_slug": "incline-dumbbell-press", "name": "Supino inclinado com halteres", "muscle_group": "Peito", "sets": 3, "reps": 10},
    {"movement_slug": "triceps-pushdown", "name": "Tríceps corda", "muscle_group": "Tríceps", "sets": 3, "reps": 12}]}');
  tb := public.staff_upsert_preset('teste', '{"name": "Treino B · Costas e bíceps", "exercises": [
    {"movement_slug": "lat-pulldown", "name": "Puxada alta", "muscle_group": "Costas", "sets": 4, "reps": 10},
    {"movement_slug": "barbell-row", "name": "Remada curvada", "muscle_group": "Costas", "sets": 4, "reps": 8},
    {"movement_slug": "barbell-curl", "name": "Rosca direta", "muscle_group": "Bíceps", "sets": 3, "reps": 12}]}');
  tc := public.staff_upsert_preset('teste', '{"name": "Treino C · Pernas", "exercises": [
    {"movement_slug": "squat", "name": "Agachamento livre", "muscle_group": "Pernas", "sets": 4, "reps": 8},
    {"movement_slug": "leg-press", "name": "Leg press", "muscle_group": "Pernas", "sets": 3, "reps": 12},
    {"movement_slug": "romanian-deadlift", "name": "Stiff", "muscle_group": "Posterior", "sets": 3, "reps": 10}]}');

  select plan_id into p1 from public.staff_upsert_plan('teste', jsonb_build_object(
    'name', 'Hipertrofia ABC', 'open_to_students', true, 'days', jsonb_build_array(
      jsonb_build_object('weekday', 1, 'preset_id', ta),
      jsonb_build_object('weekday', 3, 'preset_id', tb),
      jsonb_build_object('weekday', 5, 'preset_id', tc))));
  select plan_id into p2 from public.staff_upsert_plan('teste', jsonb_build_object(
    'name', 'Iniciante AB', 'days', jsonb_build_array(
      jsonb_build_object('weekday', 2, 'preset_id', ta),
      jsonb_build_object('weekday', 4, 'preset_id', tc))));

  -- Ana, Bruno e Carla no Hipertrofia; Henrique no Iniciante
  perform * from public.staff_assign_plan('teste', p1, array[(aluno || '01')::uuid, (aluno || '02')::uuid, (aluno || '03')::uuid], dry_run => false);
  perform * from public.staff_assign_plan('teste', p2, array[(aluno || '08')::uuid], dry_run => false);

  -- A Carla com uma excecao: Agachamento 5x5 so para ela
  perform public.staff_customize_day('teste', (aluno || '03')::uuid, 5::smallint, (
    select jsonb_agg(jsonb_build_object('routine_exercise_id', re.id, 'name', e.name,
             'sets', case when e.name = 'Agachamento livre' then 5 else re.target_sets end,
             'reps', case when e.name = 'Agachamento livre' then 5 else re.target_reps end) order by re.position)
      from public.routine_exercises re
      join public.exercises e on e.id = re.exercise_id
      join public.routines r on r.id = re.routine_id
     where r.user_id = (aluno || '03')::uuid and r.gym_id = 'teste' and r.weekday = 5
       and r.deleted_at is null and re.deleted_at is null));

  -- O Felipe tem um dia prescrito fora de plano
  perform public.staff_set_day('teste', (aluno || '06')::uuid, 2::smallint, 'Mobilidade',
    '[{"name": "Prancha", "sets": 3, "reps": 30}]');
end $$;
reset role;

-- O Bruno editou a quarta no app: aquele dia sai do plano ("parcial")
update public.routines set preset_id = null, updated_at = clock_timestamp()
 where user_id = '00000000-0000-4000-8000-0000000ee002' and gym_id = 'teste' and weekday = 3 and deleted_at is null;

commit;

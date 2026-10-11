-- Teste do relogio do servidor (v13): o `synced_at` e o gatilho `sync_stamp`.
--
-- Cole no SQL Editor DEPOIS do schema.sql e rode. Tudo dentro de `begin …
-- rollback`: nada fica no banco. Qualquer `assert` que falhar aborta com a
-- mensagem do caso; chegar ao `select 'ok'` e passar.
--
-- Os upserts sao os mesmos que o PostgREST manda no push
-- (`insert … on conflict (id) do update … returning`), feitos como o dono da
-- linha, com o RLS valendo.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'eu@teste.voluma');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  eu constant uuid := '00000000-0000-4000-8000-0000000000e1';
  serie constant uuid := '00000000-0000-4000-8000-0000000005e1';
  outra constant uuid := '00000000-0000-4000-8000-0000000005e2';
  sessao constant uuid := '00000000-0000-4000-8000-0000000005a1';
  exercicio constant uuid := '00000000-0000-4000-8000-0000000005b1';
  carimbo timestamptz;
  r record;
  n int;
  voltaram int[];
begin
  -- Insert: o servidor carimba, mesmo que o aparelho mande outro valor.
  insert into public.session_sets
    (id, user_id, session_id, exercise_id, set_index, reps, weight_kg, done, updated_at, synced_at)
  values (serie, eu, sessao, exercicio, 1, 10, 50, true, '2026-10-10 11:00+00', '2000-01-01 00:00+00');
  select synced_at into carimbo from public.session_sets where id = serie;
  assert carimbo > '2026-01-01', format('o servidor devia carimbar o insert; ficou %s', carimbo);

  -- Versao MAIS VELHA (10h < 11h): recusada, fora do retorno, linha intacta.
  insert into public.session_sets
    (id, user_id, session_id, exercise_id, set_index, reps, weight_kg, done, updated_at)
  values (serie, eu, sessao, exercicio, 1, 99, 99, true, '2026-10-10 10:00+00')
  on conflict (id) do update
    set reps = excluded.reps, weight_kg = excluded.weight_kg, updated_at = excluded.updated_at;
  get diagnostics n = row_count;
  assert n = 0, format('a versao velha devia ser recusada; gravou %s linha(s)', n);
  select * into r from public.session_sets where id = serie;
  assert r.reps = 10 and r.updated_at = '2026-10-10 11:00+00' and r.synced_at = carimbo,
    format('a versao velha mexeu na linha: reps %s, updated_at %s', r.reps, r.updated_at);

  -- Versao MAIS NOVA (12h): grava e o carimbo avanca.
  insert into public.session_sets
    (id, user_id, session_id, exercise_id, set_index, reps, weight_kg, done, updated_at)
  values (serie, eu, sessao, exercicio, 1, 12, 60, true, '2026-10-10 12:00+00')
  on conflict (id) do update
    set reps = excluded.reps, weight_kg = excluded.weight_kg, updated_at = excluded.updated_at;
  select * into r from public.session_sets where id = serie;
  assert r.reps = 12 and r.synced_at > carimbo, 'a versao nova devia gravar e avancar o carimbo';

  -- A MESMA versao de novo: grava (reenviar e inofensivo).
  insert into public.session_sets
    (id, user_id, session_id, exercise_id, set_index, reps, weight_kg, done, updated_at)
  values (serie, eu, sessao, exercicio, 1, 12, 60, true, '2026-10-10 12:00+00')
  on conflict (id) do update set updated_at = excluded.updated_at;
  get diagnostics n = row_count;
  assert n = 1, 'reenviar a mesma versao devia ser aceito';

  -- Lote misto, como um push de 500 linhas: so a nova volta no RETURNING. E
  -- por esse retorno que o app descobre quais foram recusadas.
  insert into public.session_sets
    (id, user_id, session_id, exercise_id, set_index, reps, weight_kg, done, updated_at)
  values (outra, eu, sessao, exercicio, 2, 10, 50, true, '2026-10-10 11:00+00');

  with gravadas as (
    insert into public.session_sets
      (id, user_id, session_id, exercise_id, set_index, reps, weight_kg, done, updated_at)
    values
      (serie, eu, sessao, exercicio, 1, 1, 1, true, '2026-10-10 09:00+00'),
      (outra, eu, sessao, exercicio, 2, 20, 70, true, '2026-10-10 13:00+00')
    on conflict (id) do update
      set reps = excluded.reps, weight_kg = excluded.weight_kg, updated_at = excluded.updated_at
    returning set_index
  )
  select array_agg(set_index order by set_index) into voltaram from gravadas;
  assert voltaram = array[2], format('no lote misto so a serie 2 devia voltar; voltou %s', voltaram);

  -- Um UPDATE direto (outro caminho de escrita) tambem passa pelo gatilho.
  update public.session_sets set reps = 5, updated_at = '2026-10-10 08:00+00' where id = outra;
  get diagnostics n = row_count;
  assert n = 0, 'um update com versao velha tambem devia ser recusado';
end
$$;

reset role;

-- As sete tabelas do sync tem a coluna, o gatilho e o indice do pull.
do $$
declare
  alvo text;
begin
  foreach alvo in array array[
    'exercises', 'routines', 'routine_exercises', 'week_targets',
    'sessions', 'session_sets', 'body_weight_logs'
  ] loop
    assert exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = alvo and column_name = 'synced_at'
    ), format('%s sem synced_at', alvo);
    assert exists (
      select 1 from pg_trigger where tgrelid = ('public.' || alvo)::regclass and tgname = 'sync_stamp'
    ), format('%s sem o gatilho sync_stamp', alvo);
    assert exists (
      select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_' || alvo || '_synced'
    ), format('%s sem o indice do pull', alvo);
  end loop;
end
$$;

select 'ok' as resultado;

rollback;

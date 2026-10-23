-- Desfaz o painel-teste.sql: apaga os alunos falsos (o cascade leva perfil,
-- treinos e historico deles) e tira os treinos e planos criados pelo seed.
begin;

delete from auth.users where email like '%@painel.voluma';

select set_config('request.jwt.claims', '{"sub":"9f0cc84b-c3b7-4abc-b919-df02d6a70cb3","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  r record;
begin
  for r in select id from public.gym_plans where gym_id = 'teste' and deleted_at is null
            and name in ('Hipertrofia ABC', 'Iniciante AB') loop
    perform public.staff_delete_plan('teste', r.id);
  end loop;
  for r in select id from public.gym_presets where gym_id = 'teste' and deleted_at is null
            and name in ('Treino A · Peito e tríceps', 'Treino B · Costas e bíceps', 'Treino C · Pernas') loop
    perform public.staff_delete_preset('teste', r.id);
  end loop;
end $$;
reset role;

commit;

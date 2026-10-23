# 20 — Planos da academia (programa da semana)

**Depende de:** [18](18-painel-admin.md), [19](19-painel-web.md)
**Estado:** **20.1 a 20.5 feitas** (2026-10-23).
- **Backend:** v18 no Supabase (`v18_planos_academia`). Antes de aplicar, a v18 e o `20-planos.sql` passaram num ensaio na produção dentro de `rollback`. O hash das 13 funções é igual ao do banco local, e os 9 testes SQL passam no runner local.
- **Painel:** aba Planos, editor dos treinos, alunos do plano, adicionar com prévia, e personalizar ou voltar ao plano na tela do aluno.
- **App:** migração v8, pull dos planos e "Seguir plano".
- **Testes:** Jest com 661 e Vitest com 17, todos passando.

**Falta:** a 20.6, o teste no aparelho e no painel logado.

Desvios do desenho abaixo:
- `staff_plan_members` e `day_has_exceptions` foram acrescentadas para a tela do plano.
- O app marca dias de plano como **PLANO**, com um texto genérico; o nome do plano aparece só no painel.
- O lote de atribuição vai em pedaços de 200 alunos. Medido localmente: 100 alunos × 3 dias × 6 exercícios levam 0,17 s.

## Contexto

O painel (plano 19) mostra os alunos, mas a academia ainda não tem como dizer "esta turma faz este programa". Hoje existem fichas sugeridas, mas cada uma é **um treino de um dia** (`gym_presets`). Só o aluno adota uma ficha, pelo app, e qualquer edição do instrutor num aluno tira o dia da ficha (`staff_set_day`).

O pedido: uma aba **Planos** no painel. Nela o instrutor monta um programa, põe os alunos que quiser e continua podendo mudar o treino de uma pessoa específica. Também aplica o plano em vários alunos de uma vez, filtrando por critérios.

### Decisões (23/10/2026)

1. **Um plano é um programa da semana:** "Hipertrofia iniciante" = Treino A na segunda, B na quarta, C na sexta. Cada treino é uma ficha (`gym_presets`), que já tem editor, propagação e testes.
2. **Personalizar um aluno não o tira do plano.** Ele continua recebendo as mudanças, menos no que foi mudado só para ele. Exemplo: Ana faz Leg press no lugar do Agachamento e o resto acompanha o plano.
3. **Conflito ao atribuir:** a prévia mostra quem já tem treino em cada dia, e o instrutor decide, por aluno e por dia, se substitui ou pula.
4. **O aluno continua escolhendo no app** os planos marcados como abertos, como as fichas de hoje.

### O que já existe e é reaproveitado

| Peça | Onde | Uso aqui |
|---|---|---|
| Ficha = treino de um dia, propagação para quem está vinculado | `gym_presets`, `gym_preset_exercises`, gatilho `propagate_preset_exercise_changes` (v15/v16) | o treino de cada dia do plano |
| Editor de ficha | `staff_upsert_preset` / `staff_delete_preset` (v16) | editar os treinos do plano |
| Achar ou criar o exercício do aluno | `ensure_student_exercise` (v16) | atribuir o plano |
| Filtro de alunos | `staff_find_students` (v16) | escolher quem entra no plano |
| Adoção de ficha no app | `adoptPresetIntoDay`, `src/db/repo.ts:788` | modelo para o aluno adotar um plano |
| Desvínculo quando o aluno edita | `unlinkRoutineIfLinked`, `src/db/repo.ts:347` | passa a limpar também o plano |
| Pull das fichas | `src/sync/presets.ts` | também puxa os planos |

## Modelo

**Uma ideia central: quem está no plano se lê das rotinas do aluno, e não de uma tabela de membros.** Cada rotina ganha `plan_id`. O aluno está no plano P se tem rotinas vivas com `plan_id = P`. Com isso:
- o app adota um plano offline (grava `plan_id` local e sobe no sync, como hoje);
- quando o aluno edita um dia, só aquele dia sai do plano (fica "parcial: 2 de 3 dias");
- não existe tabela de membros para ficar dessincronizada.

```sql
-- --------------------------------------------- v18: planos da academia
create table public.gym_plans (
  id          uuid primary key default gen_random_uuid(),
  gym_id      text not null references public.gyms (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  open_to_students boolean not null default false,   -- aparece no app para escolher
  position    int not null default 0,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Um dia do plano aponta para um treino (ficha). Sem linha = descanso.
create table public.gym_plan_days (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references public.gym_plans (id) on delete cascade,
  gym_id     text not null references public.gyms (id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),
  preset_id  uuid not null references public.gym_presets (id),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index on public.gym_plan_days (plan_id, weekday) where deleted_at is null;

-- O dia do aluno sabe de qual plano veio (sem FK, pelo mesmo motivo do prescribed_by).
alter table public.routines add column if not exists plan_id uuid;

-- Excecao do instrutor para UM aluno: series e reps proprias que a ficha nao sobrescreve.
alter table public.routine_exercises add column if not exists custom_targets boolean not null default false;
```

**RLS:**
- `gym_plans` e `gym_plan_days`: leitura para a equipe da academia (`my_staff_gyms()`), para qualquer um quando `open_to_students`, e para o aluno que tem rotina com aquele `plan_id`. Assim o app mostra o nome do plano mesmo quando ele é fechado.
- Escrita só por RPC, como na v16.

### Exceções por aluno, em cima do que a v15 já faz

O gatilho das fichas já atualiza só as linhas ligadas (`preset_exercise_id`) e nunca recria uma linha que foi apagada. Então três dos quatro tipos de exceção já funcionam:

| Exceção | Como fica | O gatilho |
|---|---|---|
| Tirar um exercício só da Ana | soft delete da linha dela | não recria (já é assim) |
| Exercício a mais só para a Ana | linha sem `preset_exercise_id` | não toca (já é assim) |
| Trocar Agachamento por Leg press | as duas acima juntas | idem |
| Séries e reps próprias | `custom_targets = true` na linha | **muda:** pula `target_sets`/`target_reps` dessas linhas. Posição e remoção continuam propagando |

"Com exceções" se calcula assim: o aluno tem linha com `custom_targets`, ou linha sem `preset_exercise_id`, ou linha de ficha apagada enquanto o exercício continua vivo na ficha.

### RPCs novas (todas `staff_*`, no padrão da v16)

O padrão da v16: `security definer`, `require_staff` na primeira linha, marcador `voluma.staff_write`, `staff_stamp` e uma linha no `prescription_log`.

- **`staff_upsert_plan(gym, plan jsonb)`:** nome, aberto ou não, e os dias `{weekday → preset_id}`. Mudar o treino de um dia propaga para os alunos que ainda seguem aquele dia do plano. Dia novo entra só em quem tem o dia vazio; os outros voltam em `skipped`. Dia tirado do plano desvincula o dia dos alunos, que ficam com os exercícios como dia prescrito (`prescribed_by`). Devolve as contagens.
- **`staff_delete_plan(gym, plan)`:** igual a apagar ficha (v16). Desvincula antes e ninguém perde o treino.
- **`staff_assign_plan(gym, plan, students uuid[], replace jsonb, dry_run)`:**
  - **Prévia** (`dry_run`): uma linha por aluno e dia do plano, com `current` = `empty`, `same_plan`, `own`, `instructor`, `other_plan` ou `preset`, mais o nome do treino atual.
  - **Aplicar:** dias vazios entram sempre; `same_plan` é ignorado; os conflitos só são substituídos se o par `{user_id, weekday}` estiver em `replace`, os outros ficam como estão.
  - **Substituir um dia** segue o `adoptPresetIntoDay` no servidor: soft delete das linhas do dia, insere as da ficha com `ensure_student_exercise` e grava `preset_id`, `plan_id` e o nome da ficha. O `week_targets` não é tocado (o guarda proíbe): os ajustes velhos ficam presos às linhas apagadas e ficam inertes.
- **`staff_remove_from_plan(gym, plan, students)`:** os dias dele saem do plano e ficam como dia prescrito (`prescribed_by`), com os exercícios que tinham.
- **`staff_customize_day(gym, student, weekday, items jsonb, expected_updated_at)`:** o editor de um dia que está num plano. É o mesmo formato do `staff_set_day`, mas **mantém** `preset_id` e `plan_id`. Séries e reps diferentes da ficha → `custom_targets`; item novo → linha sem vínculo; item ausente → soft delete. O `staff_set_day` continua para dias fora de plano.
- **`staff_reset_day(gym, student, weekday)`:** "Voltar ao plano". Refaz o dia a partir da ficha e apaga as exceções.
- **`staff_find_students`** ganha o filtro `plan` (num plano, ou `sem plano`) e as colunas `plan_ids` e `customized_days`.

O lote de trocar exercício e de ajustar volume continua pulando dias de ficha, agora também os de plano. Eles mudam pela ficha (`include_presets`), e a propagação respeita o `custom_targets`.

## Painel (`web/`)

- **Aba Planos**, ao lado de Alunos:
  - **Lista:** nome, a semana resumida (`Seg A · Qua B · Sex C`), número de alunos e se está aberto no app.
  - **Plano:**
    - **Semana:** para cada dia, escolher um treino ou deixar descanso.
    - **Treinos:** o editor de ficha, que é o `staff_upsert_preset`.
    - **Alunos:** a tabela de quem está no plano, com status "em dia", "com exceções" ou "parcial: 2 de 3", e as ações remover e personalizar.
  - **Adicionar alunos:** os mesmos filtros da tela Alunos, mais "sem plano" e "em outro plano". Marca todos os filtrados ou um a um. A prévia mostra os conflitos por aluno e dia, com "substituir/pular" em cada um e "substituir todos" e "pular todos". Aplicar usa exatamente a lista da prévia.
- **Aluno:** cada dia ganha **Personalizar** (`staff_customize_day` no dia de plano, `staff_set_day` fora dele) e **Voltar ao plano** quando há exceções. A coluna mostra "Plano X · com exceções".
- O passo 3 do plano 19 (editor do dia) entra aqui.

## App

- **Migração v8 do SQLite:** `routines.plan_id`, `routine_exercises.custom_targets`, e `local_gym_plans` / `local_gym_plan_days` (cache, como `local_gym_presets`).
- **`src/sync/presets.ts`:** também puxa planos e dias abertos, ou do aluno.
- **`src/db/repo.ts`:**
  - `adoptPlan(planId, replaceWeekdays)` reaproveita `adoptPresetIntoDay` em cada dia e grava `plan_id`;
  - `unlinkRoutineIfLinked` também zera `plan_id`.
- **Tela de fichas (`app/presets.tsx`):** ganha "Planos". Escolher um plano mostra os dias que vão ser substituídos e pede confirmação, como a adoção de hoje.
- **Plano e dia:** a marca passa a ser o nome do plano ("Hipertrofia iniciante") em vez de SUGERIDO. O aviso de desvincular cita o plano.

## Etapas e skills

| Etapa | O que | Skills |
|---|---|---|
| 20.1 | v18: tabelas, RLS, `custom_targets` no gatilho, RPCs, `staff_find_students` | `supabase`, `supabase-postgres-best-practices` |
| 20.2 | Teste `20-planos.sql` (runner local, depois ensaio com rollback e aplicar na produção, com confirmação) | `supabase`, `testing-patterns` |
| 20.3 | Painel: aba Planos, editor da semana, alunos do plano, adicionar com filtros e prévia | `frontend-design`, `react-best-practices`, `meu-projeto-conventions` |
| 20.4 | Painel: personalizar e voltar ao plano na tela do aluno | `frontend-design`, `react-best-practices` |
| 20.5 | App: v8, pull, adotar plano, marca e aviso | `react-native-architecture`, `testing-patterns`, `jest-skill` |
| 20.6 | Teste no aparelho (app `teste` + painel) | — |

## Verificação

- **`supabase/tests/20-planos.sql`** (no `supabase/tests/local/run.sh` e no ensaio com rollback na produção). Casos:
  1. Montar plano A/B/C.
  2. Atribuir a 3 alunos: um com a semana vazia, um com treino próprio na quarta, um em outro plano.
  3. A prévia classifica cada dia certo.
  4. Aplicar com `replace` parcial: só os pares listados mudam.
  5. Mudar séries da ficha propaga, menos na linha `custom_targets`.
  6. Exceções da Ana sobrevivem a edição da ficha; tirar um exercício da ficha tira dela também.
  7. `staff_reset_day` limpa as exceções.
  8. Tirar um dia do plano deixa o dia prescrito nos alunos; tirar o aluno do plano idem.
  9. O aluno editando no app (`plan_id` e `preset_id` nulos) faz o dia sair do plano e aparecer como "parcial".
  10. Plano fechado não aparece para `anon`; plano do aluno aparece para ele.
  11. Equipe de outra academia recebe `42501` em tudo; o histórico fica intacto (md5).
  12. Os testes 16.6, 17, 18 e 18.1 continuam passando.
- **Vitest (painel):** resumo da semana, status do aluno no plano e a montagem do `replace` a partir das escolhas da prévia.
- **Jest (app):** `adoptPlan` com SQLite real (como `src/db/__tests__/presets.test.ts`), `unlinkRoutineIfLinked` zerando `plan_id`, e o render da tela de fichas com a seção Planos.
- **No aparelho:**
  1. Montar um plano no painel e atribuir a você.
  2. Ver a semana chegar no app `teste`.
  3. Personalizar um exercício pelo painel e ver no app.
  4. Mudar a ficha no painel: o resto acompanha, a exceção fica.
  5. Editar no app: o dia sai do plano, e o painel mostra "parcial".

> Implementar depende de pedido explícito. A aprovação cobre só registrar este plano como `plans/20-planos.md`.

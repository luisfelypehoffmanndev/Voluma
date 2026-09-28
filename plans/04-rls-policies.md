# 04 — RLS: `auth.uid()` por linha e falta de `TO authenticated`

**Arquivo:** `supabase/schema.sql:132-150` (bloco `do $$` que cria `own_rows`)
**Severidade:** performance na escala multiusuário
**Estado:** **feito** — schema atualizado e rodado no Supabase em 2026-09-17

## Problema

A policy criada para as 7 tabelas é:

```sql
create policy own_rows on public.%I
   for all
   using (auth.uid() = user_id)
   with check (auth.uid() = user_id)
```

Duas coisas:

**1. `auth.uid()` é reavaliado por linha.** Envolvido numa subquery escalar,
`(select auth.uid())`, o Postgres o promove a InitPlan e avalia uma vez por
query em vez de uma vez por linha. É a recomendação da própria documentação de
performance de RLS do Supabase.

Hoje, com um usuário, não se nota. Na escala da academia — `session_sets`
crescendo uma linha por série, de cada treino, de cada pessoa — passa a pesar em
todo `select`.

**2. Falta a cláusula `TO authenticated`.** Como está, a policy também é
avaliada para o role `anon`. **Não é brecha**: com `anon`, `auth.uid()` é null,
`null = user_id` resulta em NULL, e NULL não é verdadeiro, então nega. Mas
declarar o role é o padrão documentado e evita avaliar a policy à toa em request
anônimo.

## Correção

Uma mudança só, no `format()` dentro do loop — vale para as 7 tabelas de uma vez:

```sql
create policy own_rows on public.%I
   for all
   to authenticated
   using ((select auth.uid()) = user_id)
   with check ((select auth.uid()) = user_id)
```

O bloco já faz `drop policy if exists` antes de criar, então continua
idempotente: rodar de novo não quebra nada.

## Passo de deploy

**Mudar o `.sql` no repositório não altera o banco.** Depois da edição:

1. Rodar `supabase/schema.sql` inteiro no SQL Editor do projeto.
2. Conferir que as policies `own_rows` foram recriadas com `to authenticated`.
3. Rodar os advisors (`supabase db advisors` ou o painel) e confirmar que não
   aparece aviso novo de RLS.

## Verificar

- Com dois usuários de teste, confirmar que nenhum enxerga dado do outro
  (`select` devolve só as próprias linhas).
- Confirmar que o sync do app continua funcionando normalmente — push e pull —
  depois da troca de policy.

# 11 — Perfil público: @handle, idade e anos de treino

**Arquivos:** `src/domain/handle.ts`, `src/sync/profile.ts`, `src/store/profile.ts`,
`app/profile-setup.tsx`, `app/(tabs)/profile.tsx`, `app/login.tsx`,
`supabase/schema.sql` (novos e alterados)
**Estado:** **feito** — v5 rodada, RLS confirmado, testado no aparelho

## Contexto da decisão

O app vai ganhar uma camada social (amigos, e comparação de estatísticas entre
eles). Duas fundações precisam existir antes, e nenhuma existe hoje:

1. **Um identificador público e estável.** O app só conhece o `email` da sessão
   Google (`applySession`, `src/sync/auth.ts`). E-mail não serve como chave
   social: expor num fluxo de "adicionar amigo" vaza dado sensível e deixa
   qualquer um testar se uma pessoa tem conta. Daí o **@handle**, que a pessoa
   escolhe justamente para ser público.
2. **Idade e anos de treino**, que dão contexto à comparação.

**Perfil vive só no Supabase e exige login.** Não entra no SQLite, não entra em
`SYNCED_TABLES` nem no `outbox`, e não toca `src/sync/engine.ts`. Quem usa o app
sem login não tem perfil — e não perde nada, porque esses dados só existem para
serem mostrados a amigos, e quem não entra não tem amigos. É o que mantém a
superfície pequena: uma tabela, nenhuma migration local, zero mudança no sync.

**"Anos de treino" é campo estático**, perguntado uma vez, não uma métrica
derivada do uso do app. Quem já treinava antes de instalar o Voluma tem anos que
o app nunca viu.

A busca por handle **não** entra aqui: é da etapa de amigos. A policy desta
página ("cada um lê só o próprio perfil") basta para tudo que estas etapas
fazem, e construir a busca agora seria código sem consumidor. O caminho dela já
está decidido em [`../DECISIONS.md`](../DECISIONS.md): função `security definer`
de match exato, nunca `select` aberto em `profiles`.

## 11.1 — `normalizeHandle(input)`

`src/domain/handle.ts`. Reduz qualquer entrada — nome vindo do Google, ou o que
a pessoa digitou — ao alfabeto do handle: minúsculas, sem acento, só
`[a-z0-9._]`. Espaço vira ponto; o resto é descartado.

| Entrada | Esperado |
|---|---|
| `"LuisFelype"` | `"luisfelype"` |
| `"  luis  "` | `"luis"` |
| `"Luís Felype"` | `"luis.felype"` |
| `"luis@felype!"` | `"luisfelype"` |
| `"@luisfelype"` | `"luisfelype"` — o `@` é adorno de exibição, não faz parte do dado |
| `"луис"` | `""` — sem alfabeto latino não sobra nada; `isValidHandle` reprova |
| `"a  b"` | `"a.b"` — espaços seguidos não viram pontos seguidos |

## 11.2 — `isValidHandle(handle)`

Espelha em TypeScript o mesmo `^[a-z0-9._]{3,20}$` que o banco tem como `check`.
Recebe handle **já normalizado** — não normaliza por dentro, senão a tela
aceitaria o que o banco recusa.

| Entrada | Esperado |
|---|---|
| `"lu"` | `false` — curto demais |
| `"luis"` | `true` |
| `"a".repeat(20)` | `true` — o teto é inclusivo |
| `"a".repeat(21)` | `false` |
| `"Luis"` | `false` — maiúscula já devia ter saído na normalização |
| `"luis felype"` | `false` |
| `""` | `false` |

**Teste de guarda:** todo resultado de `normalizeHandle` com 3 a 20 caracteres
passa em `isValidHandle`. Quem afrouxar uma das duas sem mexer na outra quebra o
teste aqui — em vez de quebrar no `insert`, com erro de constraint na cara de
quem está tentando entrar.

## 11.3 — `handleCandidates(displayName, email)`

A fila de tentativas do primeiro login. O client não consulta se o handle está
livre antes de gravar: ele tenta gravar e deixa o índice único do banco decidir
(ver 11.4). Esta função só decide **em que ordem** tentar.

| Entrada | Esperado |
|---|---|
| `("Luis Felype Hoffmann", …)` | começa em `"luis.felype"` — dois primeiros nomes |
| `("", "luisfelype@gmail.com")` | começa em `"luisfelype"` — a parte local do e-mail |
| `("", "")` | fallback não vazio e válido |
| `("луис", "луис@x.com")` | fallback — nada sobrou da normalização |
| qualquer | candidatos 2..n são o primeiro com sufixo `2`, `3`, … |
| `("Lu", …)` | primeiro candidato válido, nunca com menos de 3 caracteres |
| nome de 30 caracteres | truncado para caber em 20 **com** o sufixo |

O último caso é a armadilha: truncar em 20 e só então colar o sufixo produz 21
caracteres, que o banco recusa — e recusa no pior momento, no primeiro login.

## 11.4 — Modelo no Supabase (`-- v5: perfil`)

Anexado ao fim de `supabase/schema.sql`, que é colado inteiro no SQL Editor mais
de uma vez e por isso precisa continuar idempotente.

```sql
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  handle         text not null check (handle ~ '^[a-z0-9._]{3,20}$'),
  age            int check (age is null or age between 13 and 120),
  training_years int check (training_years is null or training_years between 0 and 80),
  updated_at     timestamptz not null default now()
);

create unique index if not exists idx_profiles_handle
  on public.profiles (lower(handle));
```

Três decisões que não são estilo:

- **Os `check` vão inline no `create table`**, não em `alter table add
  constraint` depois: o Postgres não aceita `add constraint if not exists`, e a
  segunda execução do arquivo abortaria. É o mesmo motivo das seções v3 e v4
  usarem `add column if not exists`.
- **O índice único é sobre `lower(handle)`**, não sobre `handle`. O client já
  grava normalizado, mas é o índice que garante que `luis` e `LUIS` não
  coexistam se o client algum dia errar.
- **`profiles` tem `id` como PK referenciando `auth.users`, e não uma coluna
  `user_id`.** Por isso **não entra no array do loop `do $$`** que cria a policy
  `own_rows` nas outras sete tabelas — precisa do bloco próprio:

```sql
alter table public.profiles enable row level security;

drop policy if exists own_profile on public.profiles;
create policy own_profile on public.profiles
  for all
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
```

Mesmas razões do item [04](04-rls-policies.md) para `(select auth.uid())` e
`to authenticated`.

**A reserva do handle é do banco, não do client.** "Tenta `luisfelype`, colidiu,
tenta `luisfelype2`" tem corrida entre duas pessoas pedindo o mesmo handle no
mesmo instante — conferir antes de gravar não resolve, só encurta a janela. O
client grava e trata o erro `23505` (unique violation) como "ocupado": no
primeiro login segue para o próximo candidato; na edição manual, vira texto na
tela.

## 11.5 — Dados e estado

`src/sync/profile.ts` — I/O, sem estado:

- `fetchProfile(userId): Promise<Profile | null>`
- `claimHandle(userId, candidates): Promise<Profile>` — tenta em ordem, `23505`
  passa para o próximo.
- `updateProfile(userId, patch): Promise<Profile | 'handle-taken'>`

`src/store/profile.ts` — store zustand novo, irmão de `useAuth` e não uma
extensão dele: `useAuth` já carrega conta **e** sincronização, e perfil é um
terceiro assunto.

Esta é a **primeira exceção** à regra "nenhuma tela consulta o Supabase
diretamente" (`README.md`). É justificada — perfil é dado social, não existe no
SQLite, não tem o que fazer offline — mas precisa estar escrita lá, senão vira
precedente silencioso.

`applySession` (`src/sync/auth.ts`) passa a carregar o perfil ao entrar e
limpá-lo ao sair. `signOut()` já apaga o banco local; sem limpar este store, o
handle de uma conta fica visível para a próxima.

## 11.6 — Telas

- **`app/profile-setup.tsx`** (nova): handle pré-preenchido com o primeiro
  candidato que o banco aceitou; idade e anos de treino em dois `Stepper`
  (`layout="row"`), com os mesmos limites dos `check`. Os dois números são
  opcionais e a tela tem como sair sem preencher — senão vira muro entre o login
  e o app, que é exatamente o que a arquitetura "login opcional" evita.
- **`app/login.tsx`**: no sucesso, vai para o setup quando não há perfil; segue
  com `router.back()` quando há.
- **`app/(tabs)/profile.tsx`**: `Card` novo, só com `status === 'signedIn'`,
  mostrando `@handle` + idade/anos e levando à edição. É também o que resgata
  **quem já está logado hoje** e não tem handle: essa pessoa não passa mais pelo
  login, então o card precisa funcionar como porta de entrada.

Restrições de design que valem aqui: sem cor de estado (handle ocupado é texto,
como o erro em `app/login.tsx`), sem toggle redondo, copy direta, e **nenhum
accent novo** — o único da tela continua sendo a `CheckCell` de vibração.

## Verificar

- `npm run typecheck` limpo.
- `npm test` — os 197 testes atuais passando, mais os novos.
- Conferir que os testes de 11.1/11.2 **falham** se o regex do TypeScript
  divergir do `check` do SQL — os dois são a mesma regra escrita duas vezes, e é
  o teste de guarda que os mantém juntos.
- Rodar `supabase/schema.sql` **duas vezes seguidas** no SQL Editor: a segunda
  não pode falhar.
- Com duas contas de teste: A não enxerga o perfil de B (`select` devolve lista
  vazia, não erro), e gravar o handle de A na conta B devolve `23505`.
- No dev client: primeiro login leva ao setup; entrar de novo não leva; "Sair" e
  entrar com outra conta não mostra o handle anterior.

# 12 — Amigos e o toggle de compartilhamento

**Arquivos:** `src/domain/friends.ts`, `src/sync/friends.ts`,
`src/store/friends.ts`, `app/friends.tsx`, `app/(tabs)/profile.tsx`,
`supabase/schema.sql` (novos e alterados)
**Depende de:** [11](11-perfil-handle.md) — o @handle é a chave de busca
**Estado:** **feito** — v6 rodada, RLS confirmado; pendente validação em duas contas físicas

## Contexto da decisão

O item 11 deu a cada pessoa um @handle público. Este item usa esse handle para
o que ele existia: encontrar alguém, pedir amizade, e — só com os dois
consentimentos — deixar que essa pessoa veja seus números.

A regra que organiza tudo: **nada de uma pessoa aparece para outra sem dois
consentimentos**, a amizade aceita *e* o toggle ligado. Um só não basta.

Decisões fechadas antes de escrever qualquer linha:

- **Toggle desligado por padrão.** Opt-in. Nada é compartilhado até alguém
  escolher compartilhar. É o que combina com o resto do app — login opcional,
  nada criado às escondidas. O custo é a feature parecer vazia no começo, e
  isso se resolve com texto no card, não afrouxando o padrão.
- **Aceite obrigatório**, nunca adição direta: monitorar o treino de alguém sem
  essa pessoa saber não pode ser possível.
- **Busca por handle é sempre match exato.** Nunca substring nem autocomplete —
  senão a tela vira um diretório pesquisável da academia inteira.
- **O toggle é um só** e cobre estatísticas, idade e anos de treino juntos.
  Permissão por campo multiplica a superfície de decisão e a de bug de
  privacidade. Identidade (@handle) fica **fora** dele: é o que permite
  reconhecer a pessoa, não um dado de treino.

## 12.1 — `splitFriends(rows, meId)`

`src/domain/friends.ts`. Recebe as linhas que a RPC devolve e separa nas três
listas que a tela desenha. É o que decide **qual botão cada linha mostra** —
aceitar/recusar num pedido recebido, cancelar num enviado.

| Entrada | Esperado |
|---|---|
| `[]` | as três listas vazias |
| aceita | entra em `accepted`, em nenhuma outra |
| `pending` em que eu sou `addressee` | `incoming` — é meu para aceitar |
| `pending` em que eu sou `requester` | `outgoing` — só me resta cancelar |
| duas aceitas fora de ordem | `accepted` ordenado por handle |
| handles com acento (`ana`, `ánia`, `bia`) | ordem alfabética correta, não por code point |
| mesma pessoa em duas listas | impossível por construção: uma linha cai em uma lista só |

## 12.2 — `rankByFrequency(rows)`

Ordena amigos por dias treinados na semana. Usado no item 13, mas mora aqui
porque é regra de amizade, não de gráfico.

| Entrada | Esperado |
|---|---|
| `[]` | `[]` |
| dias diferentes | maior primeiro |
| empate em dias | desempate por handle, para a ordem não pular entre duas leituras iguais |
| quem não compartilha (`days === null`) | vai para o fim, sem virar zero — "não compartilha" não é "não treinou" |

O último caso é a armadilha: tratar ausência de dado como zero colocaria quem
não compartilha em último lugar como se tivesse ficado parado a semana toda.

## 12.3 — Modelo no Supabase (`-- v6: amigos`)

Anexado ao fim de `supabase/schema.sql`, que é colado inteiro mais de uma vez e
por isso **tem que continuar idempotente** — foi a armadilha da v5.

```sql
create table if not exists public.friendships (
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status       text not null check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create unique index if not exists idx_friendship_pair on public.friendships (
  least(requester_id::text, addressee_id::text),
  greatest(requester_id::text, addressee_id::text)
);
```

O índice sobre o par ordenado é o que impede `A→B` e `B→A` coexistirem: sem
ele, duas pessoas que se pedem ao mesmo tempo viram duas amizades entre as
mesmas duas pessoas, e a tela mostra a outra duas vezes.

O toggle entra no perfil que já existe:

```sql
alter table public.profiles
  add column if not exists shares_stats boolean not null default false;
```

**Quatro policies, não uma `for all`** — aqui cada verbo tem dono diferente,
porque quem pede não é quem aceita:

| Verbo | Quem pode | Por quê |
|---|---|---|
| `select` | os dois lados | cada um precisa ver a relação |
| `insert` | só o `requester`, e só como `pending` | ninguém cria amizade já aceita |
| `update` | só o `addressee` | aceitar é do destinatário |
| `delete` | os dois lados | recusar, cancelar e desfazer são a mesma operação |

Mesmas razões do item [04](04-rls-policies.md) para `(select auth.uid())` e
`to authenticated`.

## 12.4 — As RPCs

A policy de `profiles` é "cada um lê só o seu". Ler o @handle de um amigo exige
sair disso, e a escolha do repo é **função `security definer`, nunca afrouxar o
RLS de uma tabela de dados** — abrir `profiles` para leitura ampla exporia todo
mundo a todo mundo.

- `find_profile_by_handle(target)` — match exato, devolve só `id` e `handle`.
- `request_friendship(target_handle)` — resolve o handle e grava `pending`.
  Devolve um código (`ok`, `not-found`, `already`, `self`), não exceção crua.
- `list_friends()` — cada relação do usuário com `handle`, `status`,
  `direction`, `shares_stats`, e **`age`/`training_years` só quando
  `shares_stats` é verdadeiro**. O filtro é no SQL: se fosse no cliente, o dado
  já teria saído do servidor.

Todas com `revoke execute from public, anon`, `grant execute to authenticated` e
`set search_path = public`.

## 12.5 — Cliente e telas

`src/sync/friends.ts` (I/O) e `src/store/friends.ts` (estado), no molde de
`profile.ts`. O store é ligado em `applySession` e **limpo no `signOut`** —
mesma armadilha do item 11: sem `clear()`, a lista de amigos de uma conta fica
na tela para a próxima pessoa que entrar no aparelho.

`useQuery` **não** serve como está para dado de rede: `bumpData()` invalida tudo
globalmente, então marcar uma série no treino refaria a consulta de amigos.

Telas: `app/friends.tsx` (campo de @handle no molde do `ProfileForm`, pedidos,
lista) e dois cards novos no Perfil — "Amigos" e o toggle como `CheckCell`
(§7 proíbe toggle redondo). Recusar e desfazer são baratos de reverter → padrão
`UndoToast`, não `ConfirmModal` (ver `src/ui/UndoToast.tsx`).

### Por que o "Desfazer" adia a escrita em vez de invertê-la

O `UndoToast` do treino ("pular hoje") age na hora e, se a pessoa tocar em
"Desfazer", chama a ação inversa. Aqui isso não fecha, porque o RLS do §12.3
proíbe a inversão:

- **Recusar** — o inverso seria recriar o pedido, mas só o `requester` insere,
  e quem recusa é o `addressee`.
- **Desfazer amizade** — o máximo possível seria um pedido novo, que a outra
  pessoa teria que aceitar de novo. Isso é recomeçar, não desfazer.
- **Cancelar pedido** — daria para inverter, mas ter um caso diferente dos
  outros dois só complicaria.

Então a escrita é **adiada**: a linha sai da tela na hora e o `DELETE` só é
enviado quando a janela de `UNDO_WINDOW` (5s, em `src/theme/tokens.ts`) fecha.
"Desfazer" é não mandar nada. O tempo fica no store (`src/store/friends.ts`),
não na tela:

- `pendingRemoval` guarda a linha inteira, para desfazer sem ir ao servidor.
- Uma pendência por vez: tocar num segundo "X" grava o primeiro antes.
- Grava na hora ao sair da tela (unmount) e ao mandar o app para segundo plano
  (`AppState`, ligado só enquanto há algo pendente).
- `load()` no meio da janela filtra a linha pendente, senão ela voltaria.
- Falha ao gravar devolve a linha à tela e mostra o erro.
- `clear()` (sign-out) descarta a pendência **sem** gravar: era intenção de
  quem saiu, não de quem entra depois.
- Aceitar não tem desfazer e vai direto ao servidor.

## Verificar

- `npm run typecheck` limpo, `npm test` com os 255 atuais passando mais os novos
  (**feito**: 295 passando).
- `supabase/schema.sql` rodado **duas vezes seguidas** sem erro (**feito**, 2026-09-22).
- Com a chave anônima: leitura de `friendships` devolve `[]`, escrita é
  rejeitada com `42501` (**feito**, 2026-09-22, via `set local role anon`).
- **Com duas contas reais** — o único teste que vale para RLS: A pede a B, B vê
  e aceita, cada um vê o @ do outro. Com os toggles desligados, **nenhum** vê
  idade, anos de treino ou número. B liga o dele → A vê os números de B, e B
  continua sem ver os de A. Desfazer some dos dois lados depois que a janela
  fecha; tocar em "Desfazer" dentro dela não muda nada no servidor.
- Sair da conta e entrar com outra não mostra os amigos da anterior.

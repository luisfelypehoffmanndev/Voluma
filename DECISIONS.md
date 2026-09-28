# Decisões

Registro de decisões de produto/arquitetura que ainda não viraram código.
Serve pra não perder o contexto de "por que decidimos assim" entre uma
conversa e outra.

## Migração para multiusuário (academia real)

**Data:** 2026-09-16
**Status:** decidido, não implementado

O Voluma vai deixar de ser um app de uso pessoal e passar a ser usado por
várias pessoas numa academia de verdade.

- **Login continua opcional.** Não vamos exigir conta no boot — quem não
  logar continua usando o app 100% local (SQLite), igual hoje. Isso não muda
  com a migração.
- **Login vira só Google, sem conta própria.** O login por e-mail/senha atual
  (`signIn`/`signUp`, `src/sync/auth.ts`, `app/login.tsx`) vai ser
  substituído por OAuth do Google via Supabase. Mais simples e mais seguro:
  sem senha própria pra gerenciar ou vazar.
- **Escopo da primeira etapa é só a troca do método de login.** Identidade
  básica (nome/foto da conta Google no Perfil), lista de amigos por e-mail e
  comparação de estatísticas entre amigos ficam para depois — não fazem parte
  desta etapa.

## Perfil público (@handle, idade, anos de treino)

**Data:** 2026-09-21
**Status:** implementado — ver [`plans/11-perfil-handle.md`](plans/11-perfil-handle.md)

Primeira etapa da camada social. Decisões que valem daqui pra frente:

- **Identificação por @handle, não por e-mail.** E-mail é dado sensível: expor
  num fluxo de "adicionar amigo" vaza informação e deixa qualquer um testar se
  uma pessoa tem conta. O handle é o oposto — a pessoa escolhe justamente para
  ser visto. Isso substitui a ideia anterior de adicionar amigos por e-mail.
- **Perfil vive só no Supabase e exige login.** Não entra no SQLite, no
  `outbox` nem no sync engine. É dado social: não tem o que fazer offline, e
  quem usa o app sem conta não tem a quem mostrar. Uma tabela, nenhuma
  migration local.
- **Unicidade é do banco, não do client.** Índice único sobre `lower(handle)`;
  o cliente grava e trata `23505` como "ocupado". Conferir antes de gravar não
  fecha a corrida entre duas pessoas pedindo o mesmo handle, só encurta.
- **Idade e anos de treino são opcionais**, e "anos de treino" é campo estático
  respondido uma vez — não uma métrica derivada do uso do app. Os dois vão
  atrás do mesmo toggle de compartilhamento das estatísticas, quando ele
  existir; identidade (handle) fica fora do toggle.

## Amigos e o toggle de compartilhamento

**Data:** 2026-09-22
**Status:** implementado, v6 rodada no Supabase e RLS confirmado; falta o
teste com duas contas reais — ver [`plans/12-amigos.md`](plans/12-amigos.md)

A regra que organiza tudo: **nada de uma pessoa aparece para outra sem dois
consentimentos** — a amizade aceita *e* o toggle ligado. Um só não basta.

- **Tabela `friendships`** (`requester_id`, `addressee_id`,
  `status: pending | accepted`), com índice único sobre o par ordenado: `A→B`
  e `B→A` nunca coexistem. Quatro policies, uma por verbo, porque quem pede
  não é quem aceita — só o `requester` insere (e só como `pending`), só o
  `addressee` aceita, os dois lados apagam.
- **Aceite obrigatório**, nunca adição direta: acompanhar o treino de alguém
  sem essa pessoa saber não pode ser possível.
- **Busca por @handle, sempre match exato** — nunca substring ou
  autocomplete, pra não virar diretório pesquisável da academia inteira.
- **RPCs `security definer`, nunca RLS afrouxado.** Ler o @ de um amigo passa
  por `list_friends()`, que devolve idade e anos de treino **só quando o
  toggle do amigo está ligado** — o corte é no SQL, não no cliente.
- **Um toggle só, desligado por padrão.** Cobre estatísticas, idade e anos de
  treino juntos; o @handle fica fora dele, porque é o que permite reconhecer a
  pessoa. Opt-in, como o resto do app.
- **Recusar é apagar, não um status.** Guardar "recusado" deixaria o pedido
  na tabela pra sempre e, pelo índice do par, impediria pedir de novo.
- **Recusar, cancelar e desfazer usam "Desfazer", não "tem certeza?" — e a
  escrita é adiada, não invertida.** O RLS acima impede a inversão: quem
  recusou é o `addressee`, que não pode recriar o pedido; e "desfazer" o fim
  de uma amizade viraria um pedido novo que a outra pessoa teria que aceitar
  de novo. Então a linha some da tela na hora e o `DELETE` só sai do aparelho
  quando a janela de 5s fecha (ou ao sair da tela / mandar o app para segundo
  plano). "Desfazer" é não mandar nada. Quem segura o tempo é o store
  (`src/store/friends.ts`), não a tela.

## Comparação de estatísticas entre amigos

**Data:** 2026-09-16 (atualizado em 2026-09-28)
**Status:** implementado — ranking da semana, 12 semanas, consistência e
corrida; ver [`plans/13-ranking-amigos.md`](plans/13-ranking-amigos.md) e
[`plans/14-amigos-graficos.md`](plans/14-amigos-graficos.md)

Mudanças em relação ao rascunho abaixo, decididas em 2026-09-28:

- As RPCs são **`friend_weekly_days(first_week, last_week)`** (dias treinados
  por semana e a meta da rotina) e **`friend_monthly_distance`** (km no mês),
  uma chamada para todos os amigos aceitos — e não
  `friend_weekly_volume(friend_id)`, uma por amigo, devolvendo volume. A
  métrica decidida é frequência, e volume por dia seria mais dado do que os
  gráficos precisam.
- **Consistência** usa como meta os dias com treino no Plano de cada um: nada
  novo para configurar, e compara constância, não quantidade.
- A UI é um **terceiro segmento "Amigos" no Histórico**, e não uma seção no
  painel de Números. Você entra no ranking junto com os amigos.

Rascunho original:

- **Ranking por frequência, não por carga.** Comparar volume ou carga absoluta
  entre pessoas de níveis diferentes desmotiva em vez de motivar; dias
  treinados é comparável entre iniciante e avançado. Peso corporal e carga
  ficam visíveis no perfil individual, nunca em gráfico lado a lado. A
  ordenação já existe como função pura (`rankByFrequency`, em
  `src/domain/friends.ts`): quem não compartilha vai para o fim sem virar zero.
- A comparação em si **não** abre RLS das tabelas de treino pros amigos —
  isso exporia dado demais e complicaria a política de acesso. Em vez disso,
  uma função `security definer` (`friend_weekly_volume(friend_id)`) confere
  se a amizade está aceita **e o toggle ligado** e devolve só o agregado
  (volume por dia), nunca a linha crua.
- UI: uma seção nova no painel de Números comparando com cada amigo aceito,
  buscada ao vivo (sem entrar no SQLite local — é dado social, só faz sentido
  com rede).

Zero mudança no sync engine existente (`src/sync/engine.ts`), nenhuma tabela
de treino ganha exposição a terceiros.

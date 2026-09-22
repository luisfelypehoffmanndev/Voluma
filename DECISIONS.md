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

## Amigos e comparação de estatísticas (ideia, não iniciado)

**Data:** 2026-09-16 (atualizado em 2026-09-21)
**Status:** rascunho de abordagem, não implementado

Conexão entre usuários pra comparar evolução na aba de Estatísticas, com
pedido e aceite. Abordagem proposta, mantendo o app simples:

- Uma tabela nova no Supabase, `friendships` (`requester_id`, `addressee_id`,
  `status: pending | accepted`), com RLS liberando cada linha só pros dois
  lados do relacionamento.
- Busca por **@handle**, sempre match exato — nunca substring ou autocomplete,
  pra não virar diretório pesquisável da academia inteira. Via função
  `security definer` devolvendo só `id` e `handle`, em vez de abrir `select`
  em `profiles`.
- **Ranking por frequência, não por carga.** Comparar volume ou carga absoluta
  entre pessoas de níveis diferentes desmotiva em vez de motivar; dias
  treinados é comparável entre iniciante e avançado. Peso corporal e carga
  ficam visíveis no perfil individual, nunca em gráfico lado a lado.
- A comparação em si **não** abre RLS das tabelas de treino pros amigos —
  isso exporia dado demais e complicaria a política de acesso. Em vez disso,
  uma função `security definer` (`friend_weekly_volume(friend_id)`) confere
  se a amizade está aceita e devolve só o agregado (volume por dia), nunca a
  linha crua.
- UI: card "Amigos" no Perfil (convidar por e-mail, aceitar/recusar,
  listar) e uma seção nova no painel de Números comparando com cada amigo
  aceito, buscada ao vivo (sem entrar no SQLite local — é dado social,
  só faz sentido com rede).

Isso mantém a superfície pequena: uma tabela + duas funções RPC, zero mudança
no sync engine existente (`src/sync/engine.ts`), nenhuma tabela de treino
ganha exposição a terceiros.

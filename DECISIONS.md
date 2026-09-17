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

## Amigos e comparação de estatísticas (ideia, não iniciado)

**Data:** 2026-09-16
**Status:** rascunho de abordagem, não implementado

Ideia de conexão entre usuários pra comparar evolução na aba de Estatísticas,
adicionando por e-mail com aceite. Abordagem proposta, mantendo o app simples:

- Uma tabela nova no Supabase, `friendships` (`requester_id`, `addressee_id`,
  `status: pending | accepted`), com RLS liberando cada linha só pros dois
  lados do relacionamento.
- Busca por e-mail via uma função `security definer` (`find_user_by_email`),
  em vez de expor a tabela de usuários no client.
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

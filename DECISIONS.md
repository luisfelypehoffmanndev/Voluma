# Decisões

Registro de decisões de produto/arquitetura que ainda não viraram código.
Serve pra não perder o contexto de "por que decidimos assim" entre uma
conversa e outra.

## Migração para multiusuário (academia real)

**Data:** 2026-09-16 (atualizado em 2026-09-28)
**Status:** implementado — ver planos 07, 11, 12, 13, 14 e 15

O Voluma deixou de ser um app de uso pessoal e passou a suportar
múltiplas pessoas numa academia de verdade.

- **Login continua opcional.** Não é exigida conta no boot — quem não
  loga continua usando o app 100% local (SQLite), igual antes.
- **Login é só Google, sem conta própria.** O login por e-mail/senha foi
  substituído por OAuth do Google via Supabase (`app/login.tsx`, `src/sync/auth.ts`).
- **Camada social completa entregue em etapas:**
  1. Google OAuth (plano 07);
  2. Perfil público com @handle único, idade e anos de treino (plano 11);
  3. Amizades com aceite mútuo e toggle de privacidade (plano 12);
  4. Comparação de frequência semanal, 12 semanas, consistência e corrida (planos 13 e 14);
  5. Foto de perfil, nome de exibição, cor fixa por amigo e redesign dos gráficos (plano 15).

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

## Foto de perfil, nome de exibição, cores por pessoa e redesign dos gráficos

**Data:** 2026-09-28
**Status:** implementado — ver [`plans/15-avatar-e-nomes.md`](plans/15-avatar-e-nomes.md)

Completou a identidade visual da camada social e corrigiu problemas de
legibilidade dos gráficos antigos.

- **Foto de perfil em bucket privado no Supabase Storage (`avatars`)**:
  Fotos são servidas exclusivamente por URLs assinadas temporárias
  (`createSignedUrl`, expiração de 1h). Salvas no padrão
  `{user_id}/{timestamp}.jpg`: a pasta amarra o arquivo ao dono e o timestamp
  força renovação de cache ao trocar de foto. Limite no bucket de 512 KB e tipo
  JPEG; o app reencoda para 256×256 JPEG antes do envio.
- **Regra de visibilidade da foto e do nome no Storage e SQL**:
  Aparecem para o dono, qualquer lado de uma amizade aceita e o destinatário
  de um pedido pendente (quem pede escolheu se mostrar para ser reconhecido).
  Quem não tem relação ou apenas enviou um pedido ainda não aceito não vê a foto.
  Foto e nome são dados de identidade (como o @handle) e **não** dependem do
  toggle de compartilhamento de estatísticas.
- **Nome de exibição (`display_name`)**:
  Inicializado automaticamente com o nome da conta Google no primeiro login e
  editável no formulário de Perfil. Validação no banco de 1 a 40 caracteres
  não-vazios (`btrim(display_name) <> ''`). Na interface, exibe o primeiro nome
  no ranking e detalhe para manter o layout limpo.
- **Cores fixas por amigo (`people` em `tokens.ts`)**:
  Cada amigo recebe uma cor de destaque com glow da paleta `people`, atribuída
  em ordem cronológica de amizade (`since` da RPC `list_friends`). Isso impede
  que amigos troquem de cor quando posições do ranking mudam. O usuário sempre
  usa o `--accent` laranja da marca.
- **Redesign dos gráficos e tela individual do amigo**:
  Os gráficos anteriores (blocos empilhados, tracinhos) foram substituídos por
  componentes semânticos e canônicos: `BarChart` para quantidade por período,
  `LineChart` para evolução com área em degradê, e `HBarList` para proporções.
  Todos possuem números redondos, escala à direita e meses no eixo x.
  No painel Amigos, quatro cards repetitivos deram lugar a um ranking semanal
  único (`FriendsRanking`). O detalhe individual (12 semanas, meta da rotina e
  km de corrida) foi movido para uma tela dedicada `app/friend/[id].tsx`,
  focando na comparação "Você vs Amigo".

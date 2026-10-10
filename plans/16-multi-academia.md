# 16 — Multi-academia: um backend, vários apps

**Arquivos:** `supabase/schema.sql`, `supabase/tests/16-multi-academia.sql`,
`app.json` → `app.config.ts`, `eas.json`, `gyms/<slug>/*`, `gyms/README.md`,
`scripts/publish.mjs`, `src/world.ts` (novo), `src/sync/engine.ts`,
`src/sync/auth.ts`, `src/sync/profile.ts`, `src/sync/friends.ts`,
`src/sync/avatar.ts`, `src/db/schema.ts`, `src/db/repo.ts`,
`src/domain/targets.ts`, `src/domain/presets.ts` (novo), `src/store/flags.ts`
(novo), `src/store/presets.ts` (novo), `src/theme/tokens.ts`, telas do Plano e
do onboarding
**Depende de:** [07](07-login-google.md), [11](11-perfil-handle.md),
[12](12-amigos.md), [15](15-avatar-e-nomes.md)
**Estado:** **16.1 feita** — v11 aplicada no Supabase em 2026-10-09 (pelo MCP), testes 15 e 16 passando lá. 16.2 em diante: planejado

## Contexto da decisão

O Voluma passa a ter vários apps na Play Store: o **app padrão** e um app
**por academia**, vendido com a identidade visual dela e com treinos sugeridos
pelo instrutor. Todos usam **o mesmo Supabase**.

A regra que organiza tudo: **para todos os fins, cada academia é um app
diferente**. Cada app é um **mundo**, e nada atravessa de um mundo para outro:
perfil, @handle, amizades, treinos, plano e peso. A mesma pessoa pode estar em
vários mundos ao mesmo tempo, com dois apps instalados e a mesma conta Google.

O que foi decidido, e por quê:

| Decisão | Motivo |
|---|---|
| Identidade = conta Google + mundo; toda tabela carrega `gym_id` | O caso de dois apps instalados ao mesmo tempo invalidou a ideia de "uma academia por vez" |
| Dentro de um mundo, sem amizade, só dá para **buscar pelo @** | Os números continuam atrás de amizade aceita + toggle, como hoje |
| O vínculo com o mundo **não é verificado** | Envolver a academia (token por aluno) atrapalha a adesão. Quem forjar o mundo só consegue buscar @ e mandar pedidos, que podem ser recusados. Risco aceito conscientemente |
| A amizade pertence ao mundo onde nasceu | Trocar de academia é um recomeço |
| Visual no build; treinos sugeridos e flags no banco | O que pode esperar uma versão nova fica no build; o que é crítico ou muda com frequência fica no banco |
| A equipe mantém tudo; os treinos sugeridos são combinados antes com o instrutor | Sem painel para a academia |
| Treino adotado fica **vinculado** à sugestão. Só **editar o plano** desvincula | Ajustes da semana e da sessão não desvinculam |
| No treino vinculado, **séries e reps vêm do instrutor**, mesmo com histórico; **a carga vem da pessoa** | A Ana com 60 kg recebe o 4×8 do instrutor e continua com 60 kg |
| Um repositório, um arquivo de configuração por academia | Uma correção chega a todos os apps sem merge |
| Tudo o que for possível vai por **OTA** | Correções sem revisão da loja |
| Publicar recebe **só o nome da academia** e deriva o resto | Torna impossível mandar a configuração de uma academia para outra |
| O mundo vem do **package name**, que nenhum OTA altera. O `extra` só confere | Uma publicação errada não muda o mundo de ninguém |

## Ordem e por que esta ordem

```
16.1 servidor ─► 16.2 cliente sabe o mundo ─┐
                 16.3 OTA ──────────────────┴─► release do app padrão
                                                  │ (todo mundo atualizado)
                                                  ▼
                        16.4 variantes ─► 16.5 flags ─► 16.6 sugestões (dados)
                                                          ─► 16.7 sugestões (telas)
                                                          ─► 16.8 primeira academia
```

- **16.1 vem primeiro e é compatível com o app atual.** As colunas novas têm
  default `'padrao'` e as RPCs ganham o parâmetro `gym` com o mesmo default.
  O app que está nos aparelhos hoje continua funcionando sem mudança.
- **16.2 e 16.3 saem juntos numa versão da loja do app padrão.** O 16.2 faz o
  pull filtrar por mundo. O 16.3 coloca o `expo-updates` no build, e daí em
  diante as correções podem ir por OTA.
- **Trava:** nenhum app de academia vai para a loja antes de todos os aparelhos
  do app padrão estarem nessa versão. Um app antigo puxa por `user_id` só, e
  baixaria os treinos de outro mundo da mesma pessoa. Hoje são poucos
  usuários de teste conhecidos, então dá para conferir um por um.

## 16.1 — Servidor: o mundo em todas as tabelas (`-- v11: multi-academia`)

Na mesma linha do resto do `schema.sql`: idempotente, colado no SQL Editor.

- **Tabela `gyms`:** `id text primary key` (slug, `^[a-z0-9-]{2,30}$`),
  `name text`. Uma linha `'padrao'` para o app padrão. `gym_id` nunca é nulo,
  porque `null` não é igual a `null` em índice único nem em `=`.
- **Tabelas de treino** (`exercises`, `routines`, `routine_exercises`,
  `week_targets`, `sessions`, `session_sets`, `body_weight_logs`):
  `gym_id text not null default 'padrao' references gyms`. As linhas atuais
  ficam no `'padrao'` pelo default. Índice do pull passa a ser
  `(user_id, gym_id, updated_at)`. O RLS `own_rows` continua só no `user_id`:
  cada um mexe nos próprios dados em qualquer mundo.
- **`profiles`:** chave vira `(id, gym_id)`. O índice único do handle vira
  `(gym_id, lower(handle))`. A regex de `avatar_path` passa a exigir
  `{user_id}/{gym_id}/{timestamp}.jpg`.
- **`friendships`:** ganha `gym_id`. A chave primária e o índice do par passam a
  incluir o mundo, o que permite uma amizade por mundo para o mesmo par.
- **RPCs** (`find_profile_by_handle`, `request_friendship`, `list_friends`,
  `friend_weekly_days`, `friend_monthly_distance`): parâmetro
  `gym text default 'padrao'`. Filtram `profiles`, `friendships` **e também
  `sessions`, `session_sets` e `routines` pelo mundo**. Sem isso, os dias
  treinados do Bruno no mundo Y entrariam no ranking do mundo X.
- **Storage `avatars`:** as policies conferem também a segunda pasta (o mundo)
  contra a amizade daquele mundo. O formato antigo, sem a pasta do mundo,
  continua valendo no `'padrao'`.
- **Achado de segurança, corrigido junto:** a policy de update de
  `friendships` (v6) conferia quem altera, mas não o quê. Quem recebia um
  pedido podia trocar o `requester_id` e criar uma amizade aceita com uma
  terceira pessoa que nunca aceitou. Confirmado no banco local. Agora o app só
  pode alterar `status` e `updated_at` (permissão por coluna).
- **`gyms`** tem chave estrangeira em todo `gym_id` (um slug errado é
  recusado) e não pode ser lida pelo app.
- **Idempotência:** os índices únicos antigos (handle global na v5, par sem
  mundo na v6) saíram daquelas seções. Senão, colar o arquivo de novo os
  recriaria.

Implementado assim. Verificado num Postgres 18 local com uma imitação do que
o Supabase traz (papéis, `auth.uid()`, `storage.objects`,
`storage.foldername()`): o arquivo aplicado por cima do schema antigo e num
banco novo, duas vezes cada; os testes 15 e 16 passam nos dois. O teste 16
falha, como deve, quando o filtro de mundo do ranking é removido ou quando o
update de `friendships` é liberado de novo.

## 16.2 — Cliente: o app sabe o próprio mundo

- **`src/world.ts`:** `gymFromPackage(applicationId)` é uma função pura
  (`com.luisf.voluma` → `'padrao'`; `com.luisf.voluma.<slug>` → `<slug>`).
  `currentGym()` lê o package via `expo-application` (a instalar). Compara com
  `Constants.expoConfig.extra.gymId`; se divergir, **registra o erro e segue**,
  sem pausar o sync, porque o mundo já veio do package.
- **`engine.ts`:** o push carimba `gym_id` junto com o `user_id` (linha 140).
  O pull filtra `.eq('gym_id', gym)`. O `toLocal` descarta o `gym_id` como já
  faz com o `user_id`. **O SQLite local não muda**: cada instalação é um mundo só.
- **`profile.ts`, `friends.ts`, `avatar.ts`:** todas as leituras, escritas e
  RPCs passam o mundo. O caminho da foto ganha a pasta do mundo.
- **`auth.ts`:** o `redirectTo` do login sai do slug do package
  (`voluma-<slug>://`), e não do `scheme` da config. Uma publicação OTA errada
  também levaria um `scheme` errado, e o login deixaria de voltar para o app.

## 16.3 — OTA (EAS Update)

- Instalar o `expo-updates` e configurar com `eas update:configure`.
- `runtimeVersion` com a policy `fingerprint`: uma atualização que precise de
  código nativo que o build não tem não chega até ele.
- Manter o padrão de abertura (`checkAutomatically: ON_LOAD`,
  `fallbackToCacheTimeout: 0`): o app abre na hora e aplica a atualização na
  abertura seguinte. Esperar o download na abertura trava sem sinal na academia.
- Custo: o EAS Update é pago acima da cota gratuita. Conferir a cota antes de
  passar de poucos apps.

## 16.4 — Variantes: um build por academia

- **`app.json` → `app.config.ts`.** Lê `APP_VARIANT` (padrão `'padrao'`), abre
  `gyms/<slug>/config.json` e monta: `name`, `android.package`
  (`com.luisf.voluma` ou `com.luisf.voluma.<slug>`), `ios.bundleIdentifier`,
  `scheme` (`voluma` ou `voluma-<slug>`), ícone, ícone adaptativo, splash e
  `extra.gymId` / `extra.theme`. O `slug` e o `projectId` do EAS ficam iguais
  para todos.
- **`gyms/padrao/`** recebe a configuração e os arquivos visuais de hoje. Uma
  academia nova é uma pasta nova.
- **`eas.json`:** um perfil por academia com `env.APP_VARIANT` e
  `channel: <slug>`.
- **Tema:** `tokens.ts` monta o `accent` a partir de `extra.theme.accent` na
  carga do módulo, com o laranja atual como valor padrão. O tema é fixo durante
  a execução, então os 66 arquivos que importam os tokens não mudam. Um teste
  valida o accent de cada `gyms/*/config.json`: contraste com o `bg` e com o
  `textOnAccent`. Um accent parecido com a cor de um amigo **não é bloqueado**:
  nos gráficos a foto e o @ ficam ao lado de toda fileira, e a cor nunca é a
  única pista (comentário de `people` em `tokens.ts`).
- **Supabase Auth:** cadastrar `voluma-<slug>://**` nas URLs de redirect a cada
  academia nova.
- **Dia a dia no USB:** trocar de academia exige
  `APP_VARIANT=<slug> npx expo prebuild --clean` antes do `expo run:android`
  (e recriar o `android/local.properties`, como no item 07).

## 16.5 — Feature flags

- **Servidor:** `gym_flags (gym_id, key, enabled, updated_at)`, primary key
  `(gym_id, key)`. Leitura liberada para `anon` e `authenticated`, porque o app
  funciona sem login e flags não são segredo. Escrita só pela equipe, no SQL
  Editor.
- **Cliente:** `src/store/flags.ts` baixa as flags do mundo no boot e no sync,
  guarda no AsyncStorage (mesmo motivo do tour: é configuração do aparelho,
  não dado do usuário) e expõe `useFlag(key)`. Uma flag que nunca foi baixada
  vale **desligada**.

## 16.6 — Treinos sugeridos: dados e regras

- **Servidor:** `gym_presets (id, gym_id, name, position, updated_at,
  deleted_at)` e `gym_preset_exercises (id, preset_id, gym_id, movement_slug,
  position, target_sets, target_reps, target_distance_km,
  target_duration_min, updated_at, deleted_at)`. Leitura para `anon` e
  `authenticated`, escrita só pela equipe. O exercício aponta para o
  `slug` da biblioteca (`src/movements/library.ts`), que existe igual em todo
  aparelho. Na adoção, o app acha o exercício do usuário pelo nome normalizado
  (`findMovement` / `normalizeName`) ou cria.
- **Ligação com o plano:** `routines.preset_id` e
  `routine_exercises.preset_exercise_id` (migration v6 no SQLite e colunas no
  Postgres; os dois sincronizam pelo engine como qualquer coluna).
- **Cache local:** as sugestões do mundo ficam em tabelas locais só de
  leitura, fora da outbox, para funcionar offline.
- **A sugestão não tem dia.** A pessoa coloca a sugestão no dia que quiser.
  Colocar em um dia, ou trocar o dia (`routines.weekday`), **não desvincula**.
  A mesma sugestão pode ir para mais de um dia: cada dia vira uma rotina
  vinculada ao mesmo `preset_id`.
- **Desvincular:** toda função do `repo.ts` que edita os **exercícios** do
  plano (adicionar, remover, trocar ou reordenar exercício, mudar a semente)
  limpa o `preset_id` da rotina. Trocar o dia, as funções da semana
  (`setWeekTarget`) e as da sessão não limpam.
- **Quem reaplica é o servidor.** Um trigger em `gym_preset_exercises`
  (`security definer`) regrava os `routine_exercises` das rotinas que ainda têm
  aquele `preset_id`: atualiza séries, reps e posição, insere os exercícios
  novos e faz soft delete dos que saíram. Ele carimba `updated_at`, e o pull
  normal entrega a mudança em todos os aparelhos. Os ids existentes não mudam,
  porque `week_targets` aponta para eles. Um exercício novo da sugestão precisa
  de um `exercise_id` do usuário: o trigger reaproveita o exercício do usuário
  com o mesmo nome no mundo, ou cria um.
- **Cascata (`resolveTargets`):** no treino vinculado, combina campo a campo:
  séries e reps da semente (a sugestão), carga do histórico. O ajuste da semana
  continua vencendo inteiro naquela semana. Fora do vínculo, nada muda.
- **Corrida conhecida (aceitar ou tratar na 16.6):** a Ana edita o plano
  offline (desvincula) e, antes de ela sincronizar, o instrutor **adiciona** um
  exercício. O trigger insere esse exercício porque, no servidor, a rotina
  ainda está vinculada. Quando a Ana sincroniza, o push dela não apaga a linha
  nova, e o plano que já era dela ganha o exercício do instrutor. É raro e
  dá para a Ana remover o exercício, mas precisa ser uma escolha consciente.

## 16.7 — Treinos sugeridos: telas

- Escolher uma sugestão e o dia (ou os dias) em que ela entra, no onboarding
  do app da academia e no Plano.
- Marca de "sugerido pela academia" no treino vinculado.
- Ao editar os exercícios de um treino vinculado, avisar que ele passa a ser da
  pessoa e para de receber as mudanças do instrutor. Trocar o dia não avisa,
  porque não desvincula.

## 16.8 — Lançar a primeira academia

- Pasta `gyms/<slug>/`, perfil no `eas.json`, linha em `gyms`, sugestões e
  flags no banco.
- Redirect `voluma-<slug>://**` no Supabase Auth.
- Listagem na Play Console.
- `eas build --profile <slug>` e envio para a loja.

## Publicação

- **`scripts/publish.mjs <slug>` e `publish.mjs --all`** são o único caminho
  documentado. O script recebe só o slug, recusa um slug que não tenha pasta em
  `gyms/`, e deriva dele `APP_VARIANT` e o canal antes de chamar
  `eas update`.
- **`gyms/README.md`:** lembra quem for publicar, gente ou IA, de usar o script
  e nunca rodar `eas update` direto.
- **Publicou errado:** `eas update:rollback` no canal da academia. O app não
  tem como desfazer uma atualização sozinho.

## Decisões

Tomadas em 2026-10-09:

1. **(16.6) Quem reaplica a sugestão: o servidor**, com um trigger. Um lugar
   só, sem duplicata entre aparelhos, e chega até para quem não abre o app.
2. **(16.6/16.7) A sugestão não tem dia.** A pessoa coloca nos dias que
   quiser, e isso não conta como personalização.
3. **(16.4) Accent parecido com a cor de um amigo não é problema.** A foto e o
   @ desambiguam. O teste de contraste continua.

Em aberto:

4. **(16.8) Conta da Play Console** das listagens: a sua ou a de cada academia.
   Ainda não existe nenhum setup. Só bloqueia a 16.8.
5. **(16.6) A corrida "desvinculou offline × instrutor adicionou"** (ver
   16.6): aceitar ou tratar.

## Skills por etapa

| Etapa | Skills | Para quê |
|---|---|---|
| Todas | `meu-projeto-conventions` | Convenções do projeto |
| 16.1 | `supabase`, `supabase-postgres-best-practices`, `database-design` | Migração v11, índices, RLS, RPCs |
| 16.1 | `security-audit` | Revisar se nenhuma RPC deixa dados vazarem entre mundos |
| 16.2 | `typescript-expert`, `testing-patterns`, `jest-skill` | `world.ts`, engine e testes puros |
| 16.3 | `expo:expo-overview`, `expo:eas-update` | `expo-updates`, runtimeVersion, canais |
| 16.4 | `expo:expo-overview`, `expo:eas-app-stores` | `app.config.ts`, perfis, assinatura por app |
| 16.4 | `expo:expo-design-system`, `accessibility-compliance-accessibility-audit` | Accent por academia e validação de contraste |
| 16.5 | `zustand-store-ts`, `react-state-management` | `src/store/flags.ts` |
| 16.6 | `supabase`, `supabase-postgres-best-practices`, `testing-patterns` | Tabelas de sugestões, vínculo, cascata campo a campo |
| 16.7 | `frontend-design`, `expo:expo-design-system`, `expo:expo-native-ui`, `accessibility-compliance-accessibility-audit` | Telas de adoção e aviso de desvinculação, seguindo `Design/design.md` |
| 16.8 | `expo:eas-app-stores` | Build e envio da primeira academia |

## Testes

| Onde | O que garante |
|---|---|
| `world.test.ts` | Package → mundo, incluindo o padrão e um package desconhecido |
| `engine` (puro) | O push carimba `gym_id`, o `toLocal` descarta |
| `targets.test.ts` | Cascata campo a campo no vínculo; ajuste da semana vence; fora do vínculo nada muda |
| `presets.test.ts` | Adoção acha ou cria o exercício pelo nome; editar os exercícios do plano desvincula; trocar o dia, o ajuste da semana e a sessão não desvinculam |
| `theme` | Accent de cada `gyms/*/config.json`: contraste com `bg` e `textOnAccent` |
| `publish` | Slug desconhecido é recusado; canal e `APP_VARIANT` saem do mesmo slug |
| `supabase/tests/16-multi-academia.sql` | Busca por @ não cruza mundos; amizade de X não aparece em Y; ranking de X ignora treinos de Y; foto de Y não é lida por amigo de X; chamadas sem `gym` continuam no `'padrao'`; o trigger de sugestão atualiza só rotinas ainda vinculadas, mantém os ids e não toca rotina desvinculada nem de outro mundo |

## Verificar

- `npm run typecheck` limpo e `npm test` passando.
- `supabase/tests/16-multi-academia.sql` colado no SQL Editor devolve `ok`.
- No aparelho, com a mesma conta Google, o app padrão e um app de teste
  (`APP_VARIANT=teste`) instalados juntos: treinos, amigos e @ de um não
  aparecem no outro, e o login de cada um volta para o app certo.
- Publicar no canal errado de propósito (num app de teste): o mundo não muda e
  o erro aparece no log.
- Treino vinculado: mudar a sugestão no banco e conferir que a pessoa recebe as
  novas séries e reps com a carga dela; editar o plano e conferir que a
  próxima mudança não chega mais.

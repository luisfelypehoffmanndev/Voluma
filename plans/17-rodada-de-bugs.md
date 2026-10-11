# 17 — Rodada de bugs

**Arquivos:** `app/+native-intent.tsx` (novo), `src/sync/authCallback.ts`
(novo), `src/ui/navigation.ts` (novo), `src/ui/useWriteBehind.ts` (saiu de
`app/session/[id].tsx`), `src/sync/engine.ts`, `src/sync/auth.ts`,
`src/sync/status.ts` (novo), `src/db/repo.ts`, `src/db/canonical.ts`,
`src/db/client.ts`, `src/store/friends.ts`, `supabase/schema.sql` (v13),
`supabase/tests/17-relogio-do-servidor.sql` (novo) e as telas de login, perfil,
peso, Hoje, amigos, onboarding, dia e treino
**Depende de:** [16](16-multi-academia.md) (o teste da 16.4 no aparelho
mostrou os primeiros)
**Estado:** **feito e verificado no aparelho** (2026-10-10 e 11), v13 no
Supabase. O teste no aparelho achou mais três, já corrigidos (fim da segunda
tabela)

## Contexto

O teste da 16.4 instalou o app `teste` do zero, que é o caminho de todo aluno
de academia: abertura, onboarding, login e perfil. Nesse caminho apareceram
vários bugs pequenos. Depois veio uma segunda varredura, pelo código, atrás de
erros que não aparecem na tela: o sync perdendo linhas e dados mudando sem
aviso.

## Primeira varredura: instalação nova

| Problema | Correção | Commit |
|---|---|---|
| O retorno do Google (`voluma://#access_token=…`) também virava navegação: ia para `/` e tirava o login da pilha. O `back()` do perfil ficava sem destino ("GO_BACK" no aparelho). | O `+native-intent` ignora o retorno do login. Os `back()` que podem rodar sem tela atrás passam por `goBackOr`. | `0485a1a` |
| Uma exceção no login deixava o botão girando para sempre. | `try/catch/finally`, com a mensagem na tela. | `eca9201` |
| Com mudanças pendentes, o Perfil escondia o erro do sync. | "3 mudanças pendentes · Sem conexão". | `eca9201` |
| Toque duplo gravava o peso duas vezes, abria o treino duas vezes e mandava o pedido de amizade duas vezes. | Trava por ref. O peso só fecha a tela depois de gravar. | `2130312` |
| O onboarding e a reordenação do dia falhavam calados. | "Tente de novo"; a ordem volta para a gravada. | `2130312` |
| O voltar do Android, com a pergunta "só hoje / no plano" aberta, fechava o seletor inteiro. | Fecha só a pergunta. | `2130312` |
| "Voluma" fixo nos textos de um app de academia. | `APP_NAME`, da config de cada variante. | `94c6361` |
| Sair apagava os dados do aparelho sem perguntar. | Confirmação, com o número de mudanças que vão se perder. | `94c6361` |
| `expo-doctor` reprovado (12 pacotes atrasados) e tema escuro nativo ausente no Android. | `expo install --fix` + `expo-system-ui`. | `2355ac4` |

## Segunda varredura: sync e dados

| Problema | Correção | Commit |
|---|---|---|
| O pull fazia uma consulta só, e a API corta em 1000 linhas. Um empate de carimbo cortado no limite nunca mais descia (o banco tinha um de 336). | Páginas de 500 por cursor. | `5033cc1` |
| O marcador do pull era o `updated_at`, que vem do relógio do aparelho. Uma edição offline antiga, sincronizada depois, nunca chegava no outro aparelho. E o upsert gravava até versão mais velha por cima. | **v13:** `synced_at` (relógio do servidor) e o gatilho `sync_stamp`, que recusa versão mais velha. O app pagina por ele e adota a versão vencedora. | `de0b95f`, `560bef6`, `1eefbe0` |
| Coluna nova no servidor quebrava o pull de todo app instalado que não a conhecia. Foi o que a v11 fez com os builds anteriores à 16.2. | O pull descarta colunas que o SQLite local não tem. | `560bef6` |
| A sequência e o calendário contavam como dia treinado qualquer sessão aberta. | Uma regra só: série feita com carga (reps × kg > 0). | `8536888` |
| "Ontem" sem conferir o ano. Corrida arredondada para uma casa. O peso de 12 semanas pedia 84 registros, e não 84 dias. | Corrigidos. | `8536888` |
| Desfazer o pulo não remarcava as séries. Escolher um exercício pulado criava um segundo no dia. | O pulo devolve o que desmarcou. Escolher o pulado o traz de volta. | `4e9382e` |
| O `resetDb` do logout rodava fora da fila de transações, e uma escrita já na fila caía depois dele. Respostas de amigos chegando depois do logout reapareciam. | O reset entra na fila. O store de amigos descarta o que chega depois. | `3385860` |
| O primeiro sync subia antes de baixar: o plano e o catálogo do onboarding iam para a conta ao lado dos dela, duplicados. | A conta desce primeiro, e o que só existe no aparelho cede. | `38c0038` |
| Um ajuste de série feito enquanto a marcação ainda gravava ficava só na tela. | A edição segue a escrita em curso (`amend`). | `8cb55ee` |
| **Achado no aparelho:** "Criar plano" no onboarding derrubava o app ("The specified child already has a parent"). O botão primário só tem view nativa enquanto brilha; habilitar de novo no mesmo commit do `router.replace` mudava o `Pressable` de pai com a tela saindo. | A raiz do `Button` é sempre nativa (`collapsable={false}`), e o onboarding não reabilita o botão ao sair. | `d0896d3` |
| **Achado no aparelho:** sem rede, o Perfil continuava só com "N mudanças pendentes". O supabase-js não lança sem rede (o `getUser` devolve `user: null` com o erro), e o ciclo lia isso como "ninguém logado". A `eca9201` só tinha mexido na tela. | Só a falta de sessão é "nada a fazer"; o resto é falha do ciclo. O texto cru do fetch do Android vira "Sem conexão". | `d9be0f3` |
| **Achado no aparelho:** o cartão "Próximos" da Hoje abria com uma linha divisória solta. | A borda fica só entre as linhas. | `c366751` |

## Decisões tomadas no caminho

- **Nome nos textos:** o nome da academia (`APP_NAME`), e não "Voluma".
- **Dia treinado:** pelo menos uma série feita com carga (reps × kg > 0), em
  todo o app.
- **Relógio do servidor:** corrigido agora (v13), e não depois.
- **Login num aparelho com dados do onboarding: o plano da conta vence.** A
  rotina do aparelho num dia que a conta já tem sai, com seus exercícios e
  ajustes, e os treinos feitos nela passam para a rotina da conta. **Extensão
  da decisão:** os exercícios do catálogo com o mesmo nome também cedem, porque
  sem isso o catálogo ficava com tudo duas vezes. Se não for o desejado, dá
  para restringir às rotinas.
- **Instalação que já sincronizava** (tem cursores de pull) não cede nada. A
  outbox dela guarda edições de linhas da conta, e não um plano de fora.

## Não confirmado ou fora do escopo

- **Avisos do Reanimated** ("synchronouslyUpdateUIProps failed … Unable to find
  SurfaceMountingManager"): 12 a 18 por onboarding no teste do aparelho, quando
  se sai da abertura antes de a animação terminar. É só log; fica para depois.
- A engrenagem por cima da seta de voltar é o botão "Tools" do dev client. Não
  existe no build de produção.

## Verificação no aparelho (2026-10-11, Galaxy S24, app `teste`)

Recompilado só para arm64 (`./gradlew app:installDebug
-PreactNativeArchitectures=arm64-v8a --max-workers=8`): o `assembleDebug` das
quatro arquiteturas tinha estourado a memória.

| Item | Resultado |
|---|---|
| Abertura e textos com "Voluma Teste" | ok |
| Onboarding "Montar do zero" e Push/Pull/Legs → "Criar plano" | ok, depois da `d0896d3` (antes, o PPL quebrava) |
| Login volta para o app | ok |
| Sair pede confirmação | ok |
| Primeiro sync, conta com 59 exercícios e sem rotinas | servidor ficou com 59 vivos (antes seriam 118); o plano do aparelho subiu, com os exercícios remapeados |
| Primeiro sync, conta já com seg Push, qua Pull, sex Legs; aparelho com seg Push, ter Pull, qua Legs | seg e qua do aparelho cederam; a ter subiu; o Plano mostra seg Push, ter Pull, qua Pull, sex Legs |
| Voltar com a pergunta "Só hoje / Todo domingo" aberta | fecha só a pergunta |
| Ajuste de peso logo depois de marcar uma série do plano | o banco do aparelho ficou com o peso novo, numa escrita só |
| Pular com série feita e desfazer | a série volta marcada; escolher o pulado no seletor o traz de volta sem duplicar (sem remarcar) |
| Dois toques em "Registrar" no peso | uma linha, e volta uma tela só |
| Modo avião (e Wi-Fi desligado) | "1 mudança pendente · Sem conexão", depois da `d9be0f3` |
| `npx expo-doctor` | 20/21; a checagem do schema precisa de `exp.host`, que não resolvia no ambiente do teste |

Ficaram dados de teste na conta do mundo `teste`: um treino de domingo, a
rotina de domingo com o Afundo e cinco pesagens (75 a 79 kg).

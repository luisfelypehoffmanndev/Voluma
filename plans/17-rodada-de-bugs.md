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
**Estado:** **feito no código** (2026-10-10 e 11), v13 no Supabase. Falta o
teste no aparelho, que exige recompilar o dev client

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

- **Avisos do Reanimated** ("Unable to find SurfaceMountingManager", 176 vezes
  no onboarding): falta reproduzir antes de mexer. É só log.
- A engrenagem por cima da seta de voltar é o botão "Tools" do dev client. Não
  existe no build de produção.

## Como verificar no aparelho

Exige recompilar (dependências novas e fingerprint nova).

1. **App `teste` do zero** (`pm clear com.luisf.voluma.teste`):
   - a abertura mostra "Voluma Teste";
   - o login volta para o app;
   - salvar o perfil leva para Hoje sem "GO_BACK", e "Agora não" também.
2. **Primeiro sync com conta que já tem dados:** no onboarding, montar um plano
   num dia que a conta já tem e entrar. O dia mostra o plano da conta, e o
   catálogo não tem exercício repetido.
3. **App padrão:**
   - Sair pede confirmação;
   - dois toques em Salvar no peso gravam uma linha;
   - com a pergunta "só hoje / no plano" aberta, o voltar fecha só ela.
4. **Treino:**
   - marcar a primeira série de um exercício intocado e mudar o peso dela logo
     em seguida; finalizar, e o histórico mostra o peso novo;
   - pular um exercício com séries feitas e desfazer: elas voltam marcadas.
5. **Modo avião:** marcar uma série. O Perfil mostra "1 mudança pendente · Sem
   conexão".
6. `npx expo-doctor`: 21/21.

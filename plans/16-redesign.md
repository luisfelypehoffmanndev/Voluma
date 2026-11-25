# 16 — Reset visual, rotinas A/B/C e o que falta de treino

**Arquivos:** por onda, listados em cada seção abaixo e no relatório de fim de onda.
**Depende de:** [15](15-avatar-e-nomes.md) e das rodadas de UX (`PROMPT_UX.md`, `PROMPT_UX_2.md`)
**Estado:** **em andamento** — Onda 0

## As ondas, na nova ordem

| Onda | Objetivo em uma linha |
|---|---|
| **0** | Reset da linguagem visual: tokens como sistema, 9 componentes base, a barra com o botão central, e Hoje + Sessão como pilotos no layout final. **Gate de visual.** |
| **1** | O pull passa a ignorar colunas que não conhece, e a migration única cria todas as colunas das ondas 2–7 e a tabela `week_schedule`. Nenhuma mudança de tela. **Sem gate próprio: é entregue junto com a 2.** |
| **2** | Rotinas A/B/C com vínculo: a semana aponta para rotinas, o Plano é redesenhado uma vez só sobre o modelo novo, e a Hoje ganha "trocar só hoje". |
| **3a** | As telas de toda semana na linguagem nova: Progresso (Calendário · Números · Peso) e resultado. O Plano já veio na 2. |
| **3b** | O resto: Perfil (com Amigos e sem o peso), catálogo, biblioteca, amigos, amigo, login e configuração do perfil. |
| **3c** | Tour e onboarding no visual novo. Se ficar pequena demais, junto com a 3b. |
| **4** | O descanso: cronômetro automático por exercício, ±15 s, pular, sobrevive à troca de aba; duração da sessão e "a última vez" por série ligada. |
| **5** | A série completa: tipos de série + RIR, supersérie, notas, calculadora de anilhas. |
| **6** | O app fica inteligente: recordes, 1RM, progressão sugerida, tela do exercício, séries por grupo na semana, resumo comparado no fim. |
| **7** | Fecho do treino: substituir exercício, repetir treino anterior, biblioteca com execução e unilateral. |

Cada onda tem o próprio commit e passa por `npm run typecheck`, `npm test` e
`npm run lint`. `design.md` e `DECISIONS.md` são atualizados na mesma onda, e o
checklist do §11 é rodado em cada tela alterada. No fim de cada onda entrego o
relatório do §8 do pedido e **paro até você aprovar**.

## Contexto

O pedido é um **reset da execução visual** (hierarquia, ritmo, densidade,
tipografia), mantendo a alma do §1: painel de instrumento, preto quase puro, um
accent por tela, números em mono, sem cor de estado. Junto vêm as pendências das
rodadas anteriores e as funcionalidades de treino que faltam.

A leitura do código mostrou:

- **"A última vez" por série não está ligada.** `SetRow` aceita `previous`, mas
  a sessão nunca passa esse valor e não existe consulta para isso.
- **Cada dado mora em dois lugares.** Peso corporal está na Hoje e no Perfil,
  Amigos no Histórico e no Perfil, volume na Hoje e em Números.
- **O plano está preso ao dia.** `routines.weekday` é `NOT NULL CHECK (0..6)`, a
  meta dos amigos no servidor conta `distinct routines.weekday`
  (`supabase/schema.sql:445,674`), e a cascata de alvos prefere a mesma
  `routine_id`.
- **O texto secundário não passa contraste.** `#8A8A8A` sobre a linha da série
  (fundo + halo de 0,09 + card de 0,06 + linha de 0,08) fica em ~3,0:1.
- **O sync copia todas as colunas.** O push faz `SELECT *` e o pull faz
  `INSERT OR REPLACE` com todas elas (`src/sync/engine.ts:136,214`). Coluna nova
  no SQLite sem a mesma coluna no Supabase quebra o push.

## Decisões fechadas com você

1. **Accent da sessão = a próxima série.** A caixa de concluído vira branca
   sólida, sem cor. A exceção da caixa sai do §2.
2. **Accent das telas de aba = o botão central.** O botão da Hoje vira vidro.
3. **O fim do descanso vibra.** Um toque `Rigid`, só com o app aberto, atrás da
   chave de Vibração. Entra no §10 como exceção escrita.
4. **Rotinas por vínculo.** A rotina é a unidade e a semana aponta para ela.
   Editar o Treino A muda segunda e quinta juntos.
5. **Itens das lojas que entram:**
   - RIR por série (16);
   - resumo do fim comparado com a última vez (17);
   - histórico do exercício pelo ⋯ durante o treino (18);
   - exercício unilateral (19).
6. **Cortados:** medidas corporais (só treino); importar ficha por foto/PDF,
   scanner e IA (exigem backend); vídeo de execução; check-in; pausar a sessão;
   Strava, Live Activity e widgets (exigem build nativo).

## O modelo de rotina (decisão 4), que molda as ondas 0 e 2

- **`week_schedule (id, weekday, routine_id, updated_at, deleted_at)`.** É uma
  tabela sincronizada nova, com RLS de quatro policies como as outras.
  - Sem índice único, pelo mesmo motivo da v2 (`INSERT OR REPLACE`): duplicata
    no mesmo dia se desempata na leitura por `updated_at`.
  - Dia sem linha é descanso.
- **`routines.weekday` vira coluna morta, sem reconstrução.**
  - Continua `NOT NULL` e ninguém lê.
  - Rotina nova grava o dia em que é agendada pela primeira vez, ou 0. O
    `DECISIONS.md` registra que a coluna morreu e por quê.
  - A rotina vale pelo nome ("Treino A · Push"). Rotina sem nome continua
    mostrando o nome do dia, como hoje.
  - O único efeito real do lixo: um aparelho da MESMA conta com build antigo lê
    `weekday`, e uma rotina sem dia apareceria nele como domingo. É aceitável e
    fica documentado.
- **`sessions.routine_id` não muda de sentido:** é a rotina treinada. Isso
  permite "trocar só hoje": treinar B numa segunda de A sem mexer na semana.
- **`week_targets.weekday` (nullable).** O ajuste "só esta semana" vale para
  aquele dia, mesmo com a rotina compartilhada. Nulo é o legado e vale para
  todos os dias.
- **A cascata fica como está.** Ela já prefere a mesma `routine_id`, então o A
  de quinta herda do A de segunda, que é o que quem faz A/B/C espera.
- **`ensureDayRoutine(weekday)` passa a ler `week_schedule`.** Quando o dia não
  tem nada, cria a rotina e a linha do dia na mesma transação, o que mantém a
  proteção contra dois toques. `isFirstRun` continua contando rotinas.

## Onda 0 — reset da linguagem visual (pilotos: Hoje e Sessão)

**Só visual, mais a estrutura das duas telas piloto já na forma final.** Assim
elas não são desenhadas duas vezes.

**Tokens como sistema** (`src/theme/tokens.ts`). Revisar por papel, não por
lista, com uma tabela de antes e depois no relatório:

- **Tipos.** Hoje são 10 tamanhos (12, 13, 15, 16, 19, 30, 20, 34, 56, 72), dois
  deles quase iguais (12/13, 15/16). O alvo é 7 papéis:
  - rótulo
  - auxiliar (13, o piso da sessão)
  - corpo
  - seção
  - título
  - número de linha
  - número herói

  Os tamanhos que sobrarem são apagados e os usos migram.
- **Espaçamento.** Hoje são 7 degraus (4–40). Fica uma escala de 4 com papéis
  nomeados: dentro do controle, entre controles, dentro do card, entre cards,
  margem da tela.
- **Superfícies e estados.** Hoje são 7 alphas mais o vidro. Passa a ser a
  escada de 3 níveis × estados (normal, tocado, desabilitado), com vazio e erro
  definidos como **texto e ícone, nunca cor**.
- **Raios.** Hoje são 24/14/10/pill. Confirmar um raio por nível e apagar o que
  não tiver nível.
- **Texto auxiliar.** Token novo `textAux`, calibrado pelo teste de contraste
  para dar ≥ 4,5:1 na superfície real (deve ficar perto de `#ADADAD`).
  `textSecondary` continua onde a superfície é o fundo.
- **Contraste.** `src/theme/composite.ts` ganha `contrast()` (luminância
  relativa WCAG), com um teste que compõe a pior superfície de cada nível e
  **falha abaixo de 4,5:1**.
- Os tokens que sobrarem sem uso são apagados.

**Componentes base.** Cada um com o antes e depois, em texto:

- `Card`
- `Button`: primário accent, vidro e inline, a mesma caixa nos três.
- `Chip`
- `Stepper`
  - Botões de 32 para 44 dp visíveis, com `hitSlop` até 48 dp e 8 dp de respiro.
  - **Segurar repete com aceleração**, sem háptico.
  - O número continua abrindo o teclado direto, então 60→80 são 2 interações.
- `SetRow`
- `CheckCell`: marcada fica branca sólida, a mesma caixa.
- `Segmented`
- `EmptyState`
- `Sheet`

**A barra de abas com o botão central.** Ela entra aqui porque é a dona do
accent das abas, e a Hoje não pode ser julgada sem ela.

- Fica um `Tabs.Screen name="train"` espaçador (`app/(tabs)/train.tsx` vazio)
  mais um `TrainButton` irmão absoluto do `<Tabs>`, porque no Android a barra
  recorta o que passa da borda.
- O botão tem 56 dp, accent sólido com glow, play, `accessibilityLabel`
  "Treinar", um ponto quando o treino está em andamento e o ícone de concluído
  quando o dia fechou.
- O comportamento vem de `useStartWorkout`, extraído de `openWorkout` em
  `app/(tabs)/index.tsx`.

**Piloto Hoje** (`app/(tabs)/index.tsx`), no layout final:

- O herói do dia mostra o nome da rotina, as séries e os exercícios.
- O botão de vidro mostra o estado ("Continuar · 2 de 5").
- Os próximos dias ficam embaixo.
- **Sai o card PROGRESSO.**
  - O peso continua acessível pelo Perfil até a Onda 3.
  - A sequência vai para o Calendário já nesta onda: é uma linha só, e sem isso
    ela sumiria do app.
- O lugar de "trocar só hoje" fica desenhado e é ligado na Onda 2.

**Piloto Sessão** (`app/session/[id].tsx`), no layout final:

- **HUD fixo e compacto.** Mostra o nome do treino e, em mono,
  `8/14 séries · 4.250 kg · 32:15`.
  - Ele nasce compacto e não encolhe ao rolar, porque o §10 proíbe movimento que
    muda tamanho.
  - O relógio é um componente `memo` com intervalo próprio.
  - `startSession` reinicia `started_at` quando nada está marcado (usa a coluna
    que já existe, sem migration).
- **O número herói vive na série da vez.** A linha da próxima série do exercício
  atual mostra a carga em mono de 56 px (`62,5` kg × 10), com os steppers e a
  caixa. A borda dela é o único accent da tela.
  - É o número que responde "o que eu faço agora", lido com o celular longe do
    rosto.
  - O volume do dia desce para o HUD, e o volume grande continua no resultado.
- **No meio da tela**, só o exercício atual fica aberto, e o que acaba fecha e
  rola até o próximo. Isso já existe e ganha o visual novo.
- **O rodapé** continua com "Finalizar treino · N de M". O lugar do descanso
  fica desenhado e é ligado na Onda 4.
- **Dica da sessão** reescrita para o destaque novo.

**Acessibilidade.** Testar Hoje, Sessão e a barra com a fonte do sistema no
maior tamanho (iOS: Tamanhos Maiores; Android: Fonte máxima).

- Relato o que quebra: truncamento, sobreposição, alvo fora da tela.
- Proponho a política: `maxFontSizeMultiplier` por papel tipográfico (por
  exemplo, o herói limitado e o corpo livre), escrita no `design.md`.

**Documentação.** No `design.md`:

- §2 com os dois donos do accent;
- §3 com a escala nova;
- §6 dizendo que o dado de gráfico fica fora da conta do accent;
- §10 sem mudança nesta onda;
- §11 atualizado;
- uma seção nova "HUD da sessão".

No `DECISIONS.md`, a entrada "Reset visual e dono do accent".

**Sem migration.**

**Como testar no celular**
1. Abrir o app. A barra tem 4 ícones e o círculo laranja no meio. A Hoje não tem
   outro laranja.
2. O círculo, a partir de qualquer aba, abre o treino de hoje. De volta, ele
   mostra o ponto.
3. Na sessão: o HUD não rola e o relógio anda. A próxima série mostra a carga
   grande com contorno laranja.
4. Marcar a série: a caixa fica branca, e o contorno e o número grande passam
   para a seguinte.
5. Segurar o `+` do peso: acelera. Tocar no número, digitar 80: pronto.
6. Repetir com a fonte do sistema no máximo e comparar com o meu relato.

**Gate:** você aprova o visual com as duas telas antes de qualquer
propagação. No relatório, **a Sessão vem antes da Hoje**: é ela que decide se o
reset funcionou.

## Onda 1 — o pull tolerante e a migration única (entregue junto com a 2)

**Primeiro, o pull tolerante** (`src/sync/engine.ts:214`).

- Hoje o pull monta o `INSERT OR REPLACE` com `Object.keys(row)`. Ele passa a
  gravar só as colunas que a tabela local conhece, via `PRAGMA table_info`, em
  cache por tabela e por conexão.
- Coluna desconhecida é ignorada em silêncio.
- O filtro é uma função pura (`pickKnownColumns`). Teste: uma linha remota com
  coluna extra entra sem quebrar, e as demais colunas gravam certo.
- Vem antes das colunas novas, e daí em diante nenhuma migration derruba build
  antigo.
- **Limite:** só protege builds que já têm o filtro. Um build anterior à Onda 1
  continua quebrando depois da v11.
  - Como a distribuição é por APK na mão, sem EAS Update, o filtro e a v6 saem
    **num build só**.
  - O roteiro de teste leva o aviso, para você repassar aos amigos: **quem não
    instalar o APK novo para de sincronizar até atualizar.** Os dados locais
    ficam intactos e sobem quando atualizar.

**Depois, a migration.** `src/db/schema.ts` **v6** (`SCHEMA_VERSION` 6) e
`supabase/schema.sql` **v11**, com tudo de uma vez, já que todas as colunas são
conhecidas:

| Tabela | Mudança | Usada na onda |
|---|---|---|
| `week_schedule` | tabela nova, backfill com uma linha por rotina viva no `weekday` dela, e outbox alimentada na mão (como na v2). `routines` não muda | 2 |
| `week_targets` | `weekday INTEGER` nullable | 2 |
| `exercises` | `rest_seconds INTEGER` (NULL = 90 s, 0 = desligado) e `unilateral INTEGER NOT NULL DEFAULT 0` | 4, 7 |
| `session_sets` | `set_type TEXT NOT NULL DEFAULT 'normal'` e `rir INTEGER` | 5 |
| `routine_exercises` | `superset_id TEXT` | 5 |
| `sessions` | `note TEXT` e `exercise_notes TEXT NOT NULL DEFAULT '{}'` | 5 |

- O servidor também muda: as RPCs `friend_weekly_days` e a meta da linha 674
  passam a contar `week_schedule`, e entram RLS e o índice de sync de
  `week_schedule`.
- Do lado do app: `src/db/rows.ts`, `src/domain/types.ts`, `SYNCED_TABLES` (com
  `week_schedule` depois de `routines`), testes de `pendingMigrations` e um teste
  puro do backfill.
- **Nenhuma tela muda.** O app continua lendo `routines.weekday` até a Onda 2.
  O backfill garante que `week_schedule` já chegue certo.
- **Ordem de instalação:**
  1. Você roda a v11 no SQL Editor.
  2. Você instala o APK único (filtro + v6).
  3. Você repassa o APK aos amigos com o aviso acima.
- **Antes da Onda 4** entrego o levantamento do custo de ligar `expo-updates` +
  EAS Update: conta EAS, um último APK, canais e `runtimeVersion` (mudança
  nativa ainda exige APK). Assim as ondas seguintes podem chegar pelo ar.
- **Reversível?** Sim. É tudo aditivo (colunas e uma tabela), e nada existente é
  reescrito. Voltar é um build que ignora o que foi acrescentado.
- **Testar:**
  - o app abre igual;
  - um treino inteiro funciona;
  - o sync sobe sem erro;
  - no Supabase, `week_schedule` tem um dia por rotina que existia.

## Ondas 2–7 (detalhe no gate de cada uma)

- **2 — rotinas A/B/C.**
  - O Plano mostra a semana (7 linhas, cada uma com a rotina ou "Descanso") e,
    embaixo, as rotinas e o catálogo.
  - `day/[weekday]` vira `routine/[id]`, com o aviso "também na quinta" quando
    a rotina é compartilhada.
  - Dá para criar, duplicar, reordenar e aplicar a um dia.
  - A Hoje ganha "trocar só hoje".
  - `ensureDayRoutine`, `targetsForWeek` e `setWeekTarget` passam a ler o
    weekday.
  - A dica do Plano é reescrita.
- **3a — Progresso e resultado.**
  - `history.tsx` vira `progress.tsx`, com Calendário · Números · Peso, e
    `?view=` continua funcionando.
  - `app/bodyweight.tsx` vira `BodyWeightPanel`, e o peso sai dos Números.
  - O resultado ganha o visual novo.
  - Auditoria de fonte grande nas três.
- **3b — o resto.**
  - Perfil: sai o peso, Amigos fica.
  - O ranking de amigos vai para `app/friends.tsx`.
  - Catálogo, biblioteca, amigo, login e configuração do perfil.
  - Auditoria de fonte grande.
- **3c — tour e onboarding** no visual novo, incluindo a abertura de cinema do
  §10, que mantém a curva e o "reduzir movimento".
- **4 — descanso.**
  - `src/store/rest.ts`: zustand + AsyncStorage, guarda o `endsAt`, nunca um
    contador.
  - `src/domain/rest.ts` e `duration.ts`, puros e testados.
  - `RestBar` no rodapé, com alvos de 48 dp.
  - O descanso inicia ao marcar uma série que não é a última do treino.
  - "Descanso · 1:30" no ⋯ do exercício.
  - `RestWatcher` no `_layout` raiz com `restOver()`.
  - O resultado mostra a duração e o tempo médio por série.
  - `lastSetsForExercises` liga `SetRow.previous`.
  - A dica da sessão ganha um segundo passo, sobre o descanso.
- **5 — a série completa.**
  - Aquecimento fora de todo volume e recorde: as consultas do repo, a cascata,
    `draftVolume` e `domain/volume.ts`.
  - Tipo por toque em "SÉRIE n", como texto, sem cor.
  - RIR opcional.
  - Supersérie com a próxima série alternando e o descanso só no fim da volta.
  - Notas do treino e por exercício, com "última vez: …".
  - `domain/plates.ts` e o botão "Anilhas" ao lado do PESO.
- **6 — inteligência.**
  - `records.ts`, `oneRepMax.ts` (Epley, até 12 reps) e `progression.ts`, todos
    derivados e nunca armazenados.
  - O recorde aparece como **texto**.
  - `app/exercise/[id].tsx`, aberta pelo ⋯ da sessão, pelos Números e pelo
    catálogo.
  - Séries por grupo na semana, incluindo os grupos com zero.
  - Resumo comparado no resultado.
- **7 — fecho.**
  - Trocar por um similar, só hoje ou no plano.
  - Repetir o treino de uma data.
  - Biblioteca com músculo primário e secundário, equipamento, passos em pt-BR
    e unilateral. É trabalho de conteúdo em `src/movements/data.ts`.

## Fora de escopo (propostas)

- Aviso de descanso com o app fechado (`expo-notifications`).
- `expo-keep-awake` durante a sessão (já vem no Expo Go, posso incluir na Onda
  4).
- Relógio, Live Activity, HealthKit/Google Fit e widgets.

## Verificação (toda onda)

- `npm run typecheck`, `npm test` e `npm run lint`.
- O roteiro "Como testar" da onda, no celular, mais um treino inteiro e as
  quatro abas.
- Performance da sessão:
  - os `memo` e comparadores por valor ficam;
  - relógio e descanso são componentes isolados;
  - mexer no stepper com o relógio correndo não engasga.
- O §11 do `design.md`, item por item, em cada tela alterada.

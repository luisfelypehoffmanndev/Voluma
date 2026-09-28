# 13 — Aba Amigos: ranking de dias treinados na semana

**Arquivos:** `supabase/schema.sql`, `supabase/tests/13-ranking.sql`,
`src/domain/week.ts`, `src/domain/friends.ts`, `src/sync/friends.ts`,
`src/ui/history/FrequencyRanking.tsx`, `src/ui/history/FriendsPanel.tsx`,
`app/(tabs)/history.tsx` (novos e alterados)
**Depende de:** [12](12-amigos.md) — amizade aceita e o toggle
**Estado:** **feito** e substituído em parte pelo [14](14-amigos-graficos.md) —
a RPC `friend_weekly_frequency` virou `friend_weekly_days` (v8), o
`FrequencyRanking` virou `RankingList` e o `13-ranking.sql` virou o
`14-amigos-graficos.sql`. O texto abaixo é o registro da decisão original.

## Contexto da decisão

O item 12 deixou tudo pronto para comparar — amizade com aceite, o toggle, e
até a regra de ordenação (`rankByFrequency`, 12.2) — mas nada que mostrasse a
comparação. Este item é essa tela.

Decisões fechadas antes de escrever qualquer linha:

- **Dias treinados, nunca volume, carga ou peso.** Frequência é comparável
  entre iniciante e avançado; carga só informaria quem treina há mais tempo.
- **Quem não compartilha aparece no fim como "não compartilha", não como 0.**
- **Você entra no ranking.** Ver os amigos sem ver o próprio lugar não compara
  nada.
- **Terceiro segmento "Amigos" no Histórico**, ao lado de Calendário e
  Números, e não um card dentro dos Números: é outra leitura, e o painel de
  Números é todo sobre você.
- **Uma RPC só, de frequência**, em vez do `friend_weekly_volume(friend_id)`
  do rascunho em `DECISIONS.md`: a métrica decidida é frequência, e uma chamada
  para todos evita N idas ao servidor.

Escopo: só a semana atual. Distância de corrida no mês e consistência ficam
para depois.

## 13.1 — RPC `friend_weekly_frequency(week_start, week_end)` (`-- v7`)

Devolve `handle` e `days` de cada amizade **aceita**; `days` é nulo quando o
amigo não compartilha. O corte é no SQL, como no `list_friends()`.

- **A semana vem do cliente.** O servidor está em UTC; perto da meia-noite o
  `current_date` dele já seria o dia seguinte. `sessions.date` é a data local
  de quem treinou, então comparar datas cruas bate com a semana do app.
- **"Dia treinado" é a regra do cliente** (`volumeByWeek`): dia com volume > 0.
  Série a 0 kg, não concluída ou apagada não faz um dia.
- **`st.user_id = p.id` explícito.** Não há FK entre as tabelas; sem o filtro,
  uma série de outra pessoa com o mesmo `session_id` daria um dia a mais.
- **Dois índices novos**, `sessions (user_id, date)` e
  `session_sets (session_id)`: os do sync são por `updated_at` e não servem.

## 13.2 — `weeklyFrequency(weekStart, weekEnd)`

`src/sync/friends.ts`. Mantém o nulo como nulo.

## 13.3 — Regras puras

- `weekRange(now)` (`src/domain/week.ts`) — domingo e sábado da semana.
- `friendsRanking(friends, self)` (`src/domain/friends.ts`) — junta você aos
  amigos e ordena por `rankByFrequency`. **Sem amigos devolve vazio**, e não uma
  lista só com você: ranking de um é o estado "adicione amigos".

## 13.4 — Tela

`FrequencyRanking` só recebe props e desenha; `FriendsPanel` busca e escolhe o
estado (sem nuvem, sem conta, erro, sem amigos, ranking). Os amigos vêm da RPC
com `liveUpdates: false` — marcar uma série não pode refazer a chamada de rede;
seus dias vêm do SQLite.

Sem accent: a sua linha se separa pelo tom do texto. Barra em tracinhos
(`DashedBar`) sobre 7 dias. Com o seu toggle desligado, o rodapé avisa que os
amigos não veem a sua semana.

## 13.5 — Testes

| Onde | O que garante |
|---|---|
| `week.test.ts` — `weekRange` | domingo, sábado à noite, virada de mês e de ano, mesma chave de `weekStartKey` |
| `friends.test.ts` (domínio) — `friendsRanking` | sem amigos → `[]`; você no lugar certo; empate por handle; 0 acima de nulo; uma linha `isSelf`; não muta a entrada |
| `friends.test.ts` (sync) — `weeklyFrequency` | nome e parâmetros da RPC; nulo segue nulo; `[]`/`null` → `[]`; erro vira exceção |
| `FrequencyRanking.test.tsx` | nulo mostra "não compartilha", nunca "0 dias"; zero mostra "0 dias"; ordem e posição; "Você"; rodapé só com o toggle desligado |
| `supabase/tests/13-ranking.sql` | sem toggle → nulo; contagem de dias; mesmo dia conta uma vez; apagado, 0 kg e não concluído não contam; fora da semana não conta; série intrusa não conta; pendente e não-amigo não aparecem; consentimento é de cada lado; `anon` negado |

O teste SQL foi validado contra um Postgres local (com um shim de `auth.users`,
`auth.uid()` e os papéis `anon`/`authenticated`): passa com a v7 e **falha com
a mensagem certa** em quatro mutações — sem o filtro `st.user_id`, sem o corte
do toggle, com pendente entrando e com `anon` liberado.

## Verificar

- `npm run typecheck` limpo e `npm test` com 369 passando (**feito**).
- `supabase/schema.sql` rodado **duas vezes seguidas** sem erro (**feito** no
  Postgres local; falta no Supabase).
- `supabase/tests/13-ranking.sql` colado no SQL Editor devolve `ok` (**feito**
  no Postgres local; falta no Supabase).
- **Duas contas reais** (A e B, amigas), no aparelho:
  - Toggles desligados: A vê B no fim, "não compartilha", sem barra.
  - B liga o toggle e treina hoje: A vê B com 1 dia; B continua vendo A como
    "não compartilha".
  - Treino de B só com séries a 0 kg não conta dia.
  - Pedido pendente não aparece no ranking.
  - Sair da conta: a aba Amigos pede login, sem dado da conta anterior.
- Calendário e Números seguem iguais; `?view=numbers` da home ainda funciona.

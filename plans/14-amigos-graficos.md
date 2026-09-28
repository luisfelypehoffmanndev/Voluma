# 14 — Aba Amigos: 12 semanas, consistência e corrida

**Arquivos:** `supabase/schema.sql`, `supabase/tests/14-amigos-graficos.sql`,
`src/domain/week.ts`, `src/domain/friends.ts`, `src/sync/friends.ts`,
`src/ui/charts/MiniBars.tsx`, `src/ui/history/RankingList.tsx`,
`src/ui/history/WeeksCard.tsx`, `src/ui/history/ConsistencyCard.tsx`,
`src/ui/history/FriendsPanel.tsx` (novos e alterados)
**Depende de:** [13](13-ranking-amigos.md)
**Estado:** **feito** — v8 rodada no Supabase; apresentação evoluída no [15](15-avatar-e-nomes.md) para ranking unificado (`FriendsRanking`) e tela individual (`app/friend/[id].tsx`) com o novo sistema de gráficos

## Contexto da decisão

O item 13 entregou só o ranking da semana. Este traz os outros gráficos da
lista original, com as escolhas feitas na conversa de 2026-09-28:

- **Frequência em 12 semanas** como **mini-gráfico por pessoa**: uma fileira
  de barras por pessoa, todas na mesma escala de 0 a 7 dias.
- **Consistência** com a meta = **dias da rotina** de cada um (dias da semana
  com treino no Plano). Nada novo para configurar; quem não tem plano aparece
  como "sem plano".
- **Corrida no mês**: ranking de km no mês corrente, que só aparece se alguém
  correu.

As regras de antes continuam: nada de carga ou peso em comparação, "não
compartilha" nunca vira zero, só agregado sai do servidor e o corte é no SQL.
Nenhum accent nesta aba.

## 14.1 — Servidor (`-- v8`)

- `friend_weekly_days(first_week, last_week)` substitui o
  `friend_weekly_frequency` da v7, que a v8 remove (`drop function if exists`).
  Uma linha por amigo e semana **com treino** (semana = domingo da data, igual
  ao `weekStartKey`); quem não compartilha, ou compartilha e não treinou, vem
  numa linha só com `week_start` nulo. `planned_days` são os dias distintos
  com rotina não apagada — também só com o toggle.
- `friend_monthly_distance(month_start, month_end)` — soma de `distance_km`
  das séries concluídas e não apagadas, arredondada a uma casa.
- Os índices da v7 continuam e servem às duas.

## 14.2 — Regras puras

- `rankByValue(rows, value)` — generaliza a ordenação (maior primeiro, nulo no
  fim, desempate por handle); `rankByFrequency` virou um caso dele.
- `rankWithSelf(friends, self)` — substitui o `friendsRanking`, agora para
  qualquer medida (dias, km).
- `friendSeries(rows, weekKeys)` — uma série por pessoa, com zero nas semanas
  que o servidor não mandou.
- `closedWeeks(weeks, plannedDays)` — fechou, perdeu, ou em andamento (a semana
  atual abaixo da meta não é falha e fica fora da conta). Aplica o plano de
  hoje às semanas passadas: o banco não guarda histórico do plano.
- `lastWeekKeys(now, n)` e `monthRange(now)` em `week.ts`.

## 14.3 — Tela

`FriendsPanel` faz uma consulta só: as duas RPCs e, do SQLite, seus dias, sua
distância e suas rotinas. Cards:

1. **Esta semana · dias treinados** — `RankingList` (antes `FrequencyRanking`).
   Posição só com o número (o "º" em fonte mono lia "1 º") e coluna de nome
   mais larga, com corte no meio do @.
2. **Últimas 12 semanas** — `WeeksCard` com `MiniBars`: escala fixa 0–7 para
   todo mundo, sua fileira em branco, média das semanas fechadas à direita, o
   período uma vez só embaixo. Barras de 40dp: a 28dp, 2 e 3 dias pareciam
   iguais no aparelho.
3. **Semanas com a meta** — `ConsistencyCard`: um quadrado por semana, o
   estado na forma (cheio, contorno, tracejado), "9/11" em texto.
4. **Corrida · mês** — `RankingList` em km.

Skills usadas no desenho: `dataviz` (small multiples com escala comum, destaque
só na sua fileira, 2px entre barras, todo valor também em texto),
`frontend-design` e `expo:expo-design-system` (seguir o brief e os tokens
existentes; nenhuma cor nova).

> **Evolução no [Item 15](15-avatar-e-nomes.md):** No desenho inicial deste item,
> os quatro cards ficavam empilhados dentro do `FriendsPanel`, repetindo os
> mesmos amigos quatro vezes. O item 15 simplificou o `FriendsPanel` para o
> ranking semanal direto (`FriendsRanking`), transferindo os cards 2, 3 e 4
> para a tela individual `app/friend/[id].tsx`, onde os dados são comparados
> diretamente com os seus através dos novos componentes `BarChart` e `shapes.ts`.

## 14.4 — Testes

| Onde | O que garante |
|---|---|
| `week.test.ts` | `lastWeekKeys` (virada de ano, bate com `volumeByWeek`), `monthRange` (28/29/30/31 dias) |
| `friends.test.ts` (domínio) | `rankByValue`, `rankWithSelf`, `friendSeries` (zeros, ordem, semana fora ignorada, não-compartilhante nulo), `closedWeeks` (semana atual em andamento, sem plano) |
| `friends.test.ts` (sync) | nomes e parâmetros das duas RPCs, nulos preservados, erro vira exceção |
| `MiniBars.test.tsx` | escala fixa, uma barra por valor, respiro entre barras |
| `RankingList.test.tsx` | "não compartilha" nunca vira zero, posição sem "º", formato em km |
| `supabase/tests/14-amigos-graficos.sql` | substitui o `13-ranking.sql`: semanas no domingo certo, semana vazia ausente, meta por dias distintos sem rotina apagada, km só de série concluída e só no mês, série intrusa não conta, pendente e não-amigo fora, consentimento de cada lado, `anon` negado, v7 removida |

O teste SQL foi validado no Postgres local e falha com a mensagem certa em 11
mutações (tirar o filtro `st.user_id`, o corte do toggle, o `+ 6` da última
semana, trocar a semana para segunda-feira, e outras).

## Verificar

- `npm run typecheck` limpo, `npm test` com 401 passando (**feito**).
- `schema.sql` duas vezes seguidas e `14-amigos-graficos.sql` → `ok` no
  Postgres local (**feito**); v8 rodada no Supabase (**feito**, 2026-09-28).
- No aparelho, com o seed de amigos falsos: cards 1 e 2 (**feito**); cards 3 e
  4 (falta).
- Duas contas reais (falta).

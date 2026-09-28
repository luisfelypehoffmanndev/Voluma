# 15 — Foto de perfil, nome de exibição, cor por amigo e refatoração dos gráficos

**Arquivos:** `supabase/schema.sql`, `supabase/tests/15-avatar.sql`,
`src/sync/avatar.ts`, `src/sync/profile.ts`, `src/sync/friends.ts`,
`src/store/profile.ts`, `src/theme/tokens.ts`, `src/domain/friends.ts`,
`src/ui/Avatar.tsx`, `src/ui/useAvatarUrls.ts`, `src/ui/profile/pickAvatar.ts`,
`src/ui/charts/BarChart.tsx`, `src/ui/charts/LineChart.tsx`,
`src/ui/charts/HBarList.tsx`, `src/ui/charts/GlowCanvas.tsx`,
`src/ui/charts/Frame.tsx`, `src/ui/charts/shapes.ts`, `src/ui/charts/axis.ts`,
`src/ui/history/FriendsRanking.tsx`, `src/ui/history/useFriendsData.ts`,
`app/friend/[id].tsx`, `app/(tabs)/profile.tsx`, `app/friends.tsx`,
`scripts/seed-fake-avatars.mjs`
**Depende de:** [14](14-amigos-graficos.md)
**Estado:** **feito** — v9 e v10 rodadas no Supabase, bucket `avatars` criado e teste `15-avatar.sql` passando

## Contexto da decisão

O item 14 entregou a matemática e as RPCs das comparações da aba Amigos, mas
a apresentação visual e a identidade dos usuários ainda tinham lacunas:

1. **Identidade pessoal além do @handle:** para reconhecer amigos rapidamente,
   uma foto de perfil e o nome de exibição (inicializado com a conta Google) são
   essenciais. Como o @handle, ambos são identidade e aparecem para amigos aceitos
   sem depender do toggle de números.
2. **Cores fixas com glow:** cada amigo ganha uma cor pessoal da paleta
   `people` em `tokens.ts`. Para evitar que amigos troquem de cor a cada mudança
   de posição no ranking, a atribuição é estável por ordem cronológica de amizade
   (`since` retornado na RPC `list_friends`). O dado do próprio usuário veste o
   laranja da marca (`--accent`).
3. **Redesign dos gráficos:** os gráficos antigos (blocos empilhados, tracinhos e
   quadrados de 4px sem meses claros no eixo) eram difíceis de ler. Foram
   refeitos com componentes canônicos:
   - `BarChart`: quantidade por período (volume por semana, dias por semana);
   - `LineChart`: evolução contínua com área em degradê (carga de exercício, peso corporal);
   - `HBarList`: distribuição de partes de um todo (volume por grupo muscular).
4. **Anatomia da aba Amigos:** em vez de quatro cards repetindo a lista das mesmas
   pessoas no `FriendsPanel`, a aba foca em um ranking semanal unificado
   (`FriendsRanking`). O detalhe comparativo (12 semanas, consistência com a meta
   da rotina e corrida no mês) foi transferido para uma tela dedicada por pessoa:
   `app/friend/[id].tsx`.

## 15.1 — Servidor (`-- v9: foto de perfil` e `-- v10: nome de exibicao`)

- **Coluna `avatar_path` em `profiles`:** caminho `{user_id}/{timestamp}.jpg`
  validado por regex. O timestamp garante invalidação de cache local ao trocar de foto.
- **Bucket privado `avatars` no Storage:** limite de 512 KB, apenas `image/jpeg`.
  Acesso público desativado; leitura apenas via URLs assinadas geradas pelo Supabase.
- **Policies de Storage:**
  - `avatar_insert` e `avatar_delete`: restritos ao dono na sua própria pasta (`auth.uid()`).
  - `avatar_select`: dono, qualquer lado de amizade aceita, e destinatário de pedido pendente.
- **Coluna `display_name` em `profiles`:** de 1 a 40 caracteres, não vazio (`btrim <> ''`).
- **RPC `list_friends()` atualizada:** retorna `avatar_path`, `since` (data de
  criação da amizade para fixar a cor) e `display_name`.

## 15.2 — Sincronização e Imagem

- `src/sync/avatar.ts`: `uploadAvatar` (sobe arquivo redimensionado e atualiza perfil),
  `removeAvatar` (deleta do storage e zera coluna), `createSignedAvatarUrl` (gera URL de 1h).
- `src/ui/profile/pickAvatar.ts`: integra `expo-image-picker` e `expo-image-manipulator`,
  reencodando a imagem selecionada para 256×256 JPEG antes do envio.
- `src/ui/useAvatarUrls.ts`: hook para batch signing de URLs de avatares com cache em memória.

## 15.3 — Interface e Gráficos

- `src/ui/Avatar.tsx`: exibe foto remota ou fallback circular com iniciais e cor do tema.
- `src/theme/tokens.ts`: paleta `people` com 8 cores balanceadas com glow.
- `src/ui/history/FriendsRanking.tsx`: substitui o antigo `RankingList`, exibindo
  foto, nome curto, @handle e quantidade de dias treinados na semana.
- `app/friend/[id].tsx`: tela comparativa direta (Você vs Amigo) contendo cards de
  12 semanas (small multiples com `BarChart`), cumprimento de metas e corrida do mês.
- `src/ui/charts/GlowCanvas.tsx`, `shapes.ts`, `axis.ts`: motor Skia / SVG com suporte a
  brilho especular neon, eixos mensais padronizados e escala automática com números redondos.

## 15.4 — Testes

| Onde | O que garante |
|---|---|
| `avatar.test.ts` (sync) | Upload, deleção, regex de avatar_path, expiração de URL assinada |
| `people.test.ts` (theme) | Paleta de cores, estabilidade do hash por ID e ordem |
| `Avatar.test.tsx` (ui) | Fallback com iniciais, aplicação de cor, imagem remota |
| `shapes.test.ts` (charts) | Cálculo de barras, interpolação de curvas e áreas com degradê |
| `axis.test.ts` (charts) | Ticks mensais, formatação de escala e divisores |
| `FriendsRanking.test.tsx` (ui) | Ordenação com self, estado sem compartilhamento, nomes e toques |
| `supabase/tests/15-avatar.sql` | RLS do bucket `avatars`, restrição de tamanho/MIME, visibilidade de foto e display_name para aceitos e pedidos recebidos, rejeição de nomes inválidos |

## Verificar

- `npm run typecheck` limpo (**feito**).
- `npm test` — 476 testes passando em 31 suítes (**feito**).
- `supabase/tests/15-avatar.sql` colado no SQL Editor devolve `ok` (**feito**).
- Upload de foto real no perfil pelo app físico atualiza na hora e reflete para amigos (**feito**).

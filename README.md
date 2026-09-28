# Voluma

App de academia minimalista. Expo (iOS + Android). Interface em português,
estética definida em [`Design/design.md`](Design/design.md).

## Rodar

```bash
npm install
npx expo start
```

Leia o QR code com o Expo Go. O app inteiro funciona ali — **menos o login com
Google**, que precisa do scheme `voluma://` registrado e por isso exige dev
client (`eas build --profile development`) ou `npx expo run:android` /
`npx expo run:ios`. Sem login, o app roda 100% local, que é o modo padrão.

```bash
npm test        # domínio, sqlite, sync, store, tema, gráficos e render de perfil/amigos
npm run typecheck
```

Quase todo teste é de função pura, sem banco e sem render — a convenção está em
[`plans/08-testes-puros.md`](plans/08-testes-puros.md). As exceções de render que
usam `@testing-library/react-native` são `src/ui/profile/` (onde a regra do
@handle, o campo de texto e a recusa do banco se encontram),
`src/ui/__tests__/Avatar.test.tsx` (iniciais, imagem e cor do avatar) e
`src/ui/history/__tests__/FriendsRanking.test.tsx` (ordenação, nome e estados do
ranking de amigos).

## Como funciona

O app é **local-first**. O SQLite do aparelho é a fonte de verdade para
leitura: nenhuma tela consulta o Supabase diretamente. Toda escrita grava
localmente e enfileira a linha em `outbox`; o serviço de sync drena a fila
quando há rede. É o que permite registrar séries dentro da academia sem sinal.

**Uma exceção, e só uma:** a camada social — o perfil público
(`src/sync/profile.ts`), os amigos (`src/sync/friends.ts`) e o avatar
(`src/sync/avatar.ts`) — lê e grava no Supabase direto. Ela não tem par no
SQLite porque é dado social — o @handle com que amigos acham a pessoa, nome de
exibição, foto, idade, anos de treino e quem é amigo de quem — e não tem o que
fazer offline. Quem usa o app sem conta simplesmente não tem perfil nem amigos,
e não perde nada por isso. Tudo que é treino continua local-first.

```
app/            telas (expo-router, file-based)
src/domain/     lógica pura e testável — volume, calendário, streak
src/db/         SQLite: schema, migrations, repositórios
src/sync/       Supabase: cliente, auth, push/pull, avatar
src/ui/         componentes do design system e gráficos
src/theme/      tokens do design.md, paleta de pessoas e conta do vidro
scripts/        manutenção: vendorização de artes e seed de avatares
supabase/       schema.sql para colar no SQL Editor (tabelas, RLS, Storage)
```

### Abas

A barra tem quatro abas sem rótulo visível (cada uma com
`tabBarAccessibilityLabel`), e cada tela tem uma ação principal óbvia:

| Aba | Para quê |
|---|---|
| **Hoje** | o treino do dia e o botão "Começar / Continuar treino" |
| **Plano** | os sete dias da semana e o catálogo de movimentos |
| **Histórico** | calendário, números e amigos, num seletor segmentado |
| **Perfil** | peso corporal, vibração, perfil público (foto, nome, @handle), amigos, nuvem e créditos |

Na primeira abertura (banco sem plano e sem exercícios) o app passa por um
onboarding: duas telas explicando Plano → Hoje → Histórico e a escolha entre um
modelo Push/Pull/Legs nos dias marcados ou a semana vazia. Nada é criado às
escondidas. A explicação pode ser revista em **Perfil → Como o Voluma funciona**.

Todo treino tem começo, meio e fim: "Finalizar treino" leva a uma tela de
resultado que compara o volume com o mesmo dia da semana anterior. Nada
destrutivo acontece a um toque — "Pular hoje" oferece desfazer, "Remover do
plano" pergunta antes. Toda lista vazia tem um botão que resolve, e toda falha
de carga tem "Tentar de novo" (`useQuery` devolve `error`).

Volume nunca é armazenado. Ele é sempre derivado de `reps × peso` das séries
concluídas — ver `src/domain/volume.ts`.

## Nuvem (opcional)

Sem `.env`, o app roda inteiro offline e não mostra login. Para ligar backup e
sincronização entre aparelhos:

1. Crie um projeto em [supabase.com](https://supabase.com).
2. **SQL Editor**: rode [`supabase/schema.sql`](supabase/schema.sql) inteiro.
   Ele cria as tabelas, os índices, o bucket `avatars` no Storage e o RLS.
   O arquivo é idempotente: rodar de novo depois de cada versão nova (hoje até a
   `v10: nome de exibicao`) não quebra nada.
3. Configure o login com Google (abaixo).
4. Copie `.env.example` para `.env` e preencha URL e anon key
   (**Project Settings → Data API**).
5. Reinicie o `expo start` — variáveis `EXPO_PUBLIC_*` entram no bundle em
   tempo de build, não em tempo de execução.
6. No app: **Perfil → Nuvem → Entrar → Continuar com Google**.

### Login com Google

O app não tem senha própria — entrar é sempre com conta Google, resolvida pelo
provider OAuth do Supabase. Uma senha a menos para guardar e para vazar.

1. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   crie uma credencial **OAuth client ID** do tipo **Web application**. Em
   "Authorized redirect URIs", cole a URL de callback que o Supabase mostra no
   passo seguinte.
2. No Supabase: **Authentication → Providers → Google**, ative e cole o
   **Client ID** e o **Client Secret** do passo 1.
3. **Authentication → URL Configuration → Redirect URLs**: adicione
   `voluma://`. É o `scheme` do `app.json`, e é o único caminho de volta que
   precisa estar liberado — não muda por build nem por aparelho.

**Não funciona no Expo Go**: o scheme `voluma://` não está registrado lá, então
o Google não tem como devolver a sessão ao app. Use o dev client
(`eas build --profile development`) ou `npx expo run:android` /
`npx expo run:ios`.

A anon key é pública por design. O que protege os dados é o RLS: cada linha
carrega `user_id` e a policy só libera `auth.uid() = user_id`.

## Sincronização

Conflitos resolvem por **last-write-wins** em `updated_at`. Nada é apagado de
verdade — delete é soft delete (`deleted_at`), senão uma remoção feita offline
seria desfeita pelo próximo pull.

Sair da conta apaga o banco local, para não deixar dados de uma conta visíveis
para a próxima.

## Regras de design que o código respeita

De `Design/design.md`, as que mais restringem o código:

- **Um único elemento em `--accent` por tela.** Na home é o botão "Começar /
  Continuar treino"; por isso o card de volume é vidro normal e o dot-matrix de
  lá recebe `showRecord={false}`.
- **Toda superfície é vidro sobre um campo de luz.** O que muda entre os níveis
  é a densidade, não a matéria: cards a 6%, superfície dentro deles a 8%, e tab
  bar e modal quase opacos — esses precisam esconder o que passa por baixo. O
  botão e o card accent são as únicas superfícies sólidas que sobraram.
- **Sem cor de estado.** Erro e sucesso são comunicados por texto, nunca por
  vermelho ou verde.
- **Números em mono de traço fino**, nunca sans bold.
- **Copy direto**: substantivo + dado, sem frase motivacional.

# Voluma

App de academia minimalista para uso pessoal. Expo (iOS + Android), testável no
Expo Go. Interface em português, estética definida em [`Design/design.md`](Design/design.md).

## Rodar

```bash
npm install
npx expo start
```

Leia o QR code com o Expo Go. Nenhum build nativo é necessário — todas as
dependências são JS puro ou já vêm embarcadas no Expo Go.

```bash
npm test        # domínio (volume, semana, streak) e a conta do vidro
npm run typecheck
```

## Como funciona

O app é **local-first**. O SQLite do aparelho é a fonte de verdade para
leitura: nenhuma tela consulta o Supabase diretamente. Toda escrita grava
localmente e enfileira a linha em `outbox`; o serviço de sync drena a fila
quando há rede. É o que permite registrar séries dentro da academia sem sinal.

```
app/            telas (expo-router, file-based)
src/domain/     lógica pura e testável — volume, calendário, streak
src/db/         SQLite: schema, migrations, repositórios
src/sync/       Supabase: cliente, auth, push/pull
src/ui/         componentes do design system
src/theme/      tokens do design.md e a conta de composição do vidro
scripts/        gerador do grão que dithera o campo de luz
supabase/       schema.sql para colar no SQL Editor
```

### Abas

A barra tem quatro abas sem rótulo visível (cada uma com
`tabBarAccessibilityLabel`), e cada tela tem uma ação principal óbvia:

| Aba | Para quê |
|---|---|
| **Hoje** | o treino do dia e o botão "Começar / Continuar treino" |
| **Plano** | os sete dias da semana e o catálogo de movimentos |
| **Histórico** | calendário e números, num seletor segmentado |
| **Perfil** | peso corporal, vibração, nuvem e créditos |

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
2. **Authentication → Providers**: deixe apenas Email e **desative "Confirm
   email"**, senão o primeiro login trava esperando confirmação.
3. **SQL Editor**: rode [`supabase/schema.sql`](supabase/schema.sql) inteiro.
   Ele cria as tabelas, os índices e o RLS.
4. Copie `.env.example` para `.env` e preencha URL e anon key
   (**Project Settings → Data API**).
5. Reinicie o `expo start` — variáveis `EXPO_PUBLIC_*` entram no bundle em
   tempo de build, não em tempo de execução.
6. No app: **Perfil → Nuvem → Entrar**, e use "Criar conta com este e-mail"
   na primeira vez.

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

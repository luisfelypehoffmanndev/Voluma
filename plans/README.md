# Planos

Uma revisão geral de código e segurança (2026-09-16) encontrou 10 problemas no
caminho de virar um app multiusuário, usado numa academia real — ver
[`../DECISIONS.md`](../DECISIONS.md). Do 11 em diante são features da camada
social, no mesmo formato.

Cada arquivo aqui é autocontido: problema, arquivo e linha, correção proposta e
como verificar. A ideia é resolver um de cada vez.

| # | Item | Severidade | Estado |
|---|---|---|---|
| [09](09-getdb-promise-rejeitada.md) | `getDb()` cacheia promise rejeitada | falha passageira vira permanente | **feito** |
| [10](10-sync-travado.md) | Falha de rede desliga o sync até reiniciar | alta | **feito** |
| [01](01-corrida-errada.md) | "Adicionar corrida" põe o exercício errado | bug visível | **feito** |
| [02](02-migrations-atomicas.md) | Migrations não são atômicas nem retomáveis | dano irreversível | **feito** |
| [03](03-signout-race.md) | `signOut()` corre com um sync em voo | vazamento entre contas | **feito** |
| [04](04-rls-policies.md) | RLS: `auth.uid()` por linha, falta `TO authenticated` | performance na escala | **feito** — v4 rodada no Supabase e RLS confirmado |
| [05](05-push-chunking.md) | `push()` sem chunking no `IN (...)` | baixa | **feito** |
| [06](06-auth-listener.md) | `onAuthStateChange` nunca desinscrito | baixa | **feito** |
| [08](08-testes-puros.md) | Testes puros das correções 01 e 02 | — | **feito** |
| [07](07-login-google.md) | Migração do login para conta Google | decisão de produto | **feito** — testado no aparelho, login funcionando |
| [11](11-perfil-handle.md) | Perfil público: @handle, idade e anos de treino | feature | **feito** — v5 rodada, RLS confirmado, testado no aparelho |
| [12](12-amigos.md) | Amigos e o toggle de compartilhamento | feature | **feito** — v6 rodada, RLS confirmado; pendente teste com duas contas |
| [13](13-ranking-amigos.md) | Aba Amigos: ranking de dias treinados na semana | feature | **feito** — v7 rodada; substituído por 14 e 15 |
| [14](14-amigos-graficos.md) | Aba Amigos: 12 semanas, consistência e corrida | feature | **feito** — v8 rodada; evoluído na tela de amigo no item 15 |
| [15](15-avatar-e-nomes.md) | Foto de perfil, nome de exibição, cor por amigo e refatoração dos gráficos | feature | **feito** — v9 e v10 rodadas, bucket avatars criado, teste 15-avatar.sql passando |

## Pendências fora do código

Concluída em 2026-09-28:

5. **Item 15** — as seções `-- v9: foto de perfil e cor por pessoa` e
   `-- v10: nome de exibicao` foram rodadas no SQL Editor. O bucket privado
   `avatars` foi criado no Supabase Storage. O teste
   `supabase/tests/15-avatar.sql` foi validado com sucesso.

Concluída em 2026-09-22:

4. **Item 12** — a seção `-- v6: amigos` foi rodada no SQL Editor duas vezes
   seguidas, sem erro. RLS confirmado com `set local role anon`: leitura de
   `friendships` devolve lista vazia; `insert` em `friendships` e chamada a
   `list_friends()` são rejeitados (`42501`). Falta o teste com duas contas
   reais no aparelho.

Concluída em 2026-09-21:

3. **Item 11** — a seção `-- v5: perfil` foi rodada no SQL Editor. RLS
   confirmado do mesmo jeito que o item 04: leitura anônima de `profiles`
   devolve lista vazia, escrita anônima é rejeitada (`42501`).

Ambas concluídas em 2026-09-17:

1. **Item 04** — `supabase/schema.sql` rodado no SQL Editor. RLS confirmado:
   leitura anônima devolve lista vazia, escrita anônima é rejeitada (`42501`).
2. **Item 07** — OAuth configurado (Google Cloud + Supabase), dev client
   buildado (`com.luisf.voluma`, com o scheme `voluma://` registrado) e login
   testado de ponta a ponta num aparelho físico.

### O que travou no caminho, para quem repetir o processo

- **`android/` estava desatualizado.** Um `prebuild` antigo tinha gerado o
  pacote com o nome anterior (`com.luisf.cleangym`), sem o scheme `voluma://`
  no manifesto — o login autenticava e não tinha como voltar pro app. Corrigido
  com `npx expo prebuild --clean --platform android`.
- **`--clean` apaga configuração local da máquina.** `android/local.properties`
  (caminho do Android SDK) precisou ser recriado à mão depois do prebuild — ele
  não é gerado automaticamente e não é versionado.
- **Java 26 quebra o build do Android.** O Gradle pegou o JDK padrão do sistema
  (26) e o plugin do Android não suporta — erro em
  `JdkImageTransform`/`jlink`. Corrigido forçando `JAVA_HOME` para o Java 21
  instalado na máquina.
- **`redirect_uri_mismatch`** — a URI de callback do Supabase
  (`https://<ref>.supabase.co/auth/v1/callback`) precisa estar cadastrada
  **exatamente** em Google Cloud Console → Credentials → o OAuth client →
  Authorized redirect URIs.
- **Chave errada no `.env` duas vezes** — a variável de ambiente ainda se
  chama `EXPO_PUBLIC_SUPABASE_ANON_KEY` por herança do nome antigo do Supabase;
  o valor certo hoje é a **publishable key** (`sb_publishable_...`), não a
  **secret key** (`sb_secret_...`, que ignora RLS e nunca deve ir num app) nem
  a legacy `anon` JWT.
- **Login com Google exige que o consent screen esteja publicado**, ou que
  cada e-mail de teste seja cadastrado manualmente em *Test users* (limite de
  100). Publicar de verdade (sem esse limite) exige homepage + política de
  privacidade + termos de uso num domínio **verificado** — e domínios de
  sufixo público como `github.io` são rejeitados pelo Google nesse passo.
  Decisão: por ora, cadastrar e-mails como test user; domínio próprio fica para
  quando passar de ~100 usuários.

## Ordem sugerida

**09 → 10 → 01 → 02 → 03**, que é onde mora o dano real ao usuário. O 09 e o 10
vêm primeiro por serem de uma linha cada e destravarem cenários que atrapalham
testar o resto.

Depois **04 → 05 → 06** (robustez). O **08** anda junto de 01 e 02, porque os
testes cobrem exatamente esses dois. O **07** fica por último: depende de setup
externo (Google Cloud + Supabase) e de um build de dev client para ser testado.

## Regra que vale para todos

Nada aqui muda aparência ou fluxo de navegação. A única exceção é a tela de
login no item 07, que perde o formulário — inevitável, já que não há mais senha
para digitar.

## Verificação global

Ao fim de cada item, e obrigatoriamente ao fim de todos:

- `npm run typecheck` limpo.
- `npm test` — os 476 testes atuais passando em 31 suítes.
- No dev client, rodar um treino inteiro (começar → marcar série → finalizar →
  tela de resultado) e navegar as quatro abas, confirmando que nada mudou de
  aparência ou de comportamento fora da tela de login.
- No Supabase, com dois usuários de teste, confirmar que nenhum enxerga dado do
  outro.

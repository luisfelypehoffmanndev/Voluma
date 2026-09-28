# 07 — Migração do login para conta Google

**Arquivos:** `src/sync/auth.ts`, `app/login.tsx`, `src/ui/icons.tsx`,
`README.md`, `package.json`, `app.json`
**Severidade:** decisão de produto (ver [`../DECISIONS.md`](../DECISIONS.md))
**Estado:** **feito** — testado no aparelho físico, login funcionando

## O que muda

O login por e-mail/senha sai e entra OAuth do Google via Supabase, sem conta
própria — mais simples e sem senha própria para vazar.

**O login continua opcional.** Quem não entrar segue usando o app 100% local, e
a tela continua sendo alcançada pelo Perfil, nunca imposta no boot.

Esta é a **única** parte do conjunto de correções que toca aparência, e só na
tela de login, que perde o formulário. É inevitável: não há mais senha para
digitar.

## Dependências

```bash
npx expo install expo-web-browser expo-auth-session
```

O plugin `expo-web-browser` entra sozinho no `app.json`. O `scheme: "voluma"` já
existe e é o redirect usado — nada a criar ali.

## `src/sync/auth.ts`

`signIn` e `signUp` saem do tipo `AuthState` e da store, substituídos por
`signInWithGoogle(): Promise<string | null>` — mesma convenção de retorno do que
existia: `null` em sucesso, mensagem em erro.

Fluxo:

1. `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } })`
2. `WebBrowser.openAuthSessionAsync(data.url, redirectTo)`
3. `getQueryParams(result.url)` — de `expo-auth-session/build/QueryParams`
4. `supabase.auth.setSession({ access_token, refresh_token })`
5. `runSync()`

`WebBrowser.maybeCompleteAuthSession()` no topo do módulo.

**Cancelamento não é erro.** Se `result.type !== 'success'`, retornar `null` —
desistir do login não deve virar mensagem vermelha na tela.

A função `translate()` perde as mensagens de senha incorreta, e-mail já
cadastrado e e-mail inválido, que deixam de existir. Sobra o caso de rede.

## `app/login.tsx`

Os dois `TextInput` e os botões "Entrar" / "Criar conta com este e-mail" viram
um botão único, "Continuar com Google".

Mantém o padrão da casa: erro em texto branco (o brief proíbe cor de estado) e
`PressableSurface` com `radius.pill`, como os outros botões primários.

## `src/ui/icons.tsx`

Novo `GoogleIcon`: o "G" em cor única. Monocromático de propósito — o arquivo
inteiro é outline sem preenchimento colorido, e a variante mono é justamente a
que o guia de marca do Google permite sobre botão escuro.

## `README.md`

A seção "Nuvem (opcional)" perde o passo que manda desativar "Confirm email".
Ele sai junto com o e-mail/senha, e era um risco por si: com a confirmação
desligada, qualquer pessoa consegue se cadastrar usando o e-mail de outra.

Entra uma subseção "Login com Google" com o setup externo, documentando
explicitamente que **não funciona no Expo Go** — o scheme `voluma://` não está
registrado lá. Exige dev client (`eas build --profile development`) ou
`npx expo run:android` / `npx expo run:ios`.

## Setup externo (feito pelo usuário, não pelo código)

1. **Google Cloud Console** → criar credencial *OAuth client ID* do tipo **Web
   application**, com a URL de callback que o Supabase informa.
2. **Supabase** → Authentication → Providers → Google: ativar e colar Client ID
   e Client Secret.
3. **Supabase** → Authentication → URL Configuration → Redirect URLs: adicionar
   `voluma://`.

## Verificar

- `npm run typecheck` e `npm test` limpos.
- No dev client: Perfil → Nuvem → Entrar → "Continuar com Google". Confirmar que
  volta logado e que o e-mail aparece no card de Nuvem.
- Cancelar no meio do fluxo do Google: deve voltar ao app **sem** mensagem de
  erro.
- Confirmar que o app continua utilizável sem login nenhum (modo local).
- Fechar e reabrir o app: a sessão precisa persistir (AsyncStorage).

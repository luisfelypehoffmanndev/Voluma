# 03 — `signOut()` corre com um sync em voo

**Arquivos:** `src/sync/auth.ts:96` (`signOut`), `src/sync/engine.ts`
**Severidade:** vazamento de dados entre contas — crítico no cenário academia
**Estado:** **feito**

## Problema

```ts
signOut: async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
  // Limpa o banco local: deixar os dados de uma conta visiveis para a
  // proxima seria pior do que perder o cache, que o pull reconstroi.
  await resetDb();
  ...
}
```

O `signOut` não verifica se há ciclo de sync rodando. O listener de `AppState`
(`useSyncLifecycle`, `src/sync/auth.ts:127`) dispara `runSync()` sempre que o app
volta do background — que é justamente quando o usuário vai mexer no Perfil.

Se um ciclo estiver no ar, ele ainda segura o `userId` antigo, e o `pull()`
continua fazendo `INSERT OR REPLACE` **depois** do `resetDb()`. O resultado é o
oposto do que o comentário promete: dados da conta anterior ficam no aparelho,
visíveis para quem logar em seguida.

Com uma pessoa só isso é invisível. Numa academia, é treino de um caindo na
conta de outro.

## Correção

Duas peças, porque uma só não basta.

**1. Esperar o ciclo em voo.** O `engine.ts` ganha `inFlightSync()`, que devolve
a promise `running` ou `null`. Repare que `sync()` **não** serve aqui: ela
*inicia* um ciclo quando não há nenhum, que é o contrário do que se quer no
logout.

No `signOut`, aguardar essa promise (engolindo o erro — ali não importa) antes
do `resetDb()`, e **depois** do `supabase.auth.signOut()`: a partir dali
qualquer ciclo novo cai no `getUser() → null → IDLE`.

**2. Guard de geração.** Só o await já quase fecha a janela, mas a garantia
passaria a depender do comportamento interno do supabase-js, que muda sem
avisar. Então o `engine.ts` também ganha um contador de geração e um
`invalidateSync()`, chamado no signOut. O `pull()` captura a geração no início
e, em cada tabela, confere logo depois do `await` da rede e antes de abrir a
transação — se mudou, desiste sem escrever.

São ~4 linhas e tornam a correção auto-evidente para quem ler depois.

O `push()` não precisa de guard: ele só envia dados do próprio usuário para a
conta dele.

## Verificar

- `npm run typecheck` e `npm test` limpos.
- No app: registrar séries offline, restaurar a rede, mandar o app para o
  background e trazer de volta (dispara sync), e tocar "Sair" durante o sync.
  Depois do logout, o histórico precisa estar **vazio**.
- Logar com outra conta em seguida e confirmar que nada da conta anterior
  aparece.

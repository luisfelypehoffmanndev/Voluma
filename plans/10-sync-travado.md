# 10 — Uma falha de rede desliga o sync até o app reiniciar

**Arquivos:** `src/sync/engine.ts:48` (`runCycle`), `src/sync/auth.ts:106` (`runSync`)
**Severidade:** alta num app usado dentro de academia, onde cair a rede é rotina
**Estado:** **feito**

## Problema

São dois defeitos que sozinhos seriam pequenos, mas se encaixam.

**1. O `getUser()` está fora do `try`.** Em `runCycle()`:

```ts
const { data: auth } = await supabase.auth.getUser();   // fora do try
const userId = auth.user?.id;
if (!userId) return IDLE;

try {
  const pushed = await push(userId);
  ...
} catch (error) {
  // "Falha de rede e o caso normal, nao excecao"
  return { pushed: 0, pulled: 0, error: describe(error) };
}
```

Todo o resto do ciclo trata falha de rede como caso normal — o comentário do
próprio arquivo diz isso. Mas o `getUser()` não: se ele falhar, `sync()`
**rejeita** em vez de devolver um `SyncOutcome` com erro.

**2. O `syncing` só volta a `false` no caminho feliz.** Em `runSync()`:

```ts
if (get().syncing) return;
set({ syncing: true });
const outcome = await sync();        // se isto rejeitar...
set({ syncing: false, lastSync: outcome });   // ...isto nunca roda
```

## O efeito combinado

Uma única falha de rede no `getUser()` deixa `syncing: true` preso. Como
`runSync()` começa com `if (get().syncing) return;`, **todo sync futuro vira
no-op** — a outbox para de drenar em silêncio, sem erro na tela, até o app ser
reiniciado.

É exatamente o cenário do app: treino registrado dentro da academia sem sinal,
que depois nunca sobe.

## Correção

- Mover o `await supabase.auth.getUser()` para dentro do `try` do `runCycle`,
  para que falha ali vire `SyncOutcome` com erro como qualquer outra.
- Envolver o corpo do `runSync` em `try/finally`, com `set({ syncing: false })`
  no `finally`, para que o flag sempre seja liberado.

## Verificar

- `npm run typecheck` e `npm test` limpos.
- Em dev, simular falha de rede no momento do `getUser()` (modo avião no meio do
  ciclo), e confirmar que um sync posterior, com rede de volta, **roda** em vez
  de ser ignorado.
- Conferir que o card de Nuvem no Perfil volta de "sincronizando…" para o estado
  normal depois da falha, em vez de ficar preso.

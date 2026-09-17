# 06 — `onAuthStateChange` nunca é desinscrito

**Arquivo:** `src/sync/auth.ts:53` (`bootstrap`)
**Severidade:** baixa, quase só em desenvolvimento
**Estado:** aberto

## Problema

```ts
supabase.auth.onAuthStateChange((_event, session) => applySession(set, session));
```

A subscription devolvida é descartada. Se `bootstrap()` rodar mais de uma vez na
mesma sessão do app — Fast Refresh em dev, ou `useSyncLifecycle` montado de mais
de um lugar — cada chamada registra um listener novo, sem nunca remover o
anterior. Eles acumulam pelo resto da vida do app, e `applySession()` passa a
disparar repetidamente a cada evento de auth.

Em produção o `bootstrap()` roda uma vez só, então o impacto prático é
essencialmente de desenvolvimento. Ainda assim é vazamento silencioso, do tipo
que só aparece quando alguém adiciona um segundo ponto de montagem.

## Correção

Guardar a subscription em escopo de módulo e desinscrever a anterior antes de
registrar a nova.

## Verificar

- `npm run typecheck` e `npm test` limpos.
- Em dev, salvar o arquivo várias vezes (forçando Fast Refresh) e confirmar que
  o estado de auth continua consistente, sem reprocessamento repetido.

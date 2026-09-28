# 09 — `getDb()` cacheia promise rejeitada

**Arquivo:** `src/db/client.ts:18`
**Severidade:** transforma falha passageira em falha permanente
**Estado:** **feito**

## Problema

```ts
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= open();
  return dbPromise;
}
```

O `??=` cacheia a promise, que é exatamente a intenção — chamadas concorrentes
durante a abertura compartilham o mesmo trabalho. O problema é que ele cacheia
também quando ela **rejeita**: se `open()` falhar uma única vez, `dbPromise`
guarda a promise rejeitada para sempre e todo `getDb()` seguinte devolve a mesma
rejeição, mesmo que a causa tenha sido momentânea.

O app só volta a funcionar se for fechado e reaberto. Como toda leitura e toda
escrita passam por `getDb()`, isso significa app inutilizado.

Isso agrava todos os outros bugs de banco — em particular o
[02](02-migrations-atomicas.md), onde uma migration interrompida passa a falhar
em toda abertura.

## Correção

Limpar `dbPromise = null` quando `open()` falhar, para a próxima chamada poder
tentar de novo. O caminho feliz continua idêntico: uma abertura, compartilhada.

## Verificar

- `npm run typecheck` e `npm test` limpos.
- Em dev, forçar `open()` a lançar uma vez e confirmar que uma chamada seguinte
  a `getDb()` tenta abrir de novo em vez de repetir a rejeição.

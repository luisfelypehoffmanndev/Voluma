# 05 — `push()` sem chunking no `IN (...)`

**Arquivo:** `src/sync/engine.ts:90`
**Severidade:** baixa
**Estado:** aberto

## Problema

```ts
const placeholders = ids.map(() => '?').join(',');
const rows = await db.getAllAsync<Record<string, unknown>>(
  `SELECT * FROM ${table} WHERE id IN (${placeholders})`,
  ...ids,
);
```

Um bind por linha pendente, sem limite. O SQLite que o Expo embarca aceita 32766
parâmetros (e não os 999 das versões antigas), então o risco real é pequeno —
seria preciso mais de 32 mil linhas editadas offline sem nenhum sync.

Mas o limite não é tratado. Se estourar, a query lança, o ciclo inteiro reporta
erro genérico, e **o próximo ciclo monta exatamente a mesma query** — a fila
daquela tabela nunca drena, em silêncio.

Vale notar que o projeto já reconhece esse limite em outro lugar:
`src/db/repo.ts:1113` comenta o `SQLITE_MAX_VARIABLE_NUMBER` ao montar um INSERT
multi-linha, argumentando que ali sobra folga. Aqui não há esse argumento, porque
a outbox não tem teto.

## Correção

Processar os ids em lotes (500 é um tamanho confortável), tanto no `SELECT`
local quanto no `upsert` remoto.

**Cuidado com a marca de água:** a limpeza da outbox
(`DELETE FROM outbox WHERE table_name = ? AND seq <= ?`) não pode acontecer por
lote. Ela usa o `MAX(seq)` da tabela inteira e só é correta depois que todos os
lotes daquela tabela subiram — apagar antes perderia linhas se um lote
intermediário falhasse.

## Verificar

- `npm run typecheck` e `npm test` limpos.
- Sync normal (poucas linhas) continua funcionando: um treino registrado offline
  sobe ao voltar a rede.
- Se quiser exercitar o caminho de lote, baixar temporariamente o tamanho do
  lote para 2 em dev e confirmar que uma fila de várias linhas sobe inteira e a
  outbox fica vazia ao final.

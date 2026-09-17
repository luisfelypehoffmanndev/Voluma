# 02 — Migrations não são atômicas nem retomáveis

**Arquivos:** `src/db/client.ts:135` (`migrate`), `src/db/schema.ts:15` (`MIGRATIONS`)
**Severidade:** baixa probabilidade, dano alto e irreversível
**Estado:** aberto

## Problema

```ts
for (let version = current; version < MIGRATIONS.length; version += 1) {
  await db.execAsync(MIGRATIONS[version]);
}
await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
```

Cada migration roda fora de transação, e o `user_version` só é gravado depois do
loop inteiro. Se o SO matar o app no meio — backgrounding ou pouca memória,
rotina em celular — o `user_version` não subiu, e no próximo boot a migration
recomeça do zero.

Aí a v3 tenta `ALTER TABLE exercises ADD COLUMN kind` numa tabela que já tem a
coluna. O SQLite recusa com "duplicate column name" (não existe
`ADD COLUMN IF NOT EXISTS`), `getDb()` lança, e — somado ao
[09](09-getdb-promise-rejeitada.md) — passa a lançar para sempre. **O app não
abre mais o banco local, sem saída para o usuário.**

## Correção

Uma transação **por migration**, gravando `PRAGMA user_version = version + 1`
dentro dela. Ou a migration inteira entra e a versão sobe junto, ou nada entra.

Isso funciona — foi verificado:

- **DDL é transacional no SQLite.** `ALTER TABLE`, `CREATE TABLE`,
  `CREATE INDEX`, `DROP TABLE` fazem rollback. O `CREATE TEMP TABLE` da v2
  também: o banco `temp` participa da transação.
- **`PRAGMA user_version` é transacional.** Ele mora nos bytes 60–63 do header
  do arquivo, escrito pelo pager como qualquer página — entra no WAL e faz
  rollback junto.

### Três ajustes que isso exige

**1. Tirar os PRAGMAs de `MIGRATIONS[0]`.** `PRAGMA journal_mode = WAL` e
`PRAGMA foreign_keys = ON` passam para o `open()`, executados a cada abertura de
conexão. É obrigatório — `journal_mode` dá erro dentro de transação e
`foreign_keys` vira no-op silencioso lá dentro.

E isso **corrige um bug latente**: `journal_mode` é persistente (fica no header
do arquivo, reaplicar é no-op barato), mas `foreign_keys` é **por conexão** e
volta a OFF em toda abertura. Hoje ele só valeu no boot em que a v1 rodou, e
nunca mais. Inócuo por ora, porque nenhuma tabela declara `REFERENCES` — mas é
uma armadilha guardada para quem adicionar a primeira.

**2. Inverter a ordem de `serializeTransactions` e `migrate`.** Hoje `open()`
faz `migrate(db)` **antes** de `serializeTransactions(db)`, então a migration
usaria a `withTransactionAsync` bugada da biblioteca — a que o próprio arquivo
documenta em detalhe (issue expo/expo#49281). Inverter é seguro:
`serializeTransactions` só troca um método e devolve o mesmo objeto, e
`dbPromise` ainda não resolveu, então ninguém mais toca no banco nesse instante.

**3. Extrair `pendingMigrations()`.** A decisão "quais migrations faltam" vira
função pura, testável (ver [08](08-testes-puros.md)).

## Reparar quem já quebrou

A correção acima protege o futuro, mas um aparelho que **já** morreu no meio de
uma migration tem `user_version = 0` com o schema adiantado: no próximo boot a
v3 falha igual e ele segue travado. Como o app vai para uma academia inteira,
vale a ponte.

Quando o header disser 0, deduzir a versão real pelo schema (`sqlite_master` /
`PRAGMA table_info`):

| Condição | Versão deduzida |
|---|---|
| sem a tabela `exercises` | 0 |
| sem a tabela `week_targets` | 1 |
| sem a coluna `exercises.kind` | 2 |
| sem a coluna `sessions.completed_at` | 3 |
| caso contrário | 4 |

São ~10 linhas e só rodam quando o header diz 0. Imperfeito apenas para quem
morreu no meio da v2 — pula a deduplicação de rotinas, que é cosmética e não
impede o app de abrir.

## Verificar

- Testes de [08](08-testes-puros.md).
- Em dev, forçar um throw no meio de uma migration e confirmar que o app se
  recupera no boot seguinte em vez de travar.
- Num banco já existente (com dados), confirmar que o boot não roda migration
  nenhuma e que o histórico continua intacto.

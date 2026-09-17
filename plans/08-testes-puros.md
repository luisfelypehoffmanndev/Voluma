# 08 — Testes puros das correções 01 e 02

**Arquivos:** `src/db/__tests__/` (novos)
**Acompanha:** [01](01-corrida-errada.md) e [02](02-migrations-atomicas.md)
**Estado:** aberto

## Contexto da decisão

Hoje **nenhum teste do projeto abre banco**. O `src/db/__tests__/catalog.test.ts`
testa só funções puras de `src/db/catalog.ts`; não há mock de `expo-sqlite` no
projeto nem no preset `jest-expo`. Todos os 187 testes seguem esse padrão: só
lógica pura.

Testar migrations ou repositório de verdade exigiria criar infraestrutura nova
(shim de `expo-sqlite` sobre `better-sqlite3`, por exemplo) e mantê-la. Decidido
**não** fazer isso: em vez disso, a decisão de cada bug é extraída como função
pura e testada no padrão que já existe.

## 8.1 — `pickCanonicalRun(rows)`

Extraída de `ensureRunExercise` ([01](01-corrida-errada.md)). Recebe as linhas
`kind='run'` não apagadas e devolve a que deve ser usada, ou `null` quando é
preciso criar a Corrida.

Casos:

| Entrada | Esperado |
|---|---|
| `[]` | `null` |
| só `Caminhada` | `null` — **é o bug 01** |
| `Corrida` + `Caminhada` | `Corrida` |
| duas `Corrida` (duplicata de sync) | a mais antiga por `updated_at` |
| duas `Corrida` com mesmo `updated_at` | desempate por `id` |

## 8.2 — `pendingMigrations(current)`

Extraída de `migrate` ([02](02-migrations-atomicas.md)). Devolve os índices das
migrations que ainda faltam rodar.

Casos:

| Entrada | Esperado |
|---|---|
| `0` | todas |
| `2` | as duas últimas |
| `SCHEMA_VERSION` | nenhuma |
| maior que `SCHEMA_VERSION` | nenhuma (banco de versão futura, não regride) |

**Mais um teste de guarda:** afirmar que `SCHEMA_VERSION === MIGRATIONS.length`.
Hoje ambos valem 4. Quem adicionar uma migration esquecendo de subir a versão
quebra o teste — em vez de quebrar o app do usuário, que é onde isso apareceria
hoje.

## Verificar

- `npm test` — os 187 testes atuais continuam passando, mais estes.
- Conferir que os testes novos **falham** se a correção for revertida (em
  particular o caso "só Caminhada → null", que é o bug 01 em forma de teste).

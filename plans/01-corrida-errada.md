# 01 — "Adicionar corrida" põe o exercício errado no dia

**Arquivo:** `src/db/repo.ts:143` (`ensureRunExercise`)
**Severidade:** bug visível ao usuário
**Estado:** aberto

## Problema

```sql
SELECT * FROM exercises WHERE kind = 'run' AND deleted_at IS NULL
 ORDER BY (name = 'Corrida') DESC, updated_at, id LIMIT 1
```

A query filtra por `kind = 'run'` e apenas **ordena** por `(name = 'Corrida')`.
Ordenação só desempata entre candidatos que já existem.

`kind='run'` deixou de ser exclusivo da corrida: caminhada, bicicleta e remo
também entram, porque `kindFor()` classifica assim tudo que é
`distance_duration` ou `equipment: 'Cardio'` (`src/movements/taxonomy.ts:172`).

Então quando o usuário adiciona "Caminhada" pela biblioteca e **nunca** criou
"Corrida", existe um único candidato, o `LIMIT 1` devolve Caminhada, e o botão
"Adicionar corrida" da tela do dia (`app/day/[weekday].tsx:83`, único chamador)
põe **caminhada** no dia.

É exatamente o caso que o comentário da própria função diz prevenir — a correção
que ele descreve não se aplica quando a Corrida está ausente.

## Correção

A query passa a trazer os candidatos `kind='run'` não apagados, e a decisão de
qual usar sai do SQL para `pickCanonicalRun()`, função pura (ver
[08](08-testes-puros.md)). O conjunto é minúsculo, não há custo em trazer todas
as linhas.

Regra da função: prefere `name = 'Corrida'`; se não houver, devolve `null` e o
chamador cria via `createExercise('Corrida', 'Cardio', 'run')`, como já faz hoje.
Duplicatas vindas do sync desempatam por `updated_at`, com `id` como critério
final.

Atualizar o comentário da função: ele descreve o desempate por ordenação, que
deixa de existir.

## Efeito colateral aceito

Se o usuário **renomear** "Corrida", o botão passa a criar uma Corrida nova em
vez de reusar a renomeada. Decidido que é aceitável: o exercício já nasce sob
demanda por design, e some de vez se apagado — o comentário da função diz isso
explicitamente.

## Verificar

- Testes de [08](08-testes-puros.md).
- No app: com Caminhada adicionada pela biblioteca e sem nenhuma Corrida, tocar
  "Adicionar corrida" na tela do dia e confirmar que entra **Corrida**.
- Com Corrida e Caminhada no banco, confirmar que continua escolhendo Corrida.

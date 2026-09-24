import { MIGRATIONS, SCHEMA_VERSION, pendingMigrations } from '../schema';

describe('pendingMigrations', () => {
  it('roda todas num banco novo', () => {
    expect(pendingMigrations(0)).toEqual([0, 1, 2, 3, 4]);
  });

  it('roda so o que falta num banco parcialmente migrado', () => {
    expect(pendingMigrations(2)).toEqual([2, 3, 4]);
  });

  it('nao roda nada num banco em dia', () => {
    expect(pendingMigrations(SCHEMA_VERSION)).toEqual([]);
  });

  // Usuario que voltou para uma build antiga: o banco esta adiantado. Migration
  // para tras nao existe, e reaplicar DDL por cima quebraria o banco dele.
  it('nao roda nada num banco de versao futura', () => {
    expect(pendingMigrations(SCHEMA_VERSION + 1)).toEqual([]);
  });
});

// Esquecer de subir a SCHEMA_VERSION ao acrescentar uma migration nao da erro
// em lugar nenhum — a migration simplesmente nunca roda no aparelho de quem ja
// tinha o app. Este teste e o unico lugar onde isso aparece.
it('SCHEMA_VERSION acompanha a quantidade de migrations', () => {
  expect(SCHEMA_VERSION).toBe(MIGRATIONS.length);
});

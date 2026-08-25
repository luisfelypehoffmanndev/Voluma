import { COMMON_EXERCISES, MUSCLE_GROUPS, normalizeName } from '../catalog';

/**
 * O catalogo comum e uma lista escrita a mao, e a unica coisa que impede
 * duplicata nele e a disciplina de quem edita. Um sinonimo acrescentado sem
 * querer ("Pulley frente" ao lado de "Puxada alta") nao quebra nada na hora:
 * quebra depois, no historico, que e por exercicio — a carga de um movimento
 * fica dividida entre duas linhas que o app trata como movimentos diferentes.
 */
describe('catálogo comum', () => {
  it('não tem nome duplicado, nem por acento ou caixa', () => {
    const seen = new Map<string, string>();
    for (const item of COMMON_EXERCISES) {
      const key = normalizeName(item.name);
      const clash = seen.get(key);
      expect(clash ? `${clash} / ${item.name}` : null).toBeNull();
      seen.set(key, item.name);
    }
  });

  it('só usa grupos musculares conhecidos', () => {
    for (const item of COMMON_EXERCISES) {
      expect(MUSCLE_GROUPS).toContain(item.muscleGroup);
    }
  });

  it('cobre todo grupo de musculação', () => {
    const used = new Set(COMMON_EXERCISES.map((item) => item.muscleGroup));
    for (const group of MUSCLE_GROUPS) {
      // Cardio fica de fora: a corrida e o unico `kind: 'run'` do app e nasce
      // sob demanda em `ensureRunExercise`, nao por esta lista.
      if (group === 'Cardio') continue;
      expect(used.has(group)).toBe(true);
    }
  });
});

describe('normalizeName', () => {
  it('ignora acento, caixa e espaço nas pontas', () => {
    expect(normalizeName('Tríceps corda')).toBe(normalizeName('  triceps CORDA '));
    expect(normalizeName('Abdômen')).toBe('abdomen');
    expect(normalizeName('Búlgaro')).toBe('bulgaro');
  });

  it('mantém movimentos diferentes diferentes', () => {
    expect(normalizeName('Supino reto')).not.toBe(normalizeName('Supino inclinado'));
  });
});

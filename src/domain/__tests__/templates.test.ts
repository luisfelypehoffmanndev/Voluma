import { COMMON_EXERCISES, normalizeName } from '../../db/catalog';
import { PUSH_PULL_LEGS, assignCycle } from '../templates';

describe('assignCycle', () => {
  it('tres dias viram push, pull, legs', () => {
    expect(assignCycle([1, 3, 5]).map((item) => [item.weekday, item.day.name.split(' ')[0]])).toEqual([
      [1, 'Push'],
      [3, 'Pull'],
      [5, 'Legs'],
    ]);
  });

  it('seis dias repetem o ciclo', () => {
    const names = assignCycle([1, 2, 3, 4, 5, 6]).map((item) => item.day.name.split(' ')[0]);
    expect(names).toEqual(['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs']);
  });

  it('conta a semana a partir da segunda, com domingo por ultimo', () => {
    expect(assignCycle([0, 2, 4]).map((item) => item.weekday)).toEqual([2, 4, 0]);
  });

  it('ignora dia repetido e lista vazia', () => {
    expect(assignCycle([1, 1, 3])).toHaveLength(2);
    expect(assignCycle([])).toEqual([]);
  });
});

describe('PUSH_PULL_LEGS', () => {
  it('so usa exercicios do catalogo comum, para nao criar duplicata', () => {
    const known = new Set(COMMON_EXERCISES.map((item) => normalizeName(item.name)));
    for (const day of PUSH_PULL_LEGS) {
      for (const exercise of day.exercises) {
        expect(known.has(normalizeName(exercise.name))).toBe(true);
      }
    }
  });
});

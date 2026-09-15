import { workoutState } from '../today';

const set = (exerciseId: string, done: boolean) => ({ exerciseId, done });

describe('workoutState', () => {
  it('dia com plano e nada marcado ainda nao comecou', () => {
    expect(
      workoutState({
        plannedExerciseIds: ['a', 'b', 'c'],
        sets: [],
        skippedExerciseIds: [],
        completed: false,
      }),
    ).toEqual({ kind: 'notStarted', total: 3, done: 0, progress: 0 });
  });

  it('series gravadas mas desmarcadas ainda nao sao comeco', () => {
    const state = workoutState({
      plannedExerciseIds: ['a', 'b'],
      sets: [set('a', false), set('a', false)],
      skippedExerciseIds: [],
      completed: false,
    });
    expect(state.kind).toBe('notStarted');
  });

  it('conta exercicios, nao series', () => {
    const state = workoutState({
      plannedExerciseIds: ['a', 'b', 'c', 'd', 'e'],
      sets: [set('a', true), set('a', true), set('a', true), set('b', true)],
      skippedExerciseIds: [],
      completed: false,
    });
    expect(state).toEqual({ kind: 'inProgress', total: 5, done: 2, progress: 0.4 });
  });

  it('pulado sai do total e dos concluidos', () => {
    const state = workoutState({
      plannedExerciseIds: ['a', 'b', 'c'],
      sets: [set('a', true), set('c', true)],
      skippedExerciseIds: ['c'],
      completed: false,
    });
    expect(state).toMatchObject({ kind: 'inProgress', total: 2, done: 1 });
  });

  it('exercicio adicionado so hoje entra no total', () => {
    const state = workoutState({
      plannedExerciseIds: ['a'],
      sets: [set('extra', true)],
      skippedExerciseIds: [],
      completed: false,
    });
    expect(state).toMatchObject({ kind: 'inProgress', total: 2, done: 1 });
  });

  it('sem plano e sem registro e descanso', () => {
    expect(
      workoutState({ plannedExerciseIds: [], sets: [], skippedExerciseIds: [], completed: false }),
    ).toEqual({ kind: 'rest', total: 0, done: 0, progress: 0 });
  });

  it('treino livre em andamento num dia de descanso nao e mais descanso', () => {
    const state = workoutState({
      plannedExerciseIds: [],
      sets: [set('x', false)],
      skippedExerciseIds: [],
      completed: false,
    });
    expect(state).toMatchObject({ kind: 'notStarted', total: 1 });
  });

  it('finalizado ganha de todo o resto, inclusive com pendentes', () => {
    const state = workoutState({
      plannedExerciseIds: ['a', 'b'],
      sets: [set('a', true)],
      skippedExerciseIds: [],
      completed: true,
    });
    expect(state).toEqual({ kind: 'completed', total: 2, done: 1, progress: 1 });
  });
});

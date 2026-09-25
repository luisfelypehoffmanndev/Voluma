/**
 * Em que pe esta o treino de hoje — o que decide o rotulo do botao da home.
 *
 * Logica pura, sem banco: a home passa o plano do dia, as series gravadas e o
 * que a sessao marcou como pulado ou finalizado.
 */

export type WorkoutState =
  /** Dia com treino e nada marcado ainda: "Começar treino · 5 exercícios". */
  | { kind: 'notStarted'; total: number; done: 0; progress: 0 }
  /** Algo marcado, nao finalizado: "Continuar treino · 2 de 5". */
  | { kind: 'inProgress'; total: number; done: number; progress: number }
  /** O usuario tocou em "Finalizar treino". */
  | { kind: 'completed'; total: number; done: number; progress: 1 }
  /** Nada no plano e nada registrado: "Treino livre". */
  | { kind: 'rest'; total: 0; done: 0; progress: 0 };

type Input = {
  plannedExerciseIds: readonly string[];
  sets: readonly { exerciseId: string; done: boolean }[];
  skippedExerciseIds: readonly string[];
  completed: boolean;
};

/**
 * O total e por EXERCICIO, nao por serie — e a unidade da caixa de concluido e
 * a que o usuario conta de cabeca.
 *
 * Entra no total: o que esta no plano e nao foi pulado, mais qualquer exercicio
 * gravado fora do plano (adicionado "so hoje"). Pulado sai dos dois lados, senao
 * "2 de 5" nunca chegaria a "5 de 5".
 */
export function workoutState({
  plannedExerciseIds,
  sets,
  skippedExerciseIds,
  completed,
}: Input): WorkoutState {
  const skipped = new Set(skippedExerciseIds);
  const exercises = new Set(plannedExerciseIds.filter((id) => !skipped.has(id)));
  for (const set of sets) {
    if (!skipped.has(set.exerciseId)) exercises.add(set.exerciseId);
  }

  const doneIds = new Set(
    sets.filter((set) => set.done && exercises.has(set.exerciseId)).map((set) => set.exerciseId),
  );

  const total = exercises.size;
  const done = doneIds.size;

  if (completed) return { kind: 'completed', total, done, progress: 1 };
  if (total === 0) return { kind: 'rest', total: 0, done: 0, progress: 0 };
  if (done === 0) return { kind: 'notStarted', total, done: 0, progress: 0 };
  return { kind: 'inProgress', total, done, progress: done / total };
}

/**
 * Como o dia se chama na tela: o rotulo que o usuario deu, ou o estado do dia
 * quando ele nao deu nenhum. `fallback` cobre o dia sem rotulo e sem exercicio
 * — "Descanso" no plano, "Treino livre" no calendario para um dia registrado.
 */
export function dayTitle(name: string, exerciseCount: number, fallback = 'Descanso'): string {
  const label = name.trim();
  if (label) return label;
  return exerciseCount === 0 ? fallback : 'Sem nome';
}

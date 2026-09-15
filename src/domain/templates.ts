import type { Weekday } from './types';

/**
 * Modelos de plano oferecidos no onboarding.
 *
 * Os nomes de exercicio sao os do catalogo comum (`COMMON_EXERCISES`), de
 * proposito: o modelo aponta para os MESMOS registros, e criar de novo daria
 * duplicata — o historico do app e por exercicio.
 *
 * Carga sempre 0. O app nao sabe quanto cada um levanta, e um peso inventado
 * viraria o "do seu plano" de alguem que nunca levantou aquilo. O usuario
 * ajusta no primeiro treino, e dali em diante a cascata herda o que ele fez.
 */

export type TemplateExercise = { name: string; sets: number; reps: number };
export type TemplateDay = { name: string; exercises: readonly TemplateExercise[] };

const PUSH: TemplateDay = {
  name: 'Push · peito, ombro, tríceps',
  exercises: [
    { name: 'Supino reto', sets: 4, reps: 8 },
    { name: 'Supino inclinado', sets: 3, reps: 10 },
    { name: 'Desenvolvimento', sets: 3, reps: 10 },
    { name: 'Elevação lateral', sets: 3, reps: 12 },
    { name: 'Tríceps corda', sets: 3, reps: 12 },
  ],
};

const PULL: TemplateDay = {
  name: 'Pull · costas, bíceps',
  exercises: [
    { name: 'Barra fixa', sets: 4, reps: 8 },
    { name: 'Remada curvada', sets: 4, reps: 10 },
    { name: 'Puxada alta', sets: 3, reps: 12 },
    { name: 'Face pull', sets: 3, reps: 15 },
    { name: 'Rosca direta', sets: 3, reps: 12 },
  ],
};

const LEGS: TemplateDay = {
  name: 'Legs · pernas',
  exercises: [
    { name: 'Agachamento livre', sets: 4, reps: 8 },
    { name: 'Leg press', sets: 4, reps: 12 },
    { name: 'Stiff', sets: 3, reps: 10 },
    { name: 'Cadeira flexora', sets: 3, reps: 12 },
    { name: 'Panturrilha em pé', sets: 4, reps: 15 },
  ],
};

/** A ordem do ciclo: empurrar, puxar, pernas, e recomeca. */
export const PUSH_PULL_LEGS: readonly TemplateDay[] = [PUSH, PULL, LEGS];

/** Segunda, quarta e sexta: o padrao de quem treina tres vezes com um dia de folga entre. */
export const DEFAULT_TRAINING_DAYS: readonly Weekday[] = [1, 3, 5];

/**
 * Distribui o ciclo pelos dias escolhidos, na ordem da semana comecando na
 * segunda — domingo fica por ultimo, que e como a semana de treino e contada.
 *
 * Tres dias viram Push, Pull, Legs; seis dias, o ciclo duas vezes; quatro,
 * Push, Pull, Legs, Push. Dia nao escolhido fica sem nada, e dia sem exercicio
 * e descanso no resto do app.
 */
export function assignCycle(
  days: readonly Weekday[],
  cycle: readonly TemplateDay[] = PUSH_PULL_LEGS,
): { weekday: Weekday; day: TemplateDay }[] {
  if (cycle.length === 0) return [];
  const mondayFirst = [...new Set(days)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  return mondayFirst.map((weekday, index) => ({ weekday, day: cycle[index % cycle.length] }));
}

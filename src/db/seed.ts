import type { Weekday } from '@/domain/types';

import { getDb } from './client';
import {
  addExerciseToRoutine,
  createExercise,
  createRoutine,
  listRoutines,
} from './repo';

/**
 * Plano inicial, criado uma unica vez em um banco vazio.
 *
 * Abrir o app numa tela sem nada e o pior primeiro contato possivel: o usuario
 * teria que cadastrar dez exercicios antes de ver qualquer numero. Isso da um
 * ponto de partida editavel — nada aqui e obrigatorio manter.
 */

type SeedRoutine = {
  name: string;
  weekday: Weekday;
  exercises: { name: string; muscleGroup: string; sets: number; reps: number; weightKg: number }[];
};

const PLAN: SeedRoutine[] = [
  {
    name: 'Costas + bíceps',
    weekday: 1,
    exercises: [
      { name: 'Barra fixa', muscleGroup: 'Costas', sets: 4, reps: 8, weightKg: 0 },
      { name: 'Remada curvada', muscleGroup: 'Costas', sets: 4, reps: 10, weightKg: 50 },
      { name: 'Puxada alta', muscleGroup: 'Costas', sets: 3, reps: 12, weightKg: 55 },
      { name: 'Rosca direta', muscleGroup: 'Bíceps', sets: 3, reps: 12, weightKg: 25 },
    ],
  },
  {
    name: 'Pernas',
    weekday: 3,
    exercises: [
      { name: 'Agachamento livre', muscleGroup: 'Pernas', sets: 4, reps: 8, weightKg: 80 },
      { name: 'Leg press', muscleGroup: 'Pernas', sets: 4, reps: 12, weightKg: 140 },
      { name: 'Cadeira flexora', muscleGroup: 'Pernas', sets: 3, reps: 12, weightKg: 45 },
      { name: 'Panturrilha em pé', muscleGroup: 'Pernas', sets: 4, reps: 15, weightKg: 60 },
    ],
  },
  {
    name: 'Peito + tríceps',
    weekday: 5,
    exercises: [
      { name: 'Supino reto', muscleGroup: 'Peito', sets: 4, reps: 8, weightKg: 70 },
      { name: 'Supino inclinado', muscleGroup: 'Peito', sets: 3, reps: 10, weightKg: 55 },
      { name: 'Crucifixo', muscleGroup: 'Peito', sets: 3, reps: 12, weightKg: 16 },
      { name: 'Tríceps corda', muscleGroup: 'Tríceps', sets: 3, reps: 12, weightKg: 30 },
    ],
  },
];

/** Popula o plano padrao apenas se ainda nao existir nenhuma rotina. */
export async function seedIfEmpty(): Promise<boolean> {
  const existing = await listRoutines();
  if (existing.length > 0) return false;

  // Um banco sem rotinas mas com exercicios significa que o usuario apagou
  // tudo de proposito — nao repovoar por cima dessa decisao.
  const db = await getDb();
  const anyExercise = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM exercises',
  );
  if ((anyExercise?.count ?? 0) > 0) return false;

  for (const plan of PLAN) {
    const routine = await createRoutine(plan.name, plan.weekday);
    for (const item of plan.exercises) {
      const exercise = await createExercise(item.name, item.muscleGroup);
      await addExerciseToRoutine(routine.id, exercise.id, {
        sets: item.sets,
        reps: item.reps,
        weightKg: item.weightKg,
      });
    }
  }

  return true;
}

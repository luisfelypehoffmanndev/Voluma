import type { Weekday } from '@/domain/types';

import { addMissingCommonExercises, normalizeName } from './catalog';
import { getDb } from './client';
import { addExerciseToRoutine, createExercise, createRoutine, listExercises, listRoutines } from './repo';

/**
 * Plano inicial, criado uma unica vez em um banco vazio.
 *
 * Abrir o app numa tela sem nada e o pior primeiro contato possivel: o usuario
 * teria que cadastrar dez exercicios antes de ver qualquer numero. Isso da um
 * ponto de partida editavel — nada aqui e obrigatorio manter.
 *
 * O catalogo inteiro entra junto (`addMissingCommonExercises`), nao so os doze
 * do plano: montar o segundo dia de treino nao pode exigir digitar nome de
 * exercicio. Os do plano abaixo sao referenciados por nome, e portanto sao os
 * MESMOS registros do catalogo — criar de novo aqui daria duplicata, e o
 * historico do app e por exercicio.
 */

type SeedRoutine = {
  name: string;
  weekday: Weekday;
  exercises: { name: string; sets: number; reps: number; weightKg: number }[];
};

const PLAN: SeedRoutine[] = [
  {
    name: 'Costas + bíceps',
    weekday: 1,
    exercises: [
      { name: 'Barra fixa', sets: 4, reps: 8, weightKg: 0 },
      { name: 'Remada curvada', sets: 4, reps: 10, weightKg: 50 },
      { name: 'Puxada alta', sets: 3, reps: 12, weightKg: 55 },
      { name: 'Rosca direta', sets: 3, reps: 12, weightKg: 25 },
    ],
  },
  {
    name: 'Pernas',
    weekday: 3,
    exercises: [
      { name: 'Agachamento livre', sets: 4, reps: 8, weightKg: 80 },
      { name: 'Leg press', sets: 4, reps: 12, weightKg: 140 },
      { name: 'Cadeira flexora', sets: 3, reps: 12, weightKg: 45 },
      { name: 'Panturrilha em pé', sets: 4, reps: 15, weightKg: 60 },
    ],
  },
  {
    name: 'Peito + tríceps',
    weekday: 5,
    exercises: [
      { name: 'Supino reto', sets: 4, reps: 8, weightKg: 70 },
      { name: 'Supino inclinado', sets: 3, reps: 10, weightKg: 55 },
      { name: 'Crucifixo', sets: 3, reps: 12, weightKg: 16 },
      { name: 'Tríceps corda', sets: 3, reps: 12, weightKg: 30 },
    ],
  },
];

/** Popula catalogo e plano padrao apenas se ainda nao existir nenhuma rotina. */
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

  await addMissingCommonExercises();

  const catalog = await listExercises();
  const byName = new Map(catalog.map((exercise) => [normalizeName(exercise.name), exercise.id]));

  for (const plan of PLAN) {
    const routine = await createRoutine(plan.name, plan.weekday);
    for (const item of plan.exercises) {
      // O `??` cobre o caso de alguem tirar um nome do catalogo comum e esquecer
      // do plano: o dia continua nascendo completo, so com um exercicio novo.
      const exerciseId =
        byName.get(normalizeName(item.name)) ?? (await createExercise(item.name)).id;
      await addExerciseToRoutine(routine.id, exerciseId, {
        sets: item.sets,
        reps: item.reps,
        weightKg: item.weightKg,
        distanceKm: 0,
        durationMin: 0,
      });
    }
  }

  return true;
}

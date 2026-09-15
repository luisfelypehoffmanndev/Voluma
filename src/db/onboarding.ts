import type { Weekday } from '@/domain/types';
import { assignCycle } from '@/domain/templates';

import { addMissingCommonExercises, normalizeName } from './catalog';
import { getDb } from './client';
import {
  addExerciseToRoutine,
  createExercise,
  ensureDayRoutine,
  listExercises,
  updateRoutine,
} from './repo';

/**
 * O que o onboarding grava. Substitui o antigo `seedIfEmpty`, que criava um
 * plano de exemplo as escondidas na primeira abertura — o usuario caia numa
 * home com "Costas + biceps" na segunda sem nunca ter escolhido aquilo.
 */

/**
 * Primeira abertura: nenhuma rotina e nenhum exercicio.
 *
 * E a mesma guarda que o seed usava, e pelo mesmo motivo: um banco sem rotinas
 * mas COM exercicios e de alguem que apagou o plano de proposito, e reabrir o
 * onboarding por cima dessa decisao seria o app discordando do usuario. Sair
 * da conta apaga o banco local, entao quem entra de novo passa por aqui outra
 * vez — e o comportamento certo para um aparelho que ficou vazio.
 */
export async function isFirstRun(): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ routines: number; exercises: number }>(
    `SELECT (SELECT COUNT(*) FROM routines WHERE deleted_at IS NULL) AS routines,
            (SELECT COUNT(*) FROM exercises) AS exercises`,
  );
  return (row?.routines ?? 0) === 0 && (row?.exercises ?? 0) === 0;
}

/**
 * "Montar do zero": so o catalogo comum. A semana fica vazia, mas escolher o
 * primeiro exercicio de um dia nunca exige digitar nome.
 */
export async function startEmpty(): Promise<void> {
  await addMissingCommonExercises();
}

/**
 * Push/Pull/Legs nos dias escolhidos (ver `assignCycle`), em cima do catalogo
 * comum. Os exercicios sao referenciados por nome, portanto sao os MESMOS
 * registros do catalogo.
 */
export async function createPushPullLegs(days: readonly Weekday[]): Promise<void> {
  await addMissingCommonExercises();

  const catalog = await listExercises();
  const byName = new Map(catalog.map((exercise) => [normalizeName(exercise.name), exercise.id]));

  for (const { weekday, day } of assignCycle(days)) {
    // `ensureDayRoutine`, e nao `createRoutine`: o dia tem no maximo UMA rotina
    // (migracao v2). Numa primeira abertura o dia esta sempre vazio, mas criar
    // direto duplicaria o dia de quem chegasse aqui com plano.
    const routine = await ensureDayRoutine(weekday);
    await updateRoutine(routine.id, { name: day.name });
    for (const item of day.exercises) {
      // O `??` cobre alguem tirar um nome do catalogo comum e esquecer do
      // modelo — o teste de `templates` pega isso, mas o dia nao pode nascer
      // pela metade se escapar.
      const exerciseId =
        byName.get(normalizeName(item.name)) ?? (await createExercise(item.name)).id;
      await addExerciseToRoutine(routine.id, exerciseId, {
        sets: item.sets,
        reps: item.reps,
        weightKg: 0,
        distanceKm: 0,
        durationMin: 0,
      });
    }
  }
}

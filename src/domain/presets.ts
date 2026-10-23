import { normalizeName } from '@/domain/names';
import type { Exercise, ExerciseKind, GymPresetExercise } from '@/domain/types';
import { findMovementBySlug, type Movement } from '@/movements/library';

/**
 * Regras puras para adocao de treinos sugeridos pela academia.
 */

export type MatchResult = {
  movement: Movement | null;
  existingExercise: Exercise | null;
};

/**
 * Localiza o movimento na biblioteca e verifica se o aluno ja tem esse
 * exercicio no catalogo pessoal (pelo nome normalizado).
 *
 * Casa primeiro pelo `name` da ficha, que e o que o gatilho do servidor usa ao
 * propagar um exercicio novo: assim aparelho e servidor escolhem o mesmo
 * exercicio do aluno. O nome da biblioteca entra como segunda chance.
 */
export function matchMovementForPreset(
  preset: Pick<GymPresetExercise, 'movementSlug' | 'name'>,
  userExercises: readonly Exercise[],
): MatchResult {
  const movement = findMovementBySlug(preset.movementSlug);
  const keys = [preset.name, movement?.name]
    .filter((name): name is string => Boolean(name?.trim()))
    .map(normalizeName);

  let existing: Exercise | null = null;
  for (const key of keys) {
    existing =
      userExercises.find((e) => e.deletedAt === null && normalizeName(e.name) === key) ?? null;
    if (existing) break;
  }

  return {
    movement,
    existingExercise: existing,
  };
}

export type AdoptedExerciseDraft = {
  presetExerciseId: string;
  exerciseId: string | null;
  exerciseName: string;
  muscleGroup: string | null;
  kind: ExerciseKind;
  targetSets: number;
  targetReps: number;
  targetDistanceKm: number;
  targetDurationMin: number;
  position: number;
};

/**
 * Monta o plano de criacao para adotar uma lista de exercicios sugeridos.
 * Se o aluno ja tiver o exercicio, reaproveita o ID dele; se nao tiver,
 * `exerciseId` fica null indicando que precisa ser criado.
 */
export function preparePresetAdoption(
  presetExercises: readonly GymPresetExercise[],
  userExercises: readonly Exercise[],
): AdoptedExerciseDraft[] {
  return presetExercises.map((pe, idx) => {
    const { movement, existingExercise } = matchMovementForPreset(pe, userExercises);

    const name = pe.name.trim() || movement?.name || pe.movementSlug;
    const muscleGroup = pe.muscleGroup ?? movement?.muscleGroup ?? null;
    const kind: ExerciseKind = pe.kind;

    return {
      presetExerciseId: pe.id,
      exerciseId: existingExercise?.id ?? null,
      exerciseName: name,
      muscleGroup,
      kind,
      targetSets: pe.targetSets,
      targetReps: pe.targetReps,
      targetDistanceKm: pe.targetDistanceKm,
      targetDurationMin: pe.targetDurationMin,
      position: idx,
    };
  });
}

/**
 * De quem e o dia: de um plano da academia, da ficha sugerida, do instrutor
 * (prescrito pelo painel) ou do proprio aluno (`null`).
 *
 * Nos tres primeiros o dia esta VINCULADO: series e reps vem da academia, a
 * carga vem do aluno (`resolveTargets`), e editar a composicao desvincula.
 */
export type RoutineLink = 'plan' | 'preset' | 'instructor' | null;

export function routineLink(
  routine: { presetId?: string | null; prescribedBy?: string | null; planId?: string | null } | null | undefined,
): RoutineLink {
  if (routine?.presetId && routine.planId) return 'plan';
  if (routine?.presetId) return 'preset';
  if (routine?.prescribedBy) return 'instructor';
  return null;
}

/**
 * O que o dia vinculado deixa de seguir ao ser editado, para os avisos. Os
 * avisos ja terminam em "...atualizacoes do instrutor": por isso o do
 * instrutor e so "a prescricao", e nao "o treino do instrutor" de novo.
 */
export function linkSourceName(link: Exclude<RoutineLink, null>): string {
  if (link === 'plan') return 'o plano da academia';
  return link === 'preset' ? 'a ficha da academia' : 'a prescrição';
}

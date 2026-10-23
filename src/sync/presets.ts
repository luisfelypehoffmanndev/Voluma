import { getDb } from '@/db/client';
import type { GymPlanDayRow, GymPlanRow, GymPresetExerciseRow, GymPresetRow } from '@/db/rows';
import { bumpData } from '@/store/data';
import { GYM } from '@/world';

import { supabase } from './supabase';

/**
 * Baixa os treinos sugeridos do mundo para o cache local
 * (`local_gym_presets` e `local_gym_preset_exercises`).
 *
 * Nao passa pelo engine: sao dados da academia, nao do usuario, valem sem login
 * (a leitura e liberada para `anon`) e nunca sobem. Por serem poucas linhas, o
 * pull troca o cache inteiro do mundo a cada vez, em vez de ir por `synced_at`:
 * uma ficha apagada de verdade no servidor tambem some daqui.
 *
 * Sem rede ou com erro, o cache fica como estava, e a adocao segue offline.
 */
export async function pullPresets(): Promise<void> {
  if (!supabase) return;

  try {
    const [presets, exercises, plans, planDays] = await Promise.all([
      supabase
        .from('gym_presets')
        .select('id, gym_id, name, position, updated_at, deleted_at')
        .eq('gym_id', GYM)
        .is('deleted_at', null),
      supabase
        .from('gym_preset_exercises')
        .select(
          'id, preset_id, gym_id, movement_slug, name, muscle_group, kind, position, target_sets, target_reps, target_distance_km, target_duration_min, updated_at, deleted_at',
        )
        .eq('gym_id', GYM)
        .is('deleted_at', null),
      // Planos: o RLS ja devolve so os abertos e os que este aluno segue.
      supabase
        .from('gym_plans')
        .select('id, gym_id, name, open_to_students, position, updated_at, deleted_at')
        .eq('gym_id', GYM)
        .is('deleted_at', null),
      supabase
        .from('gym_plan_days')
        .select('id, plan_id, gym_id, weekday, preset_id, updated_at, deleted_at')
        .eq('gym_id', GYM)
        .is('deleted_at', null),
    ]);

    const error = presets.error ?? exercises.error ?? plans.error ?? planDays.error;
    if (error) {
      console.warn('[Voluma] falha ao buscar treinos sugeridos', error.message);
      return;
    }

    const changedPresets = await replaceLocalPresets(
      (presets.data ?? []) as GymPresetRow[],
      (exercises.data ?? []) as GymPresetExerciseRow[],
    );
    const changedPlans = await replaceLocalPlans(
      (plans.data ?? []) as GymPlanRow[],
      (planDays.data ?? []) as GymPlanDayRow[],
    );
    const changed = changedPresets || changedPlans;
    // So avisa as telas quando algo mudou: o pull roda a cada volta do app, e
    // um `bumpData` sem mudanca faria a tela aberta consultar de novo a toa.
    if (changed) bumpData();
  } catch (error) {
    console.warn('[Voluma] erro inesperado ao sincronizar treinos sugeridos', error);
  }
}

/**
 * Troca o cache do mundo atual pelas linhas recebidas, numa transacao.
 * Devolve se o cache mudou.
 */
export async function replaceLocalPresets(
  presets: readonly GymPresetRow[],
  incomingExercises: readonly GymPresetExerciseRow[],
): Promise<boolean> {
  const db = await getDb();
  // So exercicios de fichas que vieram: um exercicio solto nao tem onde aparecer.
  const presetIds = new Set(presets.map((p) => p.id));
  const exercises = incomingExercises.filter((e) => presetIds.has(e.preset_id));

  const [currentPresets, currentExercises] = await Promise.all([
    db.getAllAsync<GymPresetRow>('SELECT * FROM local_gym_presets WHERE gym_id = ?', GYM),
    db.getAllAsync<GymPresetExerciseRow>(
      'SELECT * FROM local_gym_preset_exercises WHERE gym_id = ?',
      GYM,
    ),
  ]);
  if (
    sameRows(currentPresets, presets, PRESET_FIELDS) &&
    sameRows(currentExercises, exercises, PRESET_EXERCISE_FIELDS)
  ) {
    return false;
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM local_gym_preset_exercises WHERE gym_id = ?', GYM);
    await db.runAsync('DELETE FROM local_gym_presets WHERE gym_id = ?', GYM);

    for (const p of presets) {
      await db.runAsync(
        `INSERT INTO local_gym_presets (id, gym_id, name, position, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        p.id,
        p.gym_id,
        p.name,
        p.position,
        p.updated_at,
        p.deleted_at,
      );
    }

    for (const e of exercises) {
      await db.runAsync(
        `INSERT INTO local_gym_preset_exercises
           (id, preset_id, gym_id, movement_slug, name, muscle_group, kind, position,
            target_sets, target_reps, target_distance_km, target_duration_min, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        e.id,
        e.preset_id,
        e.gym_id,
        e.movement_slug,
        e.name,
        e.muscle_group,
        e.kind,
        e.position,
        e.target_sets,
        e.target_reps,
        e.target_distance_km,
        e.target_duration_min,
        e.updated_at,
        e.deleted_at,
      );
    }
  });
  return true;
}

/**
 * Troca o cache dos planos do mundo atual, como `replaceLocalPresets`. O
 * `open_to_students` chega booleano do Postgres e o SQLite guarda 0/1.
 */
export async function replaceLocalPlans(
  incomingPlans: readonly GymPlanRow[],
  incomingDays: readonly GymPlanDayRow[],
): Promise<boolean> {
  const db = await getDb();
  const plans = incomingPlans.map((p) => ({ ...p, open_to_students: p.open_to_students ? 1 : 0 }));
  const planIds = new Set(plans.map((p) => p.id));
  const days = incomingDays.filter((d) => planIds.has(d.plan_id));

  const [currentPlans, currentDays] = await Promise.all([
    db.getAllAsync<GymPlanRow>('SELECT * FROM local_gym_plans WHERE gym_id = ?', GYM),
    db.getAllAsync<GymPlanDayRow>('SELECT * FROM local_gym_plan_days WHERE gym_id = ?', GYM),
  ]);
  if (sameRows(currentPlans, plans, PLAN_FIELDS) && sameRows(currentDays, days, PLAN_DAY_FIELDS)) {
    return false;
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM local_gym_plan_days WHERE gym_id = ?', GYM);
    await db.runAsync('DELETE FROM local_gym_plans WHERE gym_id = ?', GYM);
    for (const p of plans) {
      await db.runAsync(
        `INSERT INTO local_gym_plans (id, gym_id, name, open_to_students, position, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        p.id,
        p.gym_id,
        p.name,
        p.open_to_students,
        p.position,
        p.updated_at,
        p.deleted_at,
      );
    }
    for (const d of days) {
      await db.runAsync(
        `INSERT INTO local_gym_plan_days (id, plan_id, gym_id, weekday, preset_id, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        d.id,
        d.plan_id,
        d.gym_id,
        d.weekday,
        d.preset_id,
        d.updated_at,
        d.deleted_at,
      );
    }
  });
  return true;
}

const PLAN_FIELDS = ['id', 'gym_id', 'name', 'open_to_students', 'position', 'updated_at', 'deleted_at'] as const;
const PLAN_DAY_FIELDS = ['id', 'plan_id', 'gym_id', 'weekday', 'preset_id', 'updated_at', 'deleted_at'] as const;

const PRESET_FIELDS = ['id', 'gym_id', 'name', 'position', 'updated_at', 'deleted_at'] as const;
const PRESET_EXERCISE_FIELDS = [
  'id',
  'preset_id',
  'gym_id',
  'movement_slug',
  'name',
  'muscle_group',
  'kind',
  'position',
  'target_sets',
  'target_reps',
  'target_distance_km',
  'target_duration_min',
  'updated_at',
  'deleted_at',
] as const;

/** Mesmas linhas, campo a campo, sem depender da ordem em que chegaram. */
function sameRows<T extends { id: string }>(
  a: readonly T[],
  b: readonly T[],
  fields: readonly (keyof T)[],
): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(a.map((row) => [row.id, row]));
  return b.every((row) => {
    const other = byId.get(row.id);
    return other != null && fields.every((field) => (other[field] ?? null) === (row[field] ?? null));
  });
}

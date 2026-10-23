import type { Routine, Weekday } from '@domain/types';
import { toDateKey } from '@domain/week';

import type { StudentRow } from './students';
import { supabase } from './supabase';

export type Membership = { gym_id: string; role: 'admin' | 'instructor' };

/**
 * As academias desta conta. Chama `staff_claim_invites`, que antes transforma
 * em equipe os convites feitos para o e-mail dela: entrar no painel e o que
 * aceita o convite.
 */
export async function loadMemberships(): Promise<Membership[]> {
  const { data, error } = await supabase.rpc('staff_claim_invites');
  if (error) throw new Error(error.message);
  return (data ?? []) as Membership[];
}

export type StudentFilters = {
  weeks: number;
  prescribedOnly: boolean;
  inactiveDays: number | null;
  hasExercise: string;
};

export const DEFAULT_FILTERS: StudentFilters = {
  weeks: 4,
  prescribedOnly: false,
  inactiveDays: null,
  hasExercise: '',
};

export async function loadStudents(
  gym: string,
  filters: StudentFilters,
  today: Date,
  extra: { plan?: string; noPlan?: boolean } = {},
): Promise<StudentRow[]> {
  const since = filters.inactiveDays
    ? toDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - filters.inactiveDays))
    : null;
  const { data, error } = await supabase.rpc('staff_find_students', {
    gym,
    weeks: filters.weeks,
    prescribed_only: filters.prescribedOnly,
    inactive_since: since,
    has_exercise: filters.hasExercise.trim() || null,
    plan: extra.plan ?? null,
    no_plan: extra.noPlan ?? false,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as StudentRow[];
}

export type PlanExercise = {
  id: string;
  name: string;
  /** Exercicio que o instrutor mudou so para este aluno (numeros proprios ou a mais). */
  exception: boolean;
  kind: 'strength' | 'run';
  sets: number;
  reps: number;
  distanceKm: number;
  durationMin: number;
};

export type PlanDay = Routine & {
  prescribedAt: string | null;
  planId: string | null;
  exercises: PlanExercise[];
};

/**
 * A semana de um aluno, so leitura. Le as tabelas direto: a policy
 * `staff_select` (v16) libera o plano dos alunos da academia, e so ele.
 */
export async function loadWeek(gym: string, student: string): Promise<PlanDay[]> {
  const [routines, items, exercises] = await Promise.all([
    supabase
      .from('routines')
      .select('id, name, weekday, position, preset_id, plan_id, prescribed_by, prescribed_at, updated_at, deleted_at')
      .eq('gym_id', gym)
      .eq('user_id', student)
      .is('deleted_at', null),
    supabase
      .from('routine_exercises')
      .select('id, routine_id, exercise_id, preset_exercise_id, custom_targets, position, target_sets, target_reps, target_distance_km, target_duration_min')
      .eq('gym_id', gym)
      .eq('user_id', student)
      .is('deleted_at', null)
      .order('position'),
    supabase.from('exercises').select('id, name, kind').eq('gym_id', gym).eq('user_id', student),
  ]);
  for (const result of [routines, items, exercises]) {
    if (result.error) throw new Error(result.error.message);
  }

  const names = new Map((exercises.data ?? []).map((e) => [e.id as string, e]));
  return (routines.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    weekday: r.weekday as Weekday,
    position: r.position,
    presetId: r.preset_id,
    prescribedBy: r.prescribed_by,
    prescribedAt: r.prescribed_at,
    planId: r.plan_id,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    exercises: (items.data ?? [])
      .filter((item) => item.routine_id === r.id && names.has(item.exercise_id))
      .map((item) => {
        const exercise = names.get(item.exercise_id)!;
        return {
          id: item.id,
          name: exercise.name as string,
          exception: Boolean(r.preset_id) && (item.custom_targets || !item.preset_exercise_id),
          kind: exercise.kind === 'run' ? 'run' : 'strength',
          sets: item.target_sets,
          reps: item.target_reps,
          distanceKm: item.target_distance_km,
          durationMin: item.target_duration_min,
        };
      }),
  }));
}

/** Nome das fichas da academia, para o filtro e para a marca "Ficha". */
export async function loadPresetNames(gym: string): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('gym_presets')
    .select('id, name')
    .eq('gym_id', gym)
    .is('deleted_at', null)
    .order('position');
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((p) => [p.id as string, p.name as string]));
}


// ------------------------------------------------------------------ planos

export type Plan = {
  id: string;
  name: string;
  open_to_students: boolean;
  days: { weekday: number; preset_id: string }[];
};

/** Os planos da academia com os dias vivos de cada um. */
export async function loadPlans(gym: string): Promise<Plan[]> {
  const [plans, days] = await Promise.all([
    supabase.from('gym_plans').select('id, name, open_to_students').eq('gym_id', gym).is('deleted_at', null).order('position').order('name'),
    supabase.from('gym_plan_days').select('plan_id, weekday, preset_id').eq('gym_id', gym).is('deleted_at', null),
  ]);
  if (plans.error) throw new Error(plans.error.message);
  if (days.error) throw new Error(days.error.message);
  return (plans.data ?? []).map((p) => ({
    ...(p as Omit<Plan, 'days'>),
    days: (days.data ?? []).filter((d) => d.plan_id === p.id).map((d) => ({ weekday: d.weekday, preset_id: d.preset_id })),
  }));
}

export type Workout = {
  id: string;
  name: string;
  exercises: {
    id: string;
    movement_slug: string;
    name: string;
    muscle_group: string | null;
    kind: 'strength' | 'run';
    sets: number;
    reps: number;
    distance_km: number;
    duration_min: number;
  }[];
};

/** Os treinos (fichas) da academia, com os exercicios. */
export async function loadWorkouts(gym: string): Promise<Workout[]> {
  const [presets, exercises] = await Promise.all([
    supabase.from('gym_presets').select('id, name').eq('gym_id', gym).is('deleted_at', null).order('position').order('name'),
    supabase
      .from('gym_preset_exercises')
      .select('id, preset_id, movement_slug, name, muscle_group, kind, target_sets, target_reps, target_distance_km, target_duration_min, position')
      .eq('gym_id', gym)
      .is('deleted_at', null)
      .order('position'),
  ]);
  if (presets.error) throw new Error(presets.error.message);
  if (exercises.error) throw new Error(exercises.error.message);
  return (presets.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    exercises: (exercises.data ?? [])
      .filter((e) => e.preset_id === p.id)
      .map((e) => ({
        id: e.id,
        movement_slug: e.movement_slug,
        name: e.name,
        muscle_group: e.muscle_group,
        kind: e.kind === 'run' ? 'run' : 'strength',
        sets: e.target_sets,
        reps: e.target_reps,
        distance_km: e.target_distance_km,
        duration_min: e.target_duration_min,
      })),
  }));
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(friendly(error.message, error.code));
  return data as T;
}

/** Mensagem do banco em portugues de gente. */
function friendly(message: string, code?: string): string {
  if (code === 'P0409') return 'O aluno mudou este dia enquanto você editava. Recarregue e tente de novo.';
  if (code === '42501') return 'Sua conta não tem permissão para isso nesta academia.';
  return message;
}

export type PlanSave = { id?: string; name: string; open_to_students: boolean; days: { weekday: number; preset_id: string }[] };

export async function savePlan(gym: string, plan: PlanSave) {
  const rows = await rpc<{ plan_id: string; students_updated: number; skipped: number }[]>('staff_upsert_plan', { gym, plan });
  return rows[0];
}

export function deletePlan(gym: string, plan: string) {
  return rpc<number>('staff_delete_plan', { gym, plan });
}

export type WorkoutSave = {
  id?: string;
  name: string;
  exercises: {
    id?: string;
    movement_slug: string;
    name: string;
    muscle_group: string | null;
    kind: 'strength' | 'run';
    sets: number;
    reps: number;
    distance_km?: number;
    duration_min?: number;
  }[];
};

export function saveWorkout(gym: string, workout: WorkoutSave) {
  return rpc<string>('staff_upsert_preset', { gym, preset: workout });
}

export type PlanMemberRow = {
  user_id: string;
  display_name: string | null;
  handle: string | null;
  plan_days: number;
  following_days: number;
  customized_days: number;
};

export function loadPlanMembers(gym: string, plan: string) {
  return rpc<PlanMemberRow[]>('staff_plan_members', { gym, plan });
}

export function removeFromPlan(gym: string, plan: string, students: string[]) {
  return rpc<number>('staff_remove_from_plan', { gym, plan, students });
}

export type AssignRow = {
  user_id: string;
  weekday: number;
  current: 'empty' | 'same_plan' | 'own' | 'instructor' | 'preset' | 'other_plan';
  current_name: string | null;
  action: 'apply' | 'skip' | 'unchanged';
};

/**
 * Previa ou aplicacao, em pedacos de 200 alunos (a RPC aceita 500 e o
 * PostgREST corta consulta longa).
 */
export async function assignPlan(
  gym: string,
  plan: string,
  students: string[],
  replace: { user_id: string; weekday: number }[],
  dryRun: boolean,
): Promise<AssignRow[]> {
  const out: AssignRow[] = [];
  for (let i = 0; i < students.length; i += 200) {
    const part = students.slice(i, i + 200);
    const ids = new Set(part);
    const rows = await rpc<AssignRow[]>('staff_assign_plan', {
      gym,
      plan,
      students: part,
      replace: replace.filter((r) => ids.has(r.user_id)),
      dry_run: dryRun,
    });
    out.push(...rows);
  }
  return out;
}

// ------------------------------------------------------- dia de um aluno

export type DayItem = {
  routine_exercise_id?: string;
  name: string;
  muscle_group?: string | null;
  kind?: 'strength' | 'run';
  sets?: number;
  reps?: number;
  distance_km?: number;
  duration_min?: number;
};

/** Dia que segue um treino: personaliza sem tirar do plano. */
export function customizeDay(gym: string, student: string, day: number, items: DayItem[], expected: string) {
  return rpc<string>('staff_customize_day', { gym, student, day, items, expected_updated_at: expected });
}

/** Dia do proprio aluno ou prescrito: substitui e prescreve. */
export function setDay(gym: string, student: string, day: number, name: string, items: DayItem[], expected: string | null) {
  return rpc<string>('staff_set_day', { gym, student, day, day_name: name, items, expected_updated_at: expected });
}

export function resetDay(gym: string, student: string, day: number) {
  return rpc<string>('staff_reset_day', { gym, student, day });
}

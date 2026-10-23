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

export async function loadStudents(gym: string, filters: StudentFilters, today: Date): Promise<StudentRow[]> {
  const since = filters.inactiveDays
    ? toDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - filters.inactiveDays))
    : null;
  const { data, error } = await supabase.rpc('staff_find_students', {
    gym,
    weeks: filters.weeks,
    prescribed_only: filters.prescribedOnly,
    inactive_since: since,
    has_exercise: filters.hasExercise.trim() || null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as StudentRow[];
}

export type PlanExercise = {
  id: string;
  name: string;
  kind: 'strength' | 'run';
  sets: number;
  reps: number;
  distanceKm: number;
  durationMin: number;
};

export type PlanDay = Routine & {
  prescribedAt: string | null;
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
      .select('id, name, weekday, position, preset_id, prescribed_by, prescribed_at, updated_at, deleted_at')
      .eq('gym_id', gym)
      .eq('user_id', student)
      .is('deleted_at', null),
    supabase
      .from('routine_exercises')
      .select('id, routine_id, exercise_id, position, target_sets, target_reps, target_distance_km, target_duration_min')
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
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    exercises: (items.data ?? [])
      .filter((item) => item.routine_id === r.id && names.has(item.exercise_id))
      .map((item) => {
        const exercise = names.get(item.exercise_id)!;
        return {
          id: item.id,
          name: exercise.name as string,
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


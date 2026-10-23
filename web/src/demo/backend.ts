/**
 * Modo demo (`?demo`): um Supabase de mentira em memoria, com alunos, treinos e
 * planos, para experimentar o painel sem login e sem tocar no banco. Imita as
 * RPCs `staff_*` (v16 e v18) no que a tela usa. Recarregar a pagina recomeca.
 */
type Ex = {
  id: string;
  exercise_id: string;
  name: string;
  kind: 'strength' | 'run';
  preset_exercise_id: string | null;
  custom_targets: boolean;
  target_sets: number;
  target_reps: number;
  target_distance_km: number;
  target_duration_min: number;
  position: number;
};
type Day = {
  id: string;
  name: string;
  weekday: number;
  preset_id: string | null;
  plan_id: string | null;
  prescribed_by: string | null;
  prescribed_at: string | null;
  updated_at: string;
  exercises: Ex[];
};
type Student = {
  id: string;
  display_name: string;
  handle: string;
  trained: number[]; // dias atras em que treinou
  days: Day[];
};
type PresetEx = {
  id: string;
  movement_slug: string;
  name: string;
  muscle_group: string | null;
  kind: 'strength' | 'run';
  target_sets: number;
  target_reps: number;
  target_distance_km: number;
  target_duration_min: number;
  position: number;
};
type Preset = { id: string; name: string; ex: PresetEx[] };
type Plan = { id: string; name: string; open_to_students: boolean; days: { weekday: number; preset_id: string }[] };

export const DEMO_USER = '00000000-0000-4000-8000-00000000d0d0';
const GYM = 'teste';

let seq = 0;
const uid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
const now = () => new Date().toISOString();

// ------------------------------------------------------------------ dados

const presetEx = (slug: string, name: string, group: string, sets: number, reps: number, position: number): PresetEx => ({
  id: uid(),
  movement_slug: slug,
  name,
  muscle_group: group,
  kind: 'strength',
  target_sets: sets,
  target_reps: reps,
  target_distance_km: 0,
  target_duration_min: 0,
  position,
});

const presets: Preset[] = [
  {
    id: uid(),
    name: 'Treino A · Peito e tríceps',
    ex: [
      presetEx('bench-press', 'Supino reto', 'Peito', 4, 8, 0),
      presetEx('incline-dumbbell-press', 'Supino inclinado com halteres', 'Peito', 3, 10, 1),
      presetEx('triceps-pushdown', 'Tríceps corda', 'Tríceps', 3, 12, 2),
    ],
  },
  {
    id: uid(),
    name: 'Treino B · Costas e bíceps',
    ex: [
      presetEx('lat-pulldown', 'Puxada alta', 'Costas', 4, 10, 0),
      presetEx('barbell-row', 'Remada curvada', 'Costas', 4, 8, 1),
      presetEx('barbell-curl', 'Rosca direta', 'Bíceps', 3, 12, 2),
    ],
  },
  {
    id: uid(),
    name: 'Treino C · Pernas',
    ex: [
      presetEx('squat', 'Agachamento livre', 'Pernas', 4, 8, 0),
      presetEx('leg-press', 'Leg press', 'Pernas', 3, 12, 1),
      presetEx('romanian-deadlift', 'Stiff', 'Posterior', 3, 10, 2),
    ],
  },
];
const [ta, tb, tc] = presets;

const plans: Plan[] = [
  {
    id: uid(),
    name: 'Hipertrofia ABC',
    open_to_students: true,
    days: [
      { weekday: 1, preset_id: ta.id },
      { weekday: 3, preset_id: tb.id },
      { weekday: 5, preset_id: tc.id },
    ],
  },
  { id: uid(), name: 'Iniciante AB', open_to_students: false, days: [{ weekday: 2, preset_id: ta.id }, { weekday: 4, preset_id: tc.id }] },
];

const catalog = new Map<string, string>(); // nome -> exercise_id, por aluno
const exerciseId = (student: string, name: string) => {
  const key = `${student}/${name.toLowerCase()}`;
  if (!catalog.has(key)) catalog.set(key, uid());
  return catalog.get(key)!;
};

function applyPreset(student: Student, weekday: number, preset: Preset, plan: string | null) {
  let day = student.days.find((d) => d.weekday === weekday);
  if (!day) {
    day = { id: uid(), name: '', weekday, preset_id: null, plan_id: null, prescribed_by: null, prescribed_at: null, updated_at: now(), exercises: [] };
    student.days.push(day);
  }
  Object.assign(day, { name: preset.name, preset_id: preset.id, plan_id: plan, prescribed_by: null, prescribed_at: null, updated_at: now() });
  day.exercises = preset.ex.map((e) => ({
    id: uid(),
    exercise_id: exerciseId(student.id, e.name),
    name: e.name,
    kind: e.kind,
    preset_exercise_id: e.id,
    custom_targets: false,
    target_sets: e.target_sets,
    target_reps: e.target_reps,
    target_distance_km: e.target_distance_km,
    target_duration_min: e.target_duration_min,
    position: e.position,
  }));
}

function ownDay(student: Student, weekday: number, name: string, items: [string, number, number][]) {
  student.days.push({
    id: uid(),
    name,
    weekday,
    preset_id: null,
    plan_id: null,
    prescribed_by: null,
    prescribed_at: null,
    updated_at: now(),
    exercises: items.map(([n, s, r], i) => ({
      id: uid(),
      exercise_id: exerciseId(student.id, n),
      name: n,
      kind: 'strength',
      preset_exercise_id: null,
      custom_targets: false,
      target_sets: s,
      target_reps: r,
      target_distance_km: 0,
      target_duration_min: 0,
      position: i,
    })),
  });
}

const person = (display_name: string, handle: string, trained: number[]): Student => ({ id: uid(), display_name, handle, trained, days: [] });

const students: Student[] = [
  person('Ana Souza', 'ana.souza', [1, 3, 5, 8, 10, 12, 15, 17, 19, 22]),
  person('Bruno Lima', 'brunolima', [2, 4, 9, 11, 16, 23]),
  person('Carla Mendes', 'carla.m', [1, 2, 4, 6, 8, 9, 11, 13, 15, 16, 18, 20]),
  person('Diego Rocha', 'diegorocha', [3, 10, 17]),
  person('Eva Martins', 'eva', [21, 25]),
  person('Felipe Costa', 'felipec', [1, 5, 12]),
  person('Gabi Ferreira', 'gabif', []),
  person('Henrique Alves', 'henrique', [2, 3, 6, 9, 13, 14, 20, 27]),
  person('Isa Nogueira', 'isanog', [4, 11, 18, 25]),
  person('João Pedro', 'jp', [1, 2, 3, 8, 9, 10]),
];
const [ana, bruno, carla, diego, eva, felipe, , henrique, isa] = students;

// Ana, Bruno e Carla no Hipertrofia; a Carla com uma excecao no Treino C.
for (const s of [ana, bruno, carla]) for (const d of plans[0].days) applyPreset(s, d.weekday, presets.find((p) => p.id === d.preset_id)!, plans[0].id);
const carlaLegs = carla.days.find((d) => d.weekday === 5)!;
carlaLegs.exercises[0] = { ...carlaLegs.exercises[0], target_sets: 5, target_reps: 5, custom_targets: true };
// Bruno editou a quarta no app: saiu do plano naquele dia.
Object.assign(bruno.days.find((d) => d.weekday === 3)!, { preset_id: null, plan_id: null });
// Henrique no Iniciante.
for (const d of plans[1].days) applyPreset(henrique, d.weekday, presets.find((p) => p.id === d.preset_id)!, plans[1].id);
// Treinos proprios: conflitos para a atribuicao.
ownDay(diego, 1, 'Meu push', [['Supino reto', 3, 10], ['Desenvolvimento', 3, 10]]);
ownDay(diego, 3, 'Costas', [['Barra fixa', 4, 6]]);
ownDay(eva, 2, 'Funcional', [['Agachamento livre', 3, 15]]);
ownDay(felipe, 5, 'Pernas', [['Leg press', 4, 12], ['Cadeira extensora', 3, 15]]);
ownDay(isa, 1, 'Treino da Isa', [['Rosca direta', 3, 12]]);
// O Felipe tem um dia prescrito pelo instrutor (fora de plano).
ownDay(felipe, 2, 'Mobilidade', [['Prancha', 3, 30]]);
Object.assign(felipe.days.find((d) => d.weekday === 2)!, { prescribed_by: DEMO_USER, prescribed_at: now() });

// ------------------------------------------------------------- regras

const following = (s: Student, plan: string) => s.days.filter((d) => d.plan_id === plan && d.preset_id);
const hasExceptions = (d: Day) => {
  if (!d.preset_id) return false;
  const preset = presets.find((p) => p.id === d.preset_id);
  return (
    d.exercises.some((e) => e.custom_targets || !e.preset_exercise_id) ||
    (preset?.ex ?? []).some((pe) => !d.exercises.some((e) => e.preset_exercise_id === pe.id))
  );
};
function dayState(s: Student, weekday: number, plan: string, preset: string) {
  const d = s.days.find((x) => x.weekday === weekday);
  if (!d || d.exercises.length === 0) return { state: 'empty', name: null };
  if (d.plan_id === plan && d.preset_id === preset) return { state: 'same_plan', name: d.name };
  if (d.plan_id && d.preset_id) return { state: 'other_plan', name: d.name };
  if (d.preset_id) return { state: 'preset', name: d.name };
  if (d.prescribed_by) return { state: 'instructor', name: d.name };
  return { state: 'own', name: d.name };
}
const today = new Date();
const dateAgo = (n: number) => {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type Args = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function findStudents(a: Args) {
  const weeks = a.weeks ?? 4;
  return students
    .map((s) => {
      const plansOf = [...new Set(s.days.filter((d) => d.plan_id && d.preset_id).map((d) => d.plan_id!))];
      return {
        user_id: s.id,
        display_name: s.display_name,
        handle: s.handle,
        preset_ids: [...new Set(s.days.filter((d) => d.preset_id).map((d) => d.preset_id!))],
        plan_ids: plansOf,
        prescribed_days: s.days.filter((d) => d.prescribed_by).length,
        self_edited_days: s.days.filter((d) => !d.prescribed_by && d.prescribed_at && !d.preset_id).length,
        customized_days: s.days.filter(hasExceptions).length,
        planned_days: s.days.filter((d) => d.exercises.length).length,
        trained_days: s.trained.filter((n) => n < weeks * 7).length,
        last_trained_on: s.trained.length ? dateAgo(Math.min(...s.trained)) : null,
      };
    })
    .filter((r) => !a.plan || r.plan_ids.includes(a.plan))
    .filter((r) => !a.no_plan || r.plan_ids.length === 0)
    .filter((r) => !a.prescribed_only || r.prescribed_days > 0)
    .filter((r) => !a.inactive_since || !r.last_trained_on || r.last_trained_on < a.inactive_since)
    .filter(
      (r) =>
        !a.has_exercise ||
        students
          .find((s) => s.id === r.user_id)!
          .days.some((d) => d.exercises.some((e) => e.name.toLowerCase() === String(a.has_exercise).trim().toLowerCase())),
    );
}

function upsertPreset(a: Args) {
  const body = a.preset;
  let preset = presets.find((p) => p.id === body.id);
  if (!preset) {
    preset = { id: uid(), name: body.name, ex: [] };
    presets.push(preset);
  }
  preset.name = body.name;
  const old = preset.ex;
  preset.ex = body.exercises.map((e: Args, i: number) => {
    const prev = old.find((o) => o.id === e.id && o.name === e.name);
    return {
      id: prev?.id ?? uid(),
      movement_slug: e.movement_slug,
      name: e.name,
      muscle_group: e.muscle_group ?? null,
      kind: e.kind ?? 'strength',
      target_sets: e.sets ?? 3,
      target_reps: e.reps ?? 10,
      target_distance_km: e.distance_km ?? 0,
      target_duration_min: e.duration_min ?? 0,
      position: i,
    };
  });
  // Propagacao, como o gatilho: so quem segue o treino; excecao fica.
  for (const s of students) {
    for (const d of s.days.filter((x) => x.preset_id === preset!.id)) {
      d.name = preset.name;
      d.exercises = d.exercises.filter((e) => !e.preset_exercise_id || preset!.ex.some((pe) => pe.id === e.preset_exercise_id));
      for (const pe of preset.ex) {
        const row = d.exercises.find((e) => e.preset_exercise_id === pe.id);
        if (row) {
          row.position = pe.position;
          if (!row.custom_targets) Object.assign(row, { target_sets: pe.target_sets, target_reps: pe.target_reps });
        } else if (!old.some((o) => o.id === pe.id)) {
          d.exercises.push({
            id: uid(),
            exercise_id: exerciseId(s.id, pe.name),
            name: pe.name,
            kind: pe.kind,
            preset_exercise_id: pe.id,
            custom_targets: false,
            target_sets: pe.target_sets,
            target_reps: pe.target_reps,
            target_distance_km: pe.target_distance_km,
            target_duration_min: pe.target_duration_min,
            position: pe.position,
          });
        }
      }
      d.exercises.sort((x, y) => x.position - y.position);
    }
  }
  return preset.id;
}

function upsertPlan(a: Args) {
  const body = a.plan;
  let plan = plans.find((p) => p.id === body.id);
  let updated = 0;
  let skipped = 0;
  if (!plan) {
    plan = { id: uid(), name: body.name, open_to_students: !!body.open_to_students, days: [] };
    plans.push(plan);
  }
  plan.name = body.name;
  plan.open_to_students = !!body.open_to_students;
  const members = students.filter((s) => following(s, plan!.id).length > 0);
  for (const old of plan.days) {
    if (!body.days.some((d: Args) => d.weekday === old.weekday)) {
      for (const s of members) {
        const d = s.days.find((x) => x.weekday === old.weekday && x.plan_id === plan!.id);
        if (d) Object.assign(d, { plan_id: null, preset_id: null, prescribed_by: DEMO_USER, prescribed_at: now() });
      }
    }
  }
  for (const nd of body.days as { weekday: number; preset_id: string }[]) {
    const old = plan.days.find((d) => d.weekday === nd.weekday);
    if (old?.preset_id === nd.preset_id) continue;
    const preset = presets.find((p) => p.id === nd.preset_id)!;
    for (const s of members) {
      const d = s.days.find((x) => x.weekday === nd.weekday);
      if (old ? d?.plan_id === plan.id && d.preset_id === old.preset_id : !d || d.exercises.length === 0) {
        applyPreset(s, nd.weekday, preset, plan.id);
        updated++;
      } else if (!old) skipped++;
    }
  }
  plan.days = body.days;
  return [{ plan_id: plan.id, students_updated: updated, skipped }];
}

function assign(a: Args) {
  const plan = plans.find((p) => p.id === a.plan)!;
  const pairs = new Set((a.replace ?? []).map((r: Args) => `${r.user_id}/${r.weekday}`));
  const rows = [];
  for (const sid of a.students as string[]) {
    const s = students.find((x) => x.id === sid);
    if (!s) continue;
    for (const d of [...plan.days].sort((x, y) => x.weekday - y.weekday)) {
      const st = dayState(s, d.weekday, plan.id, d.preset_id);
      const action = st.state === 'same_plan' ? 'unchanged' : st.state === 'empty' || pairs.has(`${sid}/${d.weekday}`) ? 'apply' : 'skip';
      if (!a.dry_run && action === 'apply') applyPreset(s, d.weekday, presets.find((p) => p.id === d.preset_id)!, plan.id);
      rows.push({ user_id: sid, weekday: d.weekday, current: st.state, current_name: st.name, action });
    }
  }
  return rows;
}

function editDay(a: Args, keepLink: boolean) {
  const s = students.find((x) => x.id === a.student)!;
  let d = s.days.find((x) => x.weekday === a.day);
  if (!d) {
    d = { id: uid(), name: a.day_name, weekday: a.day, preset_id: null, plan_id: null, prescribed_by: null, prescribed_at: null, updated_at: now(), exercises: [] };
    s.days.push(d);
  }
  const preset = presets.find((p) => p.id === d!.preset_id);
  d.exercises = (a.items as Args[]).map((item, i) => {
    const prev = d!.exercises.find((e) => e.id === item.routine_exercise_id || e.name.toLowerCase() === item.name.toLowerCase());
    const base = preset?.ex.find((pe) => pe.id === prev?.preset_exercise_id);
    const sets = item.sets ?? prev?.target_sets ?? 3;
    const reps = item.reps ?? prev?.target_reps ?? 10;
    return {
      id: prev?.id ?? uid(),
      exercise_id: prev?.exercise_id ?? exerciseId(s.id, item.name),
      name: item.name,
      kind: item.kind ?? 'strength',
      preset_exercise_id: keepLink ? (prev?.preset_exercise_id ?? null) : null,
      custom_targets: keepLink && !!base && (sets !== base.target_sets || reps !== base.target_reps),
      target_sets: sets,
      target_reps: reps,
      target_distance_km: item.distance_km ?? 0,
      target_duration_min: item.duration_min ?? 0,
      position: i,
    };
  });
  d.updated_at = now();
  if (!keepLink) Object.assign(d, { name: a.day_name, preset_id: null, plan_id: null, prescribed_by: DEMO_USER, prescribed_at: now() });
  return d.id;
}

function rpc(name: string, a: Args): unknown {
  switch (name) {
    case 'staff_claim_invites':
      return [{ gym_id: GYM, role: 'admin' }];
    case 'staff_find_students':
      return findStudents(a);
    case 'staff_plan_members':
      return students
        .filter((s) => following(s, a.plan).length)
        .map((s) => ({
          user_id: s.id,
          display_name: s.display_name,
          handle: s.handle,
          plan_days: plans.find((p) => p.id === a.plan)?.days.length ?? 0,
          following_days: following(s, a.plan).length,
          customized_days: following(s, a.plan).filter(hasExceptions).length,
        }));
    case 'staff_upsert_preset':
      return upsertPreset(a);
    case 'staff_upsert_plan':
      return upsertPlan(a);
    case 'staff_delete_plan': {
      for (const s of students) for (const d of s.days) if (d.plan_id === a.plan) d.plan_id = null;
      plans.splice(plans.findIndex((p) => p.id === a.plan), 1);
      return 0;
    }
    case 'staff_assign_plan':
      return assign(a);
    case 'staff_remove_from_plan': {
      let n = 0;
      for (const s of students.filter((x) => a.students.includes(x.id)))
        for (const d of following(s, a.plan)) {
          Object.assign(d, { plan_id: null, preset_id: null, prescribed_by: DEMO_USER, prescribed_at: now() });
          n++;
        }
      return n;
    }
    case 'staff_customize_day':
      return editDay(a, true);
    case 'staff_set_day':
      return editDay(a, false);
    case 'staff_reset_day': {
      const s = students.find((x) => x.id === a.student)!;
      const d = s.days.find((x) => x.weekday === a.day)!;
      applyPreset(s, a.day, presets.find((p) => p.id === d.preset_id)!, d.plan_id);
      return d.id;
    }
    default:
      throw new Error(`no modo demo, ${name} nao existe`);
  }
}

function table(name: string, params: URLSearchParams): unknown {
  const user = params.get('user_id')?.replace(/^eq\./, '');
  const s = students.find((x) => x.id === user);
  switch (name) {
    case 'gym_plans':
      return plans.map(({ days: _days, ...p }) => p);
    case 'gym_plan_days':
      return plans.flatMap((p) => p.days.map((d) => ({ plan_id: p.id, ...d })));
    case 'gym_presets':
      return presets.map(({ id, name: n }) => ({ id, name: n }));
    case 'gym_preset_exercises':
      return presets.flatMap((p) => p.ex.map((e) => ({ ...e, preset_id: p.id })));
    case 'routines':
      return (s?.days ?? []).map(({ exercises: _e, ...d }) => ({ ...d, position: 0, deleted_at: null }));
    case 'routine_exercises':
      return (s?.days ?? []).flatMap((d) => d.exercises.map((e) => ({ ...e, routine_id: d.id })));
    case 'exercises':
      return (s?.days ?? []).flatMap((d) => d.exercises.map((e) => ({ id: e.exercise_id, name: e.name, kind: e.kind })));
    default:
      return [];
  }
}

/** Troca o fetch do Supabase por este backend e poe uma sessao de demo. */
export function installDemo(supabaseUrl: string) {
  const ref = new URL(supabaseUrl).host.split('.')[0];
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + 86400;
  const token = `${b64({ alg: 'none' })}.${b64({ sub: DEMO_USER, exp, role: 'authenticated' })}.demo`;
  try {
    localStorage.setItem(
      `sb-${ref}-auth-token`,
      JSON.stringify({
        access_token: token,
        refresh_token: 'demo',
        token_type: 'bearer',
        expires_in: 86400,
        expires_at: exp,
        user: { id: DEMO_USER, email: 'demo@voluma', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
      }),
    );
  } catch {
    // Sem storage: o painel abre no login, e o demo nao funciona nesta aba.
  }

  const realFetch = window.fetch.bind(window);
  const reply = (body: unknown, status = 200) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (!url.href.startsWith(supabaseUrl)) return realFetch(input, init);
    await new Promise((r) => setTimeout(r, 150)); // um pouco de rede, para ver os estados de carregando
    const path = url.pathname;
    if (path.startsWith('/auth/v1/')) return reply({}, path.endsWith('/logout') ? 204 : 200);
    if (path.startsWith('/rest/v1/rpc/')) {
      try {
        return reply(rpc(path.slice('/rest/v1/rpc/'.length), init.body ? JSON.parse(String(init.body)) : {}));
      } catch (e) {
        return reply({ message: (e as Error).message, code: '22023' }, 400);
      }
    }
    if (path.startsWith('/rest/v1/')) return reply(table(path.slice('/rest/v1/'.length), url.searchParams));
    return reply({}, 404);
  };
}

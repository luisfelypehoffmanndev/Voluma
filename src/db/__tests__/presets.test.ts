import { DatabaseSync } from 'node:sqlite';

import {
  addExerciseToRoutine,
  adoptPlan,
  adoptPresetIntoDay,
  listLocalPlans,
  listLocalPresetExercises,
  listLocalPresets,
  removeRoutineExercise,
  reorderRoutineExercises,
  setWeekTarget,
  targetsForWeek,
  updateRoutine,
} from '../repo';
import { COMMON_EXERCISES, normalizeName } from '../catalog';
import { adoptPresetsForDays } from '../onboarding';
import { MIGRATIONS } from '../schema';

jest.mock('expo-crypto', () => ({
  randomUUID: () => crypto.randomUUID(),
}));

let mockDb: ReturnType<typeof adapter>;

jest.mock('../client', () => ({ getDb: async () => mockDb }));

function adapter(db: DatabaseSync) {
  return {
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    runAsync: async (sql: string, ...params: (string | number | null)[]) => {
      db.prepare(sql).run(...params);
    },
    getAllAsync: async <T>(sql: string, ...params: (string | number | null)[]) =>
      db.prepare(sql).all(...params) as T[],
    getFirstAsync: async <T>(sql: string, ...params: (string | number | null)[]) =>
      (db.prepare(sql).get(...params) ?? null) as T | null,
    withTransactionAsync: async (task: () => Promise<void>) => {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

const T0 = '2026-10-10T00:00:00.000Z';
let raw: DatabaseSync;

function seed(sql: string) {
  raw.exec(sql);
}

function row(table: string, id: string) {
  return raw.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
}

const strengthTargets = (sets: number, reps: number, weightKg = 0) => ({
  sets,
  reps,
  weightKg,
  distanceKm: 0,
  durationMin: 0,
});

beforeEach(() => {
  raw = new DatabaseSync(':memory:');
  for (const migration of MIGRATIONS) raw.exec(migration);
  mockDb = adapter(raw);

  // Semente de presets da academia 'gym-iron'
  seed(`
    INSERT INTO local_gym_presets (id, gym_id, name, position, updated_at) VALUES
      ('preset-a', 'gym-iron', 'Ficha A - Peito e Tríceps', 0, '${T0}'),
      ('preset-b', 'gym-iron', 'Ficha B - Costas e Bíceps', 1, '${T0}');

    INSERT INTO local_gym_preset_exercises
      (id, preset_id, gym_id, movement_slug, name, position, target_sets, target_reps, target_distance_km, target_duration_min, updated_at)
    VALUES
      ('pe-1', 'preset-a', 'gym-iron', 'bench-press', 'Supino reto', 0, 4, 8, 0, 0, '${T0}'),
      ('pe-2', 'preset-a', 'gym-iron', 'squat', 'Agachamento livre', 1, 3, 10, 0, 0, '${T0}');
  `);
});

afterEach(() => raw.close());

describe('presets no banco local (SQLite)', () => {
  it('lista presets e exercicios locais de uma academia', async () => {
    const presets = await listLocalPresets('gym-iron');
    expect(presets).toHaveLength(2);
    expect(presets[0].name).toBe('Ficha A - Peito e Tríceps');
    expect(presets[1].name).toBe('Ficha B - Costas e Bíceps');

    const exercises = await listLocalPresetExercises('preset-a');
    expect(exercises).toHaveLength(2);
    expect(exercises[0].movementSlug).toBe('bench-press');
    expect(exercises[0].targetSets).toBe(4);
    expect(exercises[0].targetReps).toBe(8);
  });

  it('adota uma ficha sugerida em um dia da semana', async () => {
    // Aluno ja possui o Supino reto no catalogo
    seed(`
      INSERT INTO exercises (id, name, muscle_group, kind, updated_at)
      VALUES ('ex-supino', 'Supino reto', 'Peito', 'strength', '${T0}');
    `);

    const routine = await adoptPresetIntoDay('preset-a', 1);
    expect(routine.presetId).toBe('preset-a');
    expect(routine.name).toBe('Ficha A - Peito e Tríceps');
    expect(routine.weekday).toBe(1);

    // Verifica se os routine_exercises foram criados com preset_exercise_id
    const routineExercises = raw
      .prepare('SELECT * FROM routine_exercises WHERE routine_id = ? AND deleted_at IS NULL ORDER BY position')
      .all(routine.id) as Record<string, unknown>[];

    expect(routineExercises).toHaveLength(2);
    expect(routineExercises[0].preset_exercise_id).toBe('pe-1');
    expect(routineExercises[0].exercise_id).toBe('ex-supino'); // Reaproveitou existente
    expect(routineExercises[0].target_sets).toBe(4);
    expect(routineExercises[0].target_reps).toBe(8);

    expect(routineExercises[1].preset_exercise_id).toBe('pe-2');
    expect(routineExercises[1].target_sets).toBe(3);
    expect(routineExercises[1].target_reps).toBe(10);

    // O agachamento ('squat') nao existia e deve ter sido criado em exercises
    const squatEx = row('exercises', routineExercises[1].exercise_id as string);
    expect(squatEx).toBeDefined();
    expect(squatEx?.name).toBe('Agachamento livre');
  });

  it('substitui exercicios de um dia que ja tinha plano ao adotar novo preset', async () => {
    seed(`
      INSERT INTO exercises (id, name, updated_at) VALUES ('ex-antigo', 'Exercicio Antigo', '${T0}');
      INSERT INTO routines (id, name, weekday, position, updated_at) VALUES ('rot-seg', 'Meu Treino', 1, 0, '${T0}');
      INSERT INTO routine_exercises (id, routine_id, exercise_id, position, updated_at)
      VALUES ('re-antigo', 'rot-seg', 'ex-antigo', 0, '${T0}');
    `);

    const routine = await adoptPresetIntoDay('preset-a', 1);
    expect(routine.id).toBe('rot-seg');
    expect(routine.presetId).toBe('preset-a');

    // Exercício antigo foi soft-deletado
    const antigo = row('routine_exercises', 're-antigo');
    expect(antigo?.deleted_at).not.toBeNull();

    // Novos exercícios vivos
    const vivos = raw
      .prepare('SELECT id FROM routine_exercises WHERE routine_id = ? AND deleted_at IS NULL')
      .all(routine.id);
    expect(vivos).toHaveLength(2);
  });

  it('onboarding pelas fichas traz o catalogo comum e nao duplica exercicio', async () => {
    await adoptPresetsForDays([1, 3, 5], [{ id: 'preset-a' }, { id: 'preset-b' }]);

    const names = (raw.prepare('SELECT name FROM exercises WHERE deleted_at IS NULL').all() as {
      name: string;
    }[]).map((r) => normalizeName(r.name));
    for (const common of COMMON_EXERCISES) expect(names).toContain(normalizeName(common.name));
    // "Supino reto" e "Agachamento livre" sao do catalogo comum: reaproveitados
    expect(new Set(names).size).toBe(names.length);

    const linked = raw
      .prepare('SELECT weekday, preset_id FROM routines WHERE deleted_at IS NULL ORDER BY weekday')
      .all() as { weekday: number; preset_id: string }[];
    expect(linked).toEqual([
      { weekday: 1, preset_id: 'preset-a' },
      { weekday: 3, preset_id: 'preset-b' },
      { weekday: 5, preset_id: 'preset-a' },
    ]);
  });

  describe('desvinculacao automatica (unlinkRoutineIfLinked)', () => {
    it('quebra vinculo ao adicionar novo exercicio na rotina', async () => {
      const routine = await adoptPresetIntoDay('preset-a', 1);
      expect(routine.presetId).toBe('preset-a');

      seed(`
        INSERT INTO exercises (id, name, updated_at) VALUES ('ex-extra', 'Tríceps corda', '${T0}');
      `);

      await addExerciseToRoutine(routine.id, 'ex-extra', strengthTargets(3, 12));

      const updated = row('routines', routine.id);
      expect(updated?.preset_id).toBeNull();
    });

    it('quebra vinculo ao remover exercicio da rotina', async () => {
      const routine = await adoptPresetIntoDay('preset-a', 1);
      expect(routine.presetId).toBe('preset-a');

      const reList = raw
        .prepare('SELECT id FROM routine_exercises WHERE routine_id = ? AND deleted_at IS NULL')
        .all(routine.id) as { id: string }[];

      await removeRoutineExercise(reList[0].id);

      const updated = row('routines', routine.id);
      expect(updated?.preset_id).toBeNull();
    });

    it('quebra vinculo ao reordenar exercicios da rotina', async () => {
      const routine = await adoptPresetIntoDay('preset-a', 1);
      expect(routine.presetId).toBe('preset-a');

      const reList = raw
        .prepare('SELECT id FROM routine_exercises WHERE routine_id = ? AND deleted_at IS NULL ORDER BY position')
        .all(routine.id) as { id: string }[];

      // Inverte a ordem
      await reorderRoutineExercises([reList[1].id, reList[0].id]);

      const updated = row('routines', routine.id);
      expect(updated?.preset_id).toBeNull();
    });

    it('NAO quebra vinculo ao alterar o dia da semana (weekday) da rotina', async () => {
      const routine = await adoptPresetIntoDay('preset-a', 1);
      expect(routine.presetId).toBe('preset-a');

      await updateRoutine(routine.id, { weekday: 2 });

      const updated = row('routines', routine.id);
      expect(updated?.preset_id).toBe('preset-a');
      expect(updated?.weekday).toBe(2);
    });
  });

  describe('cascata de alvos com targetsForWeek', () => {
    it('combina series/reps da ficha com carga do aluno quando vinculado', async () => {
      // 1. Aluno adotou preset-a (supino: 4x8)
      seed(`
        INSERT INTO exercises (id, name, updated_at) VALUES ('ex-supino', 'Supino reto', '${T0}');
      `);
      const routine = await adoptPresetIntoDay('preset-a', 1);

      // 2. Aluno treinou supino semana passada com 3x10 a 60kg
      seed(`
        INSERT INTO sessions (id, routine_id, date, started_at, finished_at, updated_at)
        VALUES ('sess-antiga', '${routine.id}', '2026-10-05', '2026-10-05T10:00:00.000Z', '2026-10-05T11:00:00.000Z', '${T0}');

        INSERT INTO session_sets (id, session_id, exercise_id, set_index, reps, weight_kg, done, updated_at)
        VALUES
          ('s-1', 'sess-antiga', 'ex-supino', 1, 10, 60, 1, '${T0}'),
          ('s-2', 'sess-antiga', 'ex-supino', 2, 10, 60, 1, '${T0}'),
          ('s-3', 'sess-antiga', 'ex-supino', 3, 10, 60, 1, '${T0}');
      `);

      // 3. Consulta alvos da semana seguinte (2026-10-12)
      const weekTargets = await targetsForWeek('2026-10-12', routine.id);
      const supinoTarget = weekTargets.find((w) => w.exerciseId === 'ex-supino');

      expect(supinoTarget).toBeDefined();
      // Cascateia: sets e reps da ficha (4x8), carga do historico (60kg)!
      expect(supinoTarget?.targets.sets).toBe(4);
      expect(supinoTarget?.targets.reps).toBe(8);
      expect(supinoTarget?.targets.weightKg).toBe(60);
      expect(supinoTarget?.source).toBe('preset');

      // 4. Se o aluno ajusta a semana (override), o override vence tudo
      await setWeekTarget('2026-10-12', supinoTarget!.id, strengthTargets(5, 5, 65));

      const reloaded = await targetsForWeek('2026-10-12', routine.id);
      const supinoReloaded = reloaded.find((w) => w.exerciseId === 'ex-supino');
      expect(supinoReloaded?.targets.sets).toBe(5);
      expect(supinoReloaded?.targets.reps).toBe(5);
      expect(supinoReloaded?.targets.weightKg).toBe(65);
      expect(supinoReloaded?.source).toBe('override');
    });

    it('usa historico completo do aluno quando a rotina e desvinculada', async () => {
      // 1. Aluno adota ficha
      seed(`
        INSERT INTO exercises (id, name, updated_at) VALUES ('ex-supino', 'Supino reto', '${T0}');
      `);
      const routine = await adoptPresetIntoDay('preset-a', 1);

      // 2. Historico do aluno: 3x10 a 60kg
      seed(`
        INSERT INTO sessions (id, routine_id, date, started_at, finished_at, updated_at)
        VALUES ('sess-antiga', '${routine.id}', '2026-10-05', '2026-10-05T10:00:00.000Z', '2026-10-05T11:00:00.000Z', '${T0}');

        INSERT INTO session_sets (id, session_id, exercise_id, set_index, reps, weight_kg, done, updated_at)
        VALUES ('s-1', 'sess-antiga', 'ex-supino', 1, 10, 60, 1, '${T0}');
      `);

      // 3. Desvincula adicionando um exercicio extra
      seed(`
        INSERT INTO exercises (id, name, updated_at) VALUES ('ex-extra', 'Tríceps corda', '${T0}');
      `);
      await addExerciseToRoutine(routine.id, 'ex-extra', strengthTargets(3, 12));

      // 4. Agora desvinculado, o historico do aluno vence integralmente (3x10 com 60kg, e nao 4x8)
      const weekTargets = await targetsForWeek('2026-10-12', routine.id);
      const supinoTarget = weekTargets.find((w) => w.exerciseId === 'ex-supino');

      expect(supinoTarget).toBeDefined();
      expect(supinoTarget?.targets.sets).toBe(1); // 1 serie registrada no mock
      expect(supinoTarget?.targets.reps).toBe(10);
      expect(supinoTarget?.targets.weightKg).toBe(60);
      expect(supinoTarget?.source).toBe('lastActual');
    });
  });

  describe('dia prescrito pelo instrutor (painel, plano 18)', () => {
    // A rotina como o pull a entrega depois de um `staff_set_day`: sem ficha,
    // com quem prescreveu e quando. Series e reps sao do instrutor.
    beforeEach(() => {
      seed(`
        INSERT INTO exercises (id, name, updated_at) VALUES ('ex-remada', 'Remada curvada', '${T0}');
        INSERT INTO routines (id, name, weekday, position, prescribed_by, prescribed_at, updated_at)
        VALUES ('r-pull', 'Pull A', 2, 0, 'instrutor-1', '${T0}', '${T0}');
        INSERT INTO routine_exercises
          (id, routine_id, exercise_id, position, target_sets, target_reps, target_weight_kg, updated_at)
        VALUES ('re-remada', 'r-pull', 'ex-remada', 0, 4, 8, 0, '${T0}');
      `);
    });

    it('series e reps do instrutor, carga do historico do aluno', async () => {
      seed(`
        INSERT INTO sessions (id, routine_id, date, started_at, finished_at, updated_at)
        VALUES ('sess-antiga', 'r-pull', '2026-10-06', '2026-10-06T10:00:00.000Z', '2026-10-06T11:00:00.000Z', '${T0}');
        INSERT INTO session_sets (id, session_id, exercise_id, set_index, reps, weight_kg, done, updated_at)
        VALUES ('s-1', 'sess-antiga', 'ex-remada', 1, 12, 40, 1, '${T0}');
      `);

      const [remada] = await targetsForWeek('2026-10-12', 'r-pull');
      expect(remada.targets).toMatchObject({ sets: 4, reps: 8, weightKg: 40 });
      expect(remada.source).toBe('preset');
    });

    it('editar o dia desvincula do instrutor e guarda quando foi prescrito', async () => {
      seed(`
        INSERT INTO exercises (id, name, updated_at) VALUES ('ex-rosca', 'Rosca direta', '${T0}');
      `);

      await addExerciseToRoutine('r-pull', 'ex-rosca', strengthTargets(3, 12));

      const updated = row('routines', 'r-pull');
      expect(updated?.prescribed_by).toBeNull();
      // O painel mostra "editado pelo aluno" por esta coluna
      expect(updated?.prescribed_at).toBe(T0);
      const queued = raw
        .prepare("SELECT COUNT(*) AS n FROM outbox WHERE table_name = 'routines' AND row_id = 'r-pull'")
        .get() as { n: number };
      expect(queued.n).toBe(1);

      // Desvinculado, o historico volta a mandar (sem historico: a semente)
      const [remada] = await targetsForWeek('2026-10-12', 'r-pull');
      expect(remada.source).toBe('plan');
    });

    it('adotar uma ficha num dia prescrito tira o dia do instrutor', async () => {
      const routine = await adoptPresetIntoDay('preset-a', 2);

      expect(routine.id).toBe('r-pull');
      const updated = row('routines', 'r-pull');
      expect(updated?.preset_id).toBe('preset-a');
      expect(updated?.prescribed_by).toBeNull();
    });
  });

  describe('planos da academia (plano 20)', () => {
    // Plano "Hipertrofia": segunda = ficha A, quarta = ficha B (preset-b, sem exercicios)
    beforeEach(() => {
      seed(`
        INSERT INTO local_gym_plans (id, gym_id, name, open_to_students, position, updated_at)
        VALUES ('plano-1', 'gym-iron', 'Hipertrofia', 1, 0, '${T0}');
        INSERT INTO local_gym_plan_days (id, plan_id, gym_id, weekday, preset_id, updated_at) VALUES
          ('pd-1', 'plano-1', 'gym-iron', 1, 'preset-a', '${T0}'),
          ('pd-3', 'plano-1', 'gym-iron', 3, 'preset-b', '${T0}');
      `);
    });

    it('lista o plano com os dias em ordem', async () => {
      const [plan] = await listLocalPlans('gym-iron');
      expect(plan).toMatchObject({ name: 'Hipertrofia', openToStudents: true });
      expect(plan.days).toEqual([
        { weekday: 1, presetId: 'preset-a' },
        { weekday: 3, presetId: 'preset-b' },
      ]);
    });

    it('seguir o plano poe cada treino no dia e marca o plano', async () => {
      await adoptPlan('plano-1', 'gym-iron');

      const rows = raw
        .prepare('SELECT weekday, preset_id, plan_id FROM routines WHERE deleted_at IS NULL ORDER BY weekday')
        .all() as { weekday: number; preset_id: string; plan_id: string }[];
      expect(rows).toEqual([
        { weekday: 1, preset_id: 'preset-a', plan_id: 'plano-1' },
        { weekday: 3, preset_id: 'preset-b', plan_id: 'plano-1' },
      ]);
      const queued = raw.prepare("SELECT COUNT(DISTINCT row_id) AS n FROM outbox WHERE table_name = 'routines'").get() as {
        n: number;
      };
      expect(queued.n).toBe(2);
    });

    it('editar um dia do plano tira so aquele dia do plano', async () => {
      await adoptPlan('plano-1', 'gym-iron');
      const monday = raw.prepare('SELECT id FROM routines WHERE weekday = 1').get() as { id: string };
      seed(`INSERT INTO exercises (id, name, updated_at) VALUES ('ex-extra', 'Tríceps corda', '${T0}');`);

      await addExerciseToRoutine(monday.id, 'ex-extra', strengthTargets(3, 12));

      expect(row('routines', monday.id)).toMatchObject({ preset_id: null, plan_id: null });
      const wednesday = raw.prepare('SELECT plan_id FROM routines WHERE weekday = 3').get() as { plan_id: string };
      expect(wednesday.plan_id).toBe('plano-1');
    });

    it('adotar so uma ficha num dia do plano tira o dia do plano', async () => {
      await adoptPlan('plano-1', 'gym-iron');
      await adoptPresetIntoDay('preset-b', 1);
      const monday = raw.prepare('SELECT preset_id, plan_id FROM routines WHERE weekday = 1').get();
      expect(monday).toMatchObject({ preset_id: 'preset-b', plan_id: null });
    });
  });
});

import { DatabaseSync } from 'node:sqlite';

import { listLocalPlans, listLocalPresetExercises, listLocalPresets } from '@/db/repo';
import { MIGRATIONS } from '@/db/schema';

import { bumpData } from '@/store/data';

import { pullPresets } from '../presets';

jest.mock('expo-crypto', () => ({
  randomUUID: () => crypto.randomUUID(),
}));

jest.mock('@/world', () => ({ GYM: 'gym-iron' }));
jest.mock('@/store/data', () => ({ bumpData: jest.fn() }));

let mockDb: ReturnType<typeof adapter>;
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));

type Result = { data: unknown[] | null; error: { message: string } | null };
let mockResults: Record<string, Result> = {};
const mockQueried: { table: string; gym: string }[] = [];

jest.mock('../supabase', () => ({
  get supabase() {
    return {
      from: (table: string) => ({
        select: () => ({
          eq: (_col: string, gym: string) => ({
            is: () => {
              mockQueried.push({ table, gym });
              // Tabela sem resultado no caso (os planos, nos testes das fichas): vazia.
              return Promise.resolve(mockResults[table] ?? { data: [], error: null });
            },
          }),
        }),
      }),
    };
  },
}));

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

const preset = (id: string, name: string, position = 0) => ({
  id,
  gym_id: 'gym-iron',
  name,
  position,
  updated_at: T0,
  deleted_at: null,
});

const presetExercise = (id: string, presetId: string, name: string, position = 0) => ({
  id,
  preset_id: presetId,
  gym_id: 'gym-iron',
  movement_slug: 'bench-press',
  name,
  muscle_group: 'Peito',
  kind: 'strength',
  position,
  target_sets: 4,
  target_reps: 8,
  target_distance_km: 0,
  target_duration_min: 0,
  updated_at: T0,
  deleted_at: null,
});

beforeEach(() => {
  raw = new DatabaseSync(':memory:');
  for (const migration of MIGRATIONS) raw.exec(migration);
  mockDb = adapter(raw);
  mockResults = {};
  mockQueried.length = 0;
  jest.mocked(bumpData).mockClear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  raw.close();
  jest.restoreAllMocks();
});

describe('pullPresets', () => {
  it('baixa as fichas do mundo atual para o cache local', async () => {
    mockResults = {
      gym_presets: { data: [preset('p-a', 'Ficha A')], error: null },
      gym_preset_exercises: {
        data: [presetExercise('pe-1', 'p-a', 'Supino reto')],
        error: null,
      },
    };

    await pullPresets();

    expect(mockQueried).toEqual([
      { table: 'gym_presets', gym: 'gym-iron' },
      { table: 'gym_preset_exercises', gym: 'gym-iron' },
      { table: 'gym_plans', gym: 'gym-iron' },
      { table: 'gym_plan_days', gym: 'gym-iron' },
    ]);
    const presets = await listLocalPresets('gym-iron');
    expect(presets.map((p) => p.name)).toEqual(['Ficha A']);
    const exercises = await listLocalPresetExercises('p-a');
    expect(exercises).toHaveLength(1);
    expect(exercises[0]).toMatchObject({
      name: 'Supino reto',
      muscleGroup: 'Peito',
      kind: 'strength',
      targetSets: 4,
      targetReps: 8,
    });
  });

  it('troca o cache inteiro: ficha que saiu do servidor some daqui', async () => {
    mockResults = {
      gym_presets: { data: [preset('p-a', 'Ficha A'), preset('p-b', 'Ficha B', 1)], error: null },
      gym_preset_exercises: { data: [presetExercise('pe-1', 'p-a', 'Supino reto')], error: null },
    };
    await pullPresets();

    mockResults = {
      gym_presets: { data: [preset('p-b', 'Ficha B', 1)], error: null },
      gym_preset_exercises: { data: [], error: null },
    };
    await pullPresets();

    const presets = await listLocalPresets('gym-iron');
    expect(presets.map((p) => p.id)).toEqual(['p-b']);
    expect(await listLocalPresetExercises('p-a')).toEqual([]);
  });

  it('avisa as telas so quando o cache muda', async () => {
    mockResults = {
      gym_presets: { data: [preset('p-a', 'Ficha A')], error: null },
      gym_preset_exercises: { data: [presetExercise('pe-1', 'p-a', 'Supino reto')], error: null },
    };
    await pullPresets();
    expect(bumpData).toHaveBeenCalledTimes(1);

    // As mesmas linhas de novo: nada mudou
    await pullPresets();
    expect(bumpData).toHaveBeenCalledTimes(1);

    mockResults.gym_preset_exercises = {
      data: [{ ...presetExercise('pe-1', 'p-a', 'Supino reto'), target_reps: 6 }],
      error: null,
    };
    await pullPresets();
    expect(bumpData).toHaveBeenCalledTimes(2);
  });

  it('ignora exercicio de ficha que nao veio', async () => {
    mockResults = {
      gym_presets: { data: [preset('p-a', 'Ficha A')], error: null },
      gym_preset_exercises: { data: [presetExercise('pe-x', 'p-sumiu', 'Remada')], error: null },
    };
    await pullPresets();

    const count = raw.prepare('SELECT COUNT(*) AS n FROM local_gym_preset_exercises').get() as {
      n: number;
    };
    expect(count.n).toBe(0);
  });

  it('mantem o cache quando o servidor devolve erro (ex: sem rede)', async () => {
    mockResults = {
      gym_presets: { data: [preset('p-a', 'Ficha A')], error: null },
      gym_preset_exercises: { data: [presetExercise('pe-1', 'p-a', 'Supino reto')], error: null },
    };
    await pullPresets();

    mockResults = {
      gym_presets: { data: null, error: { message: 'Failed to fetch' } },
      gym_preset_exercises: { data: null, error: { message: 'Failed to fetch' } },
    };
    await pullPresets();

    expect((await listLocalPresets('gym-iron')).map((p) => p.id)).toEqual(['p-a']);
    expect(await listLocalPresetExercises('p-a')).toHaveLength(1);
  });

  it('guarda os planos e os dias no cache, com o aberto em 0/1', async () => {
    mockResults = {
      gym_presets: { data: [preset('p-a', 'Ficha A')], error: null },
      gym_preset_exercises: { data: [], error: null },
      gym_plans: {
        data: [{ id: 'pl-1', gym_id: 'gym-iron', name: 'Hipertrofia', open_to_students: true, position: 0, updated_at: T0, deleted_at: null }],
        error: null,
      },
      gym_plan_days: {
        data: [
          { id: 'd-1', plan_id: 'pl-1', gym_id: 'gym-iron', weekday: 1, preset_id: 'p-a', updated_at: T0, deleted_at: null },
          // dia de um plano que nao veio: fica de fora
          { id: 'd-x', plan_id: 'pl-x', gym_id: 'gym-iron', weekday: 2, preset_id: 'p-a', updated_at: T0, deleted_at: null },
        ],
        error: null,
      },
    };

    await pullPresets();

    expect(await listLocalPlans('gym-iron')).toEqual([
      { id: 'pl-1', gymId: 'gym-iron', name: 'Hipertrofia', openToStudents: true, position: 0, days: [{ weekday: 1, presetId: 'p-a' }] },
    ]);
    jest.mocked(bumpData).mockClear();
    await pullPresets();
    expect(bumpData).not.toHaveBeenCalled();
  });
});

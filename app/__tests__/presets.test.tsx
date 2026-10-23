import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import * as repo from '@/db/repo';
import type { GymPreset, GymPresetExercise, Routine } from '@/domain/types';

import PresetsScreen from '../presets';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useIsFocused: () => true,
  useFocusEffect: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('@/ui/Ambient', () => ({
  Ambient: () => null,
}));

jest.mock('@/ui/haptics', () => ({
  confirm: jest.fn(),
  nudge: jest.fn(),
}));

jest.mock('@/world', () => ({
  GYM: 'iron',
}));

let mockSuggestedOn = true;
jest.mock('@/store/flags', () => ({
  FLAG_SUGGESTED_WORKOUTS: 'suggested_workouts',
  useFlag: () => mockSuggestedOn,
}));

jest.mock('@/db/repo', () => ({
  listLocalPresets: jest.fn(),
  listLocalPresetExercises: jest.fn(),
  listRoutines: jest.fn(),
  routineExerciseCounts: jest.fn(),
  adoptPresetIntoDay: jest.fn(),
  adoptPlan: jest.fn(),
  listLocalPlans: jest.fn(async () => []),
}));

const samplePreset: GymPreset = {
  id: 'preset-push',
  gymId: 'iron',
  name: 'Superior Foco Peito',
  position: 0,
  updatedAt: '2026-10-12T00:00:00.000Z',
  deletedAt: null,
};

const sampleExercises: GymPresetExercise[] = [
  {
    id: 'pe-1',
    presetId: 'preset-push',
    gymId: 'iron',
    movementSlug: 'supino-reto',
    name: 'Supino Reto',
    muscleGroup: 'Peito',
    kind: 'strength',
    position: 0,
    targetSets: 4,
    targetReps: 10,
    targetDistanceKm: 0,
    targetDurationMin: 0,
    updatedAt: '2026-10-12T00:00:00.000Z',
    deletedAt: null,
  },
  {
    id: 'pe-2',
    presetId: 'preset-push',
    gymId: 'iron',
    movementSlug: 'crucifixo',
    name: 'Crucifixo',
    muscleGroup: 'Peito',
    kind: 'strength',
    position: 1,
    targetSets: 3,
    targetReps: 12,
    targetDistanceKm: 0,
    targetDurationMin: 0,
    updatedAt: '2026-10-12T00:00:00.000Z',
    deletedAt: null,
  },
];

describe('PresetsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSuggestedOn = true;
  });

  it('esconde as fichas quando a flag da academia esta desligada', async () => {
    mockSuggestedOn = false;
    jest.mocked(repo.listLocalPresets).mockResolvedValueOnce([samplePreset]);
    jest.mocked(repo.listLocalPresetExercises).mockResolvedValueOnce(sampleExercises);
    jest.mocked(repo.listRoutines).mockResolvedValueOnce([]);
    jest.mocked(repo.routineExerciseCounts).mockResolvedValueOnce(new Map());

    render(<PresetsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma ficha cadastrada')).toBeTruthy();
    });
    expect(screen.queryByText('Superior Foco Peito')).toBeNull();
  });

  it('mostra o nome da ficha, e nao o da biblioteca', async () => {
    jest.mocked(repo.listLocalPresets).mockResolvedValueOnce([samplePreset]);
    jest
      .mocked(repo.listLocalPresetExercises)
      .mockResolvedValueOnce([{ ...sampleExercises[0], movementSlug: 'bench-press', name: 'Supino da casa' }]);
    jest.mocked(repo.listRoutines).mockResolvedValueOnce([]);
    jest.mocked(repo.routineExerciseCounts).mockResolvedValueOnce(new Map());

    render(<PresetsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Supino da casa')).toBeTruthy();
    });
  });

  it('renderiza estado vazio quando a academia não tem fichas cadastradas', async () => {
    jest.mocked(repo.listLocalPresets).mockResolvedValueOnce([]);
    jest.mocked(repo.listRoutines).mockResolvedValueOnce([]);
    jest.mocked(repo.routineExerciseCounts).mockResolvedValueOnce(new Map());

    render(<PresetsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma ficha cadastrada')).toBeTruthy();
    });

    const voltarBtn = screen.getByText('Voltar');
    fireEvent.press(voltarBtn);
    expect(mockBack).toHaveBeenCalled();
  });

  it('lista as fichas da academia e seus exercícios', async () => {
    jest.mocked(repo.listLocalPresets).mockResolvedValueOnce([samplePreset]);
    jest.mocked(repo.listLocalPresetExercises).mockResolvedValueOnce(sampleExercises);
    jest.mocked(repo.listRoutines).mockResolvedValueOnce([]);
    jest.mocked(repo.routineExerciseCounts).mockResolvedValueOnce(new Map());

    render(<PresetsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Superior Foco Peito')).toBeTruthy();
      expect(screen.getByText('2 exercícios')).toBeTruthy();
      expect(screen.getByText('4 × 10')).toBeTruthy();
      expect(screen.getByText('3 × 12')).toBeTruthy();
    });
  });

  it('adota a ficha diretamente quando o dia escolhido está em descanso', async () => {
    jest.mocked(repo.listLocalPresets).mockResolvedValue([samplePreset]);
    jest.mocked(repo.listLocalPresetExercises).mockResolvedValue(sampleExercises);
    jest.mocked(repo.listRoutines).mockResolvedValue([]);
    jest.mocked(repo.routineExerciseCounts).mockResolvedValue(new Map());
    jest.mocked(repo.adoptPresetIntoDay).mockResolvedValueOnce({
      id: 'routine-mon',
      weekday: 1,
      name: 'Superior Foco Peito',
      position: 0,
      presetId: 'preset-push',
      updatedAt: '2026-10-12T00:00:00.000Z',
      deletedAt: null,
    });

    render(<PresetsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Superior Foco Peito')).toBeTruthy();
    });

    // Clica em "Colocar na semana"
    fireEvent.press(screen.getByText('Colocar na semana'));

    await waitFor(() => {
      expect(screen.getByText('Em qual dia você quer treinar?')).toBeTruthy();
    });

    // Escolhe Segunda (weekday 1)
    fireEvent.press(screen.getByLabelText('Escolher Segunda'));

    await waitFor(() => {
      expect(repo.adoptPresetIntoDay).toHaveBeenCalledWith('preset-push', 1);
    });
  });

  it('pede confirmação ao tentar substituir dia que já possui treino', async () => {
    const existingRoutine: Routine = {
      id: 'routine-tue',
      weekday: 2,
      name: 'Treino Anterior',
      position: 0,
      presetId: null,
      updatedAt: '2026-10-12T00:00:00.000Z',
      deletedAt: null,
    };
    const countsMap = new Map<string, number>([['routine-tue', 4]]);

    jest.mocked(repo.listLocalPresets).mockResolvedValue([samplePreset]);
    jest.mocked(repo.listLocalPresetExercises).mockResolvedValue(sampleExercises);
    jest.mocked(repo.listRoutines).mockResolvedValue([existingRoutine]);
    jest.mocked(repo.routineExerciseCounts).mockResolvedValue(countsMap);
    jest.mocked(repo.adoptPresetIntoDay).mockResolvedValueOnce({
      ...existingRoutine,
      name: 'Superior Foco Peito',
      presetId: 'preset-push',
    });

    render(<PresetsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Superior Foco Peito')).toBeTruthy();
    });

    // Clica em "Colocar na semana"
    fireEvent.press(screen.getByText('Colocar na semana'));

    await waitFor(() => {
      expect(screen.getByText('Em qual dia você quer treinar?')).toBeTruthy();
    });

    // Escolhe Terça (weekday 2 que já tem 4 exercícios)
    fireEvent.press(screen.getByLabelText('Escolher Terça'));

    // Modal de confirmação deve aparecer
    await waitFor(() => {
      expect(screen.getByText('Substituir treino de Terça?')).toBeTruthy();
    });

    // Clica em "Substituir"
    fireEvent.press(screen.getByText('Substituir'));

    await waitFor(() => {
      expect(repo.adoptPresetIntoDay).toHaveBeenCalledWith('preset-push', 2);
    });
  });

  it('plano aberto: mostra a semana e avisa quais dias com treino ele substitui', async () => {
    jest.mocked(repo.listLocalPresets).mockResolvedValueOnce([samplePreset]);
    jest.mocked(repo.listLocalPresetExercises).mockResolvedValueOnce(sampleExercises);
    jest.mocked(repo.listRoutines).mockResolvedValueOnce([
      { id: 'r-seg', name: 'Meu treino', weekday: 1, position: 0, updatedAt: '2026-10-12T00:00:00.000Z', deletedAt: null },
    ]);
    jest.mocked(repo.routineExerciseCounts).mockResolvedValueOnce(new Map([['r-seg', 3]]));
    jest.mocked(repo.listLocalPlans).mockResolvedValueOnce([
      {
        id: 'plano-1',
        gymId: 'iron',
        name: 'Hipertrofia',
        openToStudents: true,
        position: 0,
        days: [
          { weekday: 1, presetId: 'preset-push' },
          { weekday: 3, presetId: 'preset-push' },
        ],
      },
    ]);
    jest.mocked(repo.adoptPlan).mockResolvedValueOnce();

    render(<PresetsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Hipertrofia')).toBeTruthy();
      expect(screen.getByText('Seg Superior Foco Peito · Qua Superior Foco Peito')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Seguir plano'));
    await waitFor(() => {
      expect(
        screen.getByText(
          'Os dias do plano recebem os treinos dele, com as suas cargas. Substitui o treino de segunda. O histórico continua salvo.',
        ),
      ).toBeTruthy();
    });
  });
});

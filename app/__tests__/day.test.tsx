import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import * as repo from '@/db/repo';
import type { WeekExercise } from '@/db/repo';
import type { Routine } from '@/domain/types';

import DayScreen from '../day/[weekday]';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ weekday: '1' }),
  useRouter: () => ({ back: jest.fn() }),
  useIsFocused: () => true,
  useFocusEffect: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('@/ui/Ambient', () => ({
  Ambient: () => null,
}));

jest.mock('@/db/repo', () => ({
  ensureDayRoutine: jest.fn(),
  ensureRunExercise: jest.fn(),
  targetsForWeek: jest.fn(),
  listExercises: jest.fn(),
  addExerciseToRoutine: jest.fn(),
  removeRoutineExercise: jest.fn(),
  reorderRoutineExercises: jest.fn(),
  setWeekTarget: jest.fn(),
  updateRoutine: jest.fn(),
}));

const mockRoutineLinked: Routine = {
  id: 'routine-1',
  weekday: 1,
  name: 'Superior Foco Peito',
  position: 0,
  presetId: 'preset-push',
  updatedAt: '2026-10-12T00:00:00.000Z',
  deletedAt: null,
};

const mockRoutineUnlinked: Routine = {
  id: 'routine-1',
  weekday: 1,
  name: 'Meu Treino',
  position: 0,
  presetId: null,
  updatedAt: '2026-10-12T00:00:00.000Z',
  deletedAt: null,
};

const mockRoutineInstructor: Routine = {
  ...mockRoutineUnlinked,
  name: 'Pull B',
  prescribedBy: 'instrutor-1',
  prescribedAt: '2026-10-23T13:30:52.967Z',
};

const mockItem: WeekExercise = {
  id: 're-1',
  routineId: 'routine-1',
  exerciseId: 'ex-1',
  exerciseName: 'Supino Reto',
  exerciseKind: 'strength',
  position: 0,
  updatedAt: '2026-10-12T00:00:00.000Z',
  deletedAt: null,
  presetExerciseId: null,
  targetSets: 4,
  targetReps: 10,
  targetWeightKg: 60,
  targetDistanceKm: 0,
  targetDurationMin: 0,
  targets: {
    sets: 4,
    reps: 10,
    weightKg: 60,
    distanceKm: 0,
    durationMin: 0,
  },
  source: 'plan',
};

describe('DayScreen — Vínculo com ficha sugerida', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(repo.ensureRunExercise).mockResolvedValue({} as any);
    jest.mocked(repo.listExercises).mockResolvedValue([
      { id: 'ex-1', name: 'Supino Reto', muscleGroup: 'Peito', kind: 'strength', updatedAt: '2026-10-12T00:00:00.000Z', deletedAt: null },
      { id: 'ex-2', name: 'Crucifixo', muscleGroup: 'Peito', kind: 'strength', updatedAt: '2026-10-12T00:00:00.000Z', deletedAt: null },
    ]);
  });

  it('exibe aviso de ficha sugerida e pede confirmação antes de adicionar exercício', async () => {
    jest.mocked(repo.ensureDayRoutine).mockResolvedValue(mockRoutineLinked);
    jest.mocked(repo.targetsForWeek).mockResolvedValue([mockItem]);

    render(<DayScreen />);

    // Deve exibir aviso sob o nome do treino
    await waitFor(() => {
      expect(
        screen.getByText('Ficha sugerida pela academia · Recebe atualizações do instrutor'),
      ).toBeTruthy();
    });

    // Clica no botão flutuante de adicionar exercício
    fireEvent.press(screen.getByText('Adicionar exercício'));

    // Modal de confirmação de desvinculação deve abrir
    await waitFor(() => {
      expect(screen.getByText('Personalizar este treino?')).toBeTruthy();
      expect(
        screen.getByText(
          'Este treino segue a ficha da academia. Ao adicionar um exercício, ele passará a ser totalmente seu e deixará de receber atualizações do instrutor.',
        ),
      ).toBeTruthy();
    });

    // Ao confirmar, abre o ExercisePicker
    fireEvent.press(screen.getByText('Continuar e personalizar'));

    await waitFor(() => {
      expect(screen.getByText('Passa a valer toda segunda')).toBeTruthy();
    });
  });

  it('avisa sobre desvinculação ao remover um exercício de ficha sugerida', async () => {
    jest.mocked(repo.ensureDayRoutine).mockResolvedValue(mockRoutineLinked);
    jest.mocked(repo.targetsForWeek).mockResolvedValue([mockItem]);

    render(<DayScreen />);

    await waitFor(() => {
      expect(screen.getByText('Supino Reto')).toBeTruthy();
    });

    // Clica no botão de remover exercício
    fireEvent.press(screen.getByLabelText('Remover Supino Reto do plano'));

    // Modal deve explicar que deixará de seguir a ficha
    await waitFor(() => {
      expect(screen.getByText('Remover Supino Reto do plano?')).toBeTruthy();
      expect(
        screen.getByText(
          'Sai de toda segunda a partir de agora. Este treino deixará de seguir a ficha da academia e não receberá mais atualizações do instrutor.',
        ),
      ).toBeTruthy();
    });
  });

  it('não exibe aviso de ficha nem modal de desvinculação quando o treino não é vinculado', async () => {
    jest.mocked(repo.ensureDayRoutine).mockResolvedValue(mockRoutineUnlinked);
    jest.mocked(repo.targetsForWeek).mockResolvedValue([mockItem]);

    render(<DayScreen />);

    await waitFor(() => {
      expect(screen.getByText('Supino Reto')).toBeTruthy();
    });

    // Não deve exibir aviso de ficha sugerida
    expect(
      screen.queryByText('Ficha sugerida pela academia · Recebe atualizações do instrutor'),
    ).toBeNull();

    // Clica em adicionar exercício
    fireEvent.press(screen.getByText('Adicionar exercício'));

    // Deve abrir o picker direto sem modal de confirmação de desvinculação
    await waitFor(() => {
      expect(screen.queryByText('Personalizar este treino?')).toBeNull();
      expect(screen.getByText('Passa a valer toda segunda')).toBeTruthy();
    });
  });

  it('dia do instrutor: aviso proprio e o mesmo cuidado antes de editar', async () => {
    jest.mocked(repo.ensureDayRoutine).mockResolvedValue(mockRoutineInstructor);
    jest.mocked(repo.targetsForWeek).mockResolvedValue([{ ...mockItem, source: 'preset' }]);

    render(<DayScreen />);

    await waitFor(() => {
      expect(screen.getByText('Treino do instrutor · Recebe as mudanças dele')).toBeTruthy();
    });
    expect(
      screen.queryByText('Ficha sugerida pela academia · Recebe atualizações do instrutor'),
    ).toBeNull();

    fireEvent.press(screen.getByLabelText('Remover Supino Reto do plano'));
    await waitFor(() => {
      expect(
        screen.getByText(
          'Sai de toda segunda a partir de agora. Este treino deixará de seguir a prescrição e não receberá mais atualizações do instrutor.',
        ),
      ).toBeTruthy();
    });
    expect(repo.removeRoutineExercise).not.toHaveBeenCalled();
  });

  it('dia do instrutor: adicionar exercicio pede confirmacao', async () => {
    jest.mocked(repo.ensureDayRoutine).mockResolvedValue(mockRoutineInstructor);
    jest.mocked(repo.targetsForWeek).mockResolvedValue([mockItem]);

    render(<DayScreen />);
    await waitFor(() => expect(screen.getByText('Supino Reto')).toBeTruthy());

    fireEvent.press(screen.getByText('Adicionar exercício'));
    await waitFor(() => {
      expect(
        screen.getByText(
          'Este treino segue a prescrição. Ao adicionar um exercício, ele passará a ser totalmente seu e deixará de receber atualizações do instrutor.',
        ),
      ).toBeTruthy();
    });
  });
});

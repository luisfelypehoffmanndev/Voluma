import type { Exercise, GymPresetExercise } from '../types';
import { linkSourceName, matchMovementForPreset, preparePresetAdoption, routineLink } from '../presets';

describe('domain presets', () => {
  const existingExercises: Exercise[] = [
    {
      id: 'e-supino',
      name: 'Supino Reto',
      muscleGroup: 'Peito',
      kind: 'strength',
      updatedAt: '2026-10-10T00:00:00.000Z',
      deletedAt: null,
    },
    {
      id: 'e-remada',
      name: 'Remada curvada com barra',
      muscleGroup: 'Costas',
      kind: 'strength',
      updatedAt: '2026-10-10T00:00:00.000Z',
      deletedAt: null,
    },
    {
      id: 'e-deletado',
      name: 'Agachamento livre',
      muscleGroup: 'Pernas',
      kind: 'strength',
      updatedAt: '2026-10-10T00:00:00.000Z',
      deletedAt: '2026-10-11T00:00:00.000Z',
    },
  ];

  describe('matchMovementForPreset', () => {
    it('encontra movimento na biblioteca e casa com exercicio do usuario pelo nome', () => {
      // bench-press -> "Supino reto" na biblioteca
      const match = matchMovementForPreset({ movementSlug: 'bench-press', name: 'Supino reto' }, existingExercises);
      expect(match.movement).not.toBeNull();
      expect(match.movement?.slug).toBe('bench-press');
      expect(match.existingExercise?.id).toBe('e-supino');
    });

    it('encontra movimento na biblioteca mas nao casa quando usuario nao tem exercicio ativo', () => {
      // squat -> "Agachamento livre" (mas o do usuario esta deletado)
      const match = matchMovementForPreset({ movementSlug: 'squat', name: 'Agachamento livre' }, existingExercises);
      expect(match.movement).not.toBeNull();
      expect(match.existingExercise).toBeNull();
    });

    it('trata slug desconhecido graciosamente', () => {
      const match = matchMovementForPreset(
        { movementSlug: 'slug-inexistente', name: 'Movimento da casa' },
        existingExercises,
      );
      expect(match.movement).toBeNull();
      expect(match.existingExercise).toBeNull();
    });

    it('casa pelo nome da ficha mesmo com slug fora da biblioteca', () => {
      const match = matchMovementForPreset(
        { movementSlug: 'slug-inexistente', name: 'remada curvada com barra' },
        existingExercises,
      );
      expect(match.movement).toBeNull();
      expect(match.existingExercise?.id).toBe('e-remada');
    });

    it('cai no nome da biblioteca quando o nome da ficha nao casa', () => {
      const match = matchMovementForPreset(
        { movementSlug: 'bench-press', name: 'Supino com barra' },
        existingExercises,
      );
      expect(match.existingExercise?.id).toBe('e-supino');
    });
  });

  describe('preparePresetAdoption', () => {
    it('monta a lista de rascunhos reaproveitando id quando existe e deixando null quando precisa criar', () => {
      const presetExercises: GymPresetExercise[] = [
        {
          id: 'pe-1',
          presetId: 'p-1',
          gymId: 'padrao',
          movementSlug: 'bench-press',
          name: 'Supino reto',
          muscleGroup: null,
          kind: 'strength',
          position: 0,
          targetSets: 4,
          targetReps: 8,
          targetDistanceKm: 0,
          targetDurationMin: 0,
          updatedAt: '2026-10-10T00:00:00.000Z',
          deletedAt: null,
        },
        {
          id: 'pe-2',
          presetId: 'p-1',
          gymId: 'padrao',
          movementSlug: 'squat',
          name: 'Agachamento livre',
          muscleGroup: null,
          kind: 'strength',
          position: 1,
          targetSets: 3,
          targetReps: 10,
          targetDistanceKm: 0,
          targetDurationMin: 0,
          updatedAt: '2026-10-10T00:00:00.000Z',
          deletedAt: null,
        },
      ];

      const drafts = preparePresetAdoption(presetExercises, existingExercises);

      expect(drafts).toHaveLength(2);
      expect(drafts[0]).toEqual({
        presetExerciseId: 'pe-1',
        exerciseId: 'e-supino',
        exerciseName: 'Supino reto',
        muscleGroup: 'Peito',
        kind: 'strength',
        targetSets: 4,
        targetReps: 8,
        targetDistanceKm: 0,
        targetDurationMin: 0,
        position: 0,
      });

      expect(drafts[1]).toEqual({
        presetExerciseId: 'pe-2',
        exerciseId: null,
        exerciseName: 'Agachamento livre',
        muscleGroup: 'Pernas',
        kind: 'strength',
        targetSets: 3,
        targetReps: 10,
        targetDistanceKm: 0,
        targetDurationMin: 0,
        position: 1,
      });
    });
  });
});

describe('routineLink', () => {
  it('ficha, instrutor ou do proprio aluno', () => {
    expect(routineLink({ presetId: 'p-1', prescribedBy: null })).toBe('preset');
    expect(routineLink({ presetId: 'p-1', planId: 'plano-1' })).toBe('plan');
    // plan_id sobrando sem treino (app antigo desvinculou): o dia e do aluno
    expect(routineLink({ presetId: null, planId: 'plano-1' })).toBeNull();
    expect(routineLink({ presetId: null, prescribedBy: 'instrutor-1' })).toBe('instructor');
    expect(routineLink({ presetId: null, prescribedBy: null })).toBeNull();
    expect(routineLink(undefined)).toBeNull();
  });

  it('dia desvinculado pelo aluno (so o prescribed_at ficou) e do aluno', () => {
    expect(routineLink({ presetId: null, prescribedBy: null })).toBeNull();
  });

  it('nomeia o que o aviso de desvincular cita', () => {
    expect(linkSourceName('preset')).toBe('a ficha da academia');
    expect(linkSourceName('instructor')).toBe('a prescrição');
    expect(linkSourceName('plan')).toBe('o plano da academia');
  });
});

import type { ExerciseKind } from '@/domain/types';

import type { MuscleGroup } from '@/db/catalog';

/**
 * O vocabulario do workout-guide traduzido para o do Voluma.
 *
 * A biblioteca de la classifica por musculo (20 valores) e equipamento (17). O
 * app tem nove grupos, e eles nao sao anatomia: sao a ordem em que as pessoas
 * montam o dia (ver `MUSCLE_GROUPS` em src/db/catalog.ts). Este arquivo e a
 * ponte, e existe separado para que a lista de 288 nomes nao precise repetir a
 * mesma decisao 288 vezes.
 */

export type GuideMuscle =
  | 'Adductors'
  | 'Back'
  | 'Biceps'
  | 'Calves'
  | 'Chest'
  | 'Core'
  | 'Forearms'
  | 'Glutes'
  | 'Hamstrings'
  | 'Hips'
  | 'Lats'
  | 'Legs'
  | 'Lower Back'
  | 'Mobility'
  | 'Posterior Chain'
  | 'Quads'
  | 'Rear Delts'
  | 'Shoulders'
  | 'Triceps'
  | 'Upper Back';

export type GuideEquipment =
  | 'Barbell'
  | 'Bench'
  | 'Bodyweight'
  | 'Box'
  | 'Cable'
  | 'Cardio'
  | 'Chair'
  | 'Doorway'
  | 'Dumbbell'
  | 'Kettlebell'
  | 'Machine'
  | 'Plate'
  | 'Pull-up Bar'
  | 'Resistance Band'
  | 'Stability Ball'
  | 'Towel'
  | 'Wall';

/** O que o movimento mede, no vocabulario do workout-guide. */
export type ExerciseType =
  | 'assisted_bodyweight'
  | 'bodyweight_reps'
  | 'distance_duration'
  | 'duration'
  | 'weight_reps';

/**
 * Musculo primario -> grupo do app.
 *
 * O colapso e agressivo de proposito. "Lats", "Upper Back" e "Posterior Chain"
 * viram Costas porque ninguem monta um dia de trapezio medio; a distincao que o
 * app precisa e a que aparece na lista, e la ela e por dia de treino.
 */
const GROUP_BY_MUSCLE: Readonly<Record<GuideMuscle, MuscleGroup>> = {
  Chest: 'Peito',

  Back: 'Costas',
  Lats: 'Costas',
  'Upper Back': 'Costas',
  'Lower Back': 'Costas',
  'Posterior Chain': 'Costas',

  Quads: 'Pernas',
  Hamstrings: 'Pernas',
  Legs: 'Pernas',
  Calves: 'Pernas',
  Adductors: 'Pernas',
  Hips: 'Pernas',
  Mobility: 'Pernas',

  Glutes: 'Glúteos',

  Shoulders: 'Ombros',
  'Rear Delts': 'Ombros',

  Biceps: 'Bíceps',
  // Antebraco nao ganha secao propria: sao cinco movimentos, e quem treina
  // punho treina no dia de biceps.
  Forearms: 'Bíceps',

  Triceps: 'Tríceps',

  Core: 'Abdômen',
};

const EQUIPMENT_PT: Readonly<Record<GuideEquipment, string>> = {
  Barbell: 'Barra',
  Bench: 'Banco',
  Bodyweight: 'Peso do corpo',
  Box: 'Caixote',
  Cable: 'Polia',
  Cardio: 'Aparelho de cardio',
  Chair: 'Cadeira',
  Doorway: 'Batente',
  Dumbbell: 'Halteres',
  Kettlebell: 'Kettlebell',
  Machine: 'Máquina',
  Plate: 'Anilha',
  'Pull-up Bar': 'Barra fixa',
  'Resistance Band': 'Elástico',
  'Stability Ball': 'Bola',
  Towel: 'Toalha',
  Wall: 'Parede',
};

/** Os rotulos de equipamento, na ordem em que os chips do filtro aparecem. */
export const EQUIPMENT_LABELS: readonly string[] = [
  'Barra',
  'Halteres',
  'Máquina',
  'Polia',
  'Peso do corpo',
  'Barra fixa',
  'Elástico',
  'Kettlebell',
  'Banco',
  'Caixote',
  'Anilha',
  'Bola',
  'Cadeira',
  'Batente',
  'Toalha',
  'Parede',
  'Aparelho de cardio',
];

export function equipmentLabel(equipment: GuideEquipment): string {
  return EQUIPMENT_PT[equipment];
}

/**
 * O grupo em que o movimento aparece.
 *
 * Cardio passa por cima do musculo: correr trabalha perna, mas ninguem procura
 * corrida na secao de pernas. Sao os que se registram em tempo num aparelho ou
 * na rua — `distance_duration`, mais o que usa equipamento de cardio.
 */
export function groupFor(muscle: GuideMuscle, equipment: GuideEquipment, type: ExerciseType) {
  if (isCardio(equipment, type)) return 'Cardio' as MuscleGroup;
  return GROUP_BY_MUSCLE[muscle];
}

/**
 * Como o app registra o movimento.
 *
 * So existem dois: `strength` (series x reps x carga) e `run` (distancia e
 * tempo). Cardio vira `run` porque e o unico dos dois com campo de tempo — para
 * pular corda a distancia fica em zero, o que e feio mas honesto.
 *
 * Os 39 movimentos `duration` que nao sao cardio (prancha, wall sit, isometria)
 * ficam em `strength`, registrados em series e reps, exatamente como "Prancha"
 * ja e hoje. O `exerciseType` fica guardado no `Movement` para que trocar isso
 * depois seja barato.
 */
export function kindFor(equipment: GuideEquipment, type: ExerciseType): ExerciseKind {
  return isCardio(equipment, type) ? 'run' : 'strength';
}

function isCardio(equipment: GuideEquipment, type: ExerciseType) {
  return type === 'distance_duration' || equipment === 'Cardio';
}

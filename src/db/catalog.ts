import type { ExerciseKind } from '@/domain/types';

import { createExercise, listExercises } from './repo';

/**
 * Os movimentos comuns de academia, com o nome que se usa no Brasil.
 *
 * Existe para resolver o pior primeiro contato do catalogo: uma tela vazia onde
 * o usuario teria que digitar quarenta nomes antes de montar o primeiro treino.
 * Nada aqui e obrigatorio — sao linhas normais de `exercises`, que se apagam
 * como qualquer outra.
 *
 * O nome e a chave de deduplicacao (ver `addMissingCommonExercises`), entao vale
 * a regra: um nome por movimento, o mais reconhecivel, sem sinonimo. "Puxada
 * alta" e nao tambem "Pulley frente"; quem chama de outro jeito renomeia.
 *
 * A corrida nao esta aqui de proposito: ela nasce sob demanda em
 * `ensureRunExercise`, que e quem o botao "Adicionar corrida" da tela do dia
 * chama. Ela e o `kind: 'run'` canonico — a biblioteca de movimentos cria
 * outros (caminhada, bicicleta, remo), e por isso aquela busca desempata pelo
 * nome.
 *
 * Esta lista nao e a biblioteca. Aqui estao os movimentos que o app SEMEIA em
 * banco vazio; os 288 que ele CONHECE estao em `src/movements/library.ts`, sao
 * estaticos e so viram linha quando o usuario adiciona um.
 */

export type CommonExercise = {
  name: string;
  muscleGroup: MuscleGroup;
  kind?: ExerciseKind;
};

/**
 * Os grupos, na ordem em que aparecem na tela.
 *
 * Ordem de treino, nao alfabetica: os grandes primeiro, os pequenos depois, e o
 * que nao e musculacao no fim. E como as pessoas montam o dia.
 */
export const MUSCLE_GROUPS = [
  'Peito',
  'Costas',
  'Pernas',
  'Glúteos',
  'Ombros',
  'Bíceps',
  'Tríceps',
  'Abdômen',
  'Cardio',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const COMMON_EXERCISES: readonly CommonExercise[] = [
  // Peito
  { name: 'Supino reto', muscleGroup: 'Peito' },
  { name: 'Supino inclinado', muscleGroup: 'Peito' },
  { name: 'Supino declinado', muscleGroup: 'Peito' },
  { name: 'Supino com halteres', muscleGroup: 'Peito' },
  { name: 'Crucifixo', muscleGroup: 'Peito' },
  { name: 'Crossover', muscleGroup: 'Peito' },
  { name: 'Peck deck', muscleGroup: 'Peito' },
  { name: 'Flexão de braço', muscleGroup: 'Peito' },
  { name: 'Mergulho em paralelas', muscleGroup: 'Peito' },

  // Costas
  { name: 'Barra fixa', muscleGroup: 'Costas' },
  { name: 'Puxada alta', muscleGroup: 'Costas' },
  { name: 'Remada curvada', muscleGroup: 'Costas' },
  { name: 'Remada baixa', muscleGroup: 'Costas' },
  { name: 'Remada unilateral', muscleGroup: 'Costas' },
  { name: 'Remada cavalinho', muscleGroup: 'Costas' },
  { name: 'Levantamento terra', muscleGroup: 'Costas' },
  { name: 'Pulldown', muscleGroup: 'Costas' },
  { name: 'Encolhimento', muscleGroup: 'Costas' },

  // Pernas
  { name: 'Agachamento livre', muscleGroup: 'Pernas' },
  { name: 'Agachamento frontal', muscleGroup: 'Pernas' },
  { name: 'Leg press', muscleGroup: 'Pernas' },
  { name: 'Hack machine', muscleGroup: 'Pernas' },
  { name: 'Cadeira extensora', muscleGroup: 'Pernas' },
  { name: 'Cadeira flexora', muscleGroup: 'Pernas' },
  { name: 'Mesa flexora', muscleGroup: 'Pernas' },
  { name: 'Stiff', muscleGroup: 'Pernas' },
  { name: 'Afundo', muscleGroup: 'Pernas' },
  { name: 'Búlgaro', muscleGroup: 'Pernas' },
  { name: 'Panturrilha em pé', muscleGroup: 'Pernas' },
  { name: 'Panturrilha sentado', muscleGroup: 'Pernas' },
  { name: 'Cadeira adutora', muscleGroup: 'Pernas' },
  { name: 'Cadeira abdutora', muscleGroup: 'Pernas' },

  // Glúteos
  { name: 'Elevação pélvica', muscleGroup: 'Glúteos' },
  { name: 'Glúteo na polia', muscleGroup: 'Glúteos' },
  { name: 'Coice na máquina', muscleGroup: 'Glúteos' },

  // Ombros
  { name: 'Desenvolvimento', muscleGroup: 'Ombros' },
  { name: 'Desenvolvimento Arnold', muscleGroup: 'Ombros' },
  { name: 'Elevação lateral', muscleGroup: 'Ombros' },
  { name: 'Elevação frontal', muscleGroup: 'Ombros' },
  { name: 'Crucifixo inverso', muscleGroup: 'Ombros' },
  { name: 'Face pull', muscleGroup: 'Ombros' },
  { name: 'Remada alta', muscleGroup: 'Ombros' },

  // Bíceps
  { name: 'Rosca direta', muscleGroup: 'Bíceps' },
  { name: 'Rosca alternada', muscleGroup: 'Bíceps' },
  { name: 'Rosca martelo', muscleGroup: 'Bíceps' },
  { name: 'Rosca scott', muscleGroup: 'Bíceps' },
  { name: 'Rosca concentrada', muscleGroup: 'Bíceps' },
  { name: 'Rosca na polia', muscleGroup: 'Bíceps' },

  // Tríceps
  { name: 'Tríceps corda', muscleGroup: 'Tríceps' },
  { name: 'Tríceps barra', muscleGroup: 'Tríceps' },
  { name: 'Tríceps testa', muscleGroup: 'Tríceps' },
  { name: 'Tríceps francês', muscleGroup: 'Tríceps' },
  { name: 'Tríceps coice', muscleGroup: 'Tríceps' },
  { name: 'Mergulho no banco', muscleGroup: 'Tríceps' },

  // Abdômen
  { name: 'Abdominal supra', muscleGroup: 'Abdômen' },
  { name: 'Abdominal infra', muscleGroup: 'Abdômen' },
  { name: 'Prancha', muscleGroup: 'Abdômen' },
  { name: 'Elevação de pernas', muscleGroup: 'Abdômen' },
  { name: 'Abdominal na polia', muscleGroup: 'Abdômen' },
];

/**
 * Como dois nomes de exercicio sao comparados.
 *
 * Sem acento e sem caixa: quem digitou "triceps corda" na pressa nao pode
 * acabar com uma segunda linha ao lado de "Tríceps corda" — sao o mesmo
 * movimento, e duplicata no catalogo quebra o historico, que e por exercicio.
 */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/** Os comuns que ainda nao existem no catalogo, na ordem da lista. */
export async function missingCommonExercises(): Promise<CommonExercise[]> {
  const existing = await listExercises();
  const known = new Set(existing.map((exercise) => normalizeName(exercise.name)));
  return COMMON_EXERCISES.filter((item) => !known.has(normalizeName(item.name)));
}

/**
 * Insere os comuns que faltam e devolve quantos entraram.
 *
 * Idempotente de proposito: o botao que chama isto fica visivel enquanto faltar
 * alguma coisa, e tocar duas vezes nao pode render catalogo dobrado. Tambem e o
 * que faz a lista poder crescer numa versao futura sem migracao — quem ja tem o
 * catalogo antigo so recebe a diferenca.
 */
export async function addMissingCommonExercises(): Promise<number> {
  const missing = await missingCommonExercises();
  for (const item of missing) {
    await createExercise(item.name, item.muscleGroup, item.kind ?? 'strength');
  }
  return missing.length;
}

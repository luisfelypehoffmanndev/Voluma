import type { MuscleGroup } from '@/db/catalog';
import { normalizeName } from '@/db/catalog';
import type { ExerciseKind } from '@/domain/types';

import { FRAMES } from './art';
import { MOVEMENT_DATA } from './data';
import { NAMES_PT } from './names.pt';
import type { ExerciseType } from './taxonomy';
import { EQUIPMENT_LABELS, equipmentLabel, groupFor, kindFor } from './taxonomy';

/**
 * A biblioteca de movimentos: 288 exercicios de academia com nome, grupo e
 * equipamento, dos quais 59 tem figura.
 *
 * Existe porque o catalogo do app resolve o primeiro contato (uma tela vazia) e
 * nao o segundo: quem ja tem os comuns e quer "afundo com pe elevado" hoje
 * precisa digitar o nome e torcer para escrever igual da proxima vez. A
 * biblioteca da o nome pronto, o grupo certo e a figura.
 *
 * Ela NAO e semeada. `seedIfEmpty` continua criando so os `COMMON_EXERCISES`;
 * daqui, cada movimento vira linha em `exercises` no momento em que alguem
 * adiciona. Duas razoes: a tabela `exercises` sincroniza linha a linha por RLS,
 * e 288 linhas para quem usa 15 e peso morto no push; e a lista tem variacoes
 * demais para caber numa tela de catalogo (Smith, elastico, halter e barra do
 * mesmo movimento sao quatro entradas).
 *
 * Pelo mesmo motivo nada disto vira coluna no banco: nome, grupo e figura sao
 * dado estatico de catalogo, e o usuario pode renomear ou apagar a linha dele
 * quando quiser. O casamento e por `normalizeName(name)` — a mesma chave que
 * `addMissingCommonExercises` ja usa para deduplicar. Exercicio criado a mao
 * simplesmente nao acha entrada, e a UI cai no placeholder.
 */

export type Movement = {
  /** Chave da arte e do manifesto de origem: `bench-press`. */
  slug: string;
  name: string;
  muscleGroup: MuscleGroup;
  /** Rotulo em portugues: `Halteres`, `Polia`, `Peso do corpo`. */
  equipment: string;
  /**
   * O que o movimento mede na origem. O app so registra `strength` e `run`
   * (ver `kind`), mas guardar isto deixa barato adaptar o registro depois —
   * prancha e wall sit sao `duration` e hoje entram como series x reps.
   */
  exerciseType: ExerciseType;
  kind: ExerciseKind;
  /** Se ha figura vendorizada para o movimento. */
  illustrated: boolean;
};

/**
 * Onde a convencao brasileira discorda do musculo primario do manifesto.
 *
 * Sao os dois casos em que `COMMON_EXERCISES` ja tinha decidido diferente, e o
 * catalogo do usuario e quem manda: face pull esta no dia de ombro apesar de
 * puxar costas, e a cadeira abdutora fica com as outras cadeiras em Pernas
 * apesar de ser gluteo. Manter os dois em sincronia e o que impede a mesma
 * lista de mostrar o mesmo movimento em duas secoes.
 */
const GROUP_OVERRIDE: Readonly<Record<string, MuscleGroup>> = {
  'face-pull': 'Ombros',
  'hip-abduction-machine': 'Pernas',
};

export const MOVEMENT_LIBRARY: readonly Movement[] = MOVEMENT_DATA.map(
  ([slug, muscle, equipment, exerciseType]) => {
    const name = NAMES_PT[slug];
    if (!name) throw new Error(`movimento sem nome em portugues: ${slug}`);

    return {
      slug,
      name,
      muscleGroup: GROUP_OVERRIDE[slug] ?? groupFor(muscle, equipment, exerciseType),
      equipment: equipmentLabel(equipment),
      exerciseType,
      kind: kindFor(equipment, exerciseType),
      illustrated: slug in FRAMES,
    };
  },
);

const BY_NAME = new Map(MOVEMENT_LIBRARY.map((movement) => [normalizeName(movement.name), movement]));

/**
 * O texto contra o qual a busca casa: nome, grupo e equipamento.
 *
 * Grupo e equipamento entram porque quem digita "biceps" ou "elastico" nao esta
 * lembrando de um nome, esta filtrando — e obrigar a passar pelos chips para
 * isso seria um filtro a menos por um toque a mais.
 */
const HAYSTACK = new Map(
  MOVEMENT_LIBRARY.map((movement) => [
    movement.slug,
    normalizeName(`${movement.name} ${movement.muscleGroup} ${movement.equipment}`),
  ]),
);

/**
 * O movimento com este nome, ou null.
 *
 * Aceita o nome como esta na linha de `exercises`, entao passa por
 * `normalizeName`: quem digitou "supino reto" na pressa tem que achar a mesma
 * figura de quem tem "Supino reto" semeado.
 */
export function findMovement(name: string): Movement | null {
  return BY_NAME.get(normalizeName(name)) ?? null;
}

/** O slug da figura deste exercicio, ou null se ele nao tem uma. */
export function artSlugFor(name: string): string | null {
  const movement = findMovement(name);
  return movement?.illustrated ? movement.slug : null;
}

/** Os equipamentos que aparecem na biblioteca, na ordem dos chips. */
export function libraryEquipment(): readonly string[] {
  const present = new Set(MOVEMENT_LIBRARY.map((movement) => movement.equipment));
  return EQUIPMENT_LABELS.filter((label) => present.has(label));
}


/**
 * A biblioteca na ordem em que a tela mostra: os ilustrados primeiro, depois
 * alfabetica. Numa grade de figuras, um bloco de placeholders no meio le como
 * carregamento travado.
 *
 * Ordenada uma vez so, ao carregar o modulo. A ordem nao depende dos filtros, e
 * `filter` preserva a ordem de entrada — entao filtrar esta lista da o mesmo
 * resultado que filtrar e ordenar, sem pagar 288 `localeCompare` a cada letra
 * digitada na busca.
 */
const DISPLAY_ORDER: readonly Movement[] = [...MOVEMENT_LIBRARY].sort((a, b) => {
  if (a.illustrated !== b.illustrated) return a.illustrated ? -1 : 1;
  return a.name.localeCompare(b.name, 'pt-BR');
});

/** A biblioteca filtrada, na ordem em que a tela mostra (ver `DISPLAY_ORDER`). */
export function filterMovements(options: {
  group?: MuscleGroup | null;
  equipment?: string | null;
  search?: string;
}): Movement[] {
  const term = options.search ? normalizeName(options.search) : '';

  return DISPLAY_ORDER.filter((movement) => {
    if (options.group && movement.muscleGroup !== options.group) return false;
    if (options.equipment && movement.equipment !== options.equipment) return false;
    if (term && !HAYSTACK.get(movement.slug)!.includes(term)) return false;
    return true;
  });
}

import { MOVEMENT_DATA } from '@movements/data';
import { NAMES_PT } from '@movements/names';
import { groupFor, kindFor } from '@movements/taxonomy';

/** Um movimento da biblioteca do app, como o painel oferece para os treinos. */
export type Movement = { slug: string; name: string; group: string; kind: 'strength' | 'run' };

/** A mesma biblioteca do app (`src/movements/library.ts`), sem as artes. */
export const MOVEMENTS: readonly Movement[] = MOVEMENT_DATA.map(([slug, muscle, equipment, type]) => ({
  slug,
  name: NAMES_PT[slug] ?? slug,
  group: groupFor(muscle, equipment, type),
  kind: kindFor(equipment, type),
})).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

const BY_SLUG = new Map(MOVEMENTS.map((m) => [m.slug, m]));

export function movementBySlug(slug: string): Movement | null {
  return BY_SLUG.get(slug) ?? null;
}

/**
 * Regras puras do painel: como mostrar o vinculo de um dia e a frequencia.
 * Sem Supabase nem React, para testar sem nada em volta.
 */

/** Uma linha de `staff_find_students`. */
export type StudentRow = {
  user_id: string;
  display_name: string | null;
  handle: string | null;
  preset_ids: string[];
  plan_ids?: string[];
  prescribed_days: number;
  self_edited_days: number;
  customized_days?: number;
  planned_days: number;
  trained_days: number;
  last_trained_on: string | null;
};

/** O suficiente de `routines` para dizer de quem e o dia. */
export type DayLinkInput = {
  preset_id: string | null;
  prescribed_by: string | null;
  prescribed_at: string | null;
};

/**
 * De quem e o dia, do ponto de vista da academia:
 * - `instructor`: prescrito; os lotes tocam
 * - `self_edited`: foi prescrito, mas o aluno editou depois e desvinculou
 * - `preset`: segue uma ficha sugerida
 * - `own`: plano do proprio aluno
 * Mesma leitura do `staff_find_students` e do plano 18.
 */
export type DayLink = 'instructor' | 'self_edited' | 'preset' | 'own';

export function dayLink(day: DayLinkInput): DayLink {
  if (day.prescribed_by) return 'instructor';
  if (day.preset_id) return 'preset';
  if (day.prescribed_at) return 'self_edited';
  return 'own';
}

export const DAY_LINK_LABEL: Record<DayLink, string> = {
  instructor: 'Prescrito',
  self_edited: 'Editado pelo aluno',
  preset: 'Ficha',
  own: 'Do aluno',
};

/** O nome que o painel mostra: nome de exibicao, @, ou um pedaco do id. */
export function studentName(row: Pick<StudentRow, 'display_name' | 'handle' | 'user_id'>): string {
  if (row.display_name?.trim()) return row.display_name.trim();
  if (row.handle) return `@${row.handle}`;
  return `Aluno ${row.user_id.slice(0, 6)}`;
}

/**
 * "hoje", "ontem", "há 5 dias", ou "nunca". `today` e `lastOn` sao datas
 * locais YYYY-MM-DD, as mesmas do app.
 */
export function lastTrainedLabel(lastOn: string | null, today: string): string {
  if (!lastOn) return 'nunca';
  const days = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastOn}T00:00:00Z`)) / 86_400_000,
  );
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  return `há ${days} dias`;
}

/** Busca local por nome ou @, sem acento e sem caixa. */
export function matchesSearch(row: StudentRow, query: string): boolean {
  const needle = fold(query.trim().replace(/^@/, ''));
  if (!needle) return true;
  return [row.display_name, row.handle].some((value) => value && fold(value).includes(needle));
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
